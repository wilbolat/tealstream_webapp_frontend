require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const crypto = require('crypto');

const { upload } = require('./upload');
const { metaSchema } = require('./validators');
const { getDevice, checkBearer, verifyToken, decryptHmacSecret, verifyHmac } = require('./auth');
const { query } = require('./db');
const { redis } = require('./redis');
const { putJpeg } = require('./spaces');
const { queue } = require('./queue');

const app = express();
const port = Number(process.env.PORT || 3000);
const MAX_BODY = (Number(process.env.MAX_BODY_SIZE_MB || 10) * 1024 * 1024) + 'b';

app.use(helmet());


app.use(pinoHttp({
  genReqId: () => crypto.randomUUID(),

  // Don’t log routine health/ready:
  autoLogging: { ignorePaths: ['/healthz', '/readyz'] },

  // Only log errors (>=400); be silent for 2xx/3xx
  customLogLevel: (res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'silent'; // suppress success noise
  },

  // Keep request/response minimal; redact secrets
  redact: ['req.headers.authorization', 'req.headers.cookie'],

  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        headers: {
          'content-type': req.headers['content-type'],
          'content-length': req.headers['content-length'],
          'x-devicesn': req.headers['x-devicesn'],
        }
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
    err: pinoHttp.stdSerializers.err,
  },
}));


app.get('/healthz', async (req, res) => {
  try { await query('SELECT 1'); await redis.ping(); res.json({ ok: true }); }
  catch { res.status(503).json({ ok: false }); }
});
app.get('/readyz', (req, res) => res.json({ ready: true }));

// JSON body path (no photo)
app.use('/api/ingest', express.json({ limit: MAX_BODY, type: ['application/json'] }));
app.use('/api/ingest', express.raw({ limit: MAX_BODY, type: ['image/jpeg'] }));

// Run multer only when the request is multipart/form-data; allow raw image/jpeg bodies
const maybeMulter = (req, res, next) => {
  if (req.is && req.is('multipart/form-data')) {
    return upload.single('photo')(req, res, next);
  }
  return next();
};

app.post('/api/ingest', maybeMulter, async (req, res) => {
  try {
    // Parse meta from JSON or multipart field
    const rawMeta = req.is('application/json') ? req.body : JSON.parse(req.body?.meta || '{}');
    // Coerce numbers if multipart provided strings
    if (typeof rawMeta.level_m === 'string') rawMeta.level_m = Number(rawMeta.level_m);
    if (typeof rawMeta.battery_v === 'string') rawMeta.battery_v = Number(rawMeta.battery_v);
    if (typeof rawMeta.temp_c === 'string') rawMeta.temp_c = Number(rawMeta.temp_c);

    // --- Compatibility: allow meta via query and map common value names ---
    if (!rawMeta.client_slug && req.query?.client_slug) rawMeta.client_slug = String(req.query?.client_slug);
    if (!rawMeta.site_slug && req.query?.site_slug) rawMeta.site_slug = String(req.query?.site_slug);
    if (!rawMeta.ydoc_serial && req.query?.ydoc_serial) rawMeta.ydoc_serial = String(req.query?.ydoc_serial);

    // Map typical aliases -> level_m
    if (rawMeta.level_m === undefined) {
      const v =
        rawMeta.value ??
        rawMeta.Value ??
        (Array.isArray(rawMeta.values) ? (rawMeta.values[0]?.value ?? rawMeta.values[0]) : undefined);
      if (v !== undefined) rawMeta.level_m = Number(v);
    }

    // Default timestamp (UTC)
    if (!rawMeta.ts) rawMeta.ts = new Date().toISOString();
    if (!rawMeta.client_slug) rawMeta.client_slug = "metrovancouver";
    if (!rawMeta.site_slug) rawMeta.site_slug = "coquitlam";
    if (!rawMeta.ydoc_serial) rawMeta.ydoc_serial = "ML-417ADS-125638581";
    // YDOC ML-X17 compatibility: map first data row AIN -> level_m
    if (rawMeta.level_m === undefined && Array.isArray(rawMeta.data)) {
      const firstRow = rawMeta.data.find(r => r && typeof r === "object");
      if (firstRow) {
        const cand = firstRow.AIN ?? firstRow.ain ?? firstRow.Analog ?? firstRow.analog ?? firstRow.value ?? firstRow.Val;
        if (cand !== undefined) rawMeta.level_m = Number(cand);
      }
    }
    const isJpeg = (req.headers["content-type"] || "").toLowerCase().startsWith("image/jpeg");
    const _schema = isJpeg ? metaSchema.partial({ level_m: true, battery_v: true, temp_c: true, reading_id: true }) : metaSchema;
    const parsed = _schema.safeParse(rawMeta);
    if (!parsed.success) {
      req.log?.warn({ rawMeta, issues: parsed.error.issues }, "invalid_meta");
      return res.status(400).json({ error: "invalid_meta", details: parsed.error.issues });
    }

    const meta = parsed.data;

    // Bearer auth (tolerant to "Authorization Bearer ..." and allows X-Device-Token)
    let tokenHeader = req.get("authorization") || "";
    if (tokenHeader) {
      // strip a leading literal "Authorization " if the device duplicated the word
      tokenHeader = tokenHeader.replace(/^Authorization\s+/i, "");
    }
    let token = "";
    if (/^Bearer\s+/i.test(tokenHeader)) {
      token = tokenHeader.replace(/^Bearer\s+/i, "").trim();
    } else if (req.get("x-device-token")) {
      token = String(req.get("x-device-token")).trim();
    }
    if (!token) return res.status(401).json({ error: "missing_bearer" });

    const device = await getDevice(meta.ydoc_serial);
    if (!device) return res.status(401).json({ error: 'device_not_found_or_inactive' });
    if (!verifyToken(token, device.token_hash)) return res.status(401).json({ error: 'bad_token' });

    // Build photoBuffer early so HMAC can include the photo when content-type is image/jpeg
    // For raw image/jpeg bodies express.raw middleware will put a Buffer in req.body
    const photoBuffer = isJpeg
      ? (Buffer.isBuffer(req.body) ? req.body : (req.file ? req.file.buffer : null))
      : (req.file ? req.file.buffer : null);

    // Diagnostic log: report source and size of photo and whether level_m is present
    try {
      req.log?.info({ isJpeg, photoSize: photoBuffer ? photoBuffer.length : 0, hasLevel: meta.level_m != null }, "photo_info");
    } catch (err) {
      req.log?.warn({ err }, "photo_info_log_failed");
    }

    // Optional HMAC
    const sig = req.get('x-signature');
    if (sig) {
      const secret = decryptHmacSecret(device);
      if (!secret) return res.status(403).json({ error: 'hmac_not_configured' });
      const photoHash = photoBuffer ? (req.get('x-photo-hash') || crypto.createHash('sha256').update(photoBuffer).digest('hex')) : '';
      const base = JSON.stringify(meta) + '.' + photoHash;
      const ok = verifyHmac({ secret, base, signatureB64: sig, algo: process.env.HMAC_ALGO || 'sha256' });
      if (!ok) return res.status(403).json({ error: 'bad_hmac' });
    }

    // Queue or inline
    if (process.env.ENABLE_QUEUE === '1') {
      const job = await queue.add('reading', { meta, photoBuffer: photoBuffer || null }, { removeOnComplete: 500, removeOnFail: 500 });
      return res.status(202).json({ status: 'queued', jobId: job.id, reading_id: meta.reading_id || null });
    } else {
      // Inline write (same logic the worker uses)
      // Resolve ids
      const r = await query(
        `SELECT c.id client_id, s.id site_id, d.id device_id, s.slug site_slug
         FROM clients c
         JOIN sites s ON s.client_id=c.id AND c.slug=$1 AND s.slug=$2
         JOIN devices d ON d.site_id=s.id AND d.ydoc_serial=$3 AND d.is_active=TRUE`,
        [meta.client_slug, meta.site_slug, meta.ydoc_serial]
      );
      if (!r.rowCount) return res.status(400).json({ error: 'meta_ref_not_found' });
      const { site_id, device_id, site_slug } = r.rows[0];

      let photo_key = null;
      if (photoBuffer) {
        const dt = new Date(meta.ts);

        // Folder date in local TZ (PST/PDT)
        const PHOTO_TZ = process.env.PHOTO_TZ || 'America/Vancouver';
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: PHOTO_TZ,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(dt).reduce((o, p) => (o[p.type] = p.value, o), {});

        const yyyy = parts.year, mm = parts.month, dd = parts.day;

        // File name time in local TZ (hhmmss)
        const tparts = new Intl.DateTimeFormat('en-CA', {
          timeZone: PHOTO_TZ,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).formatToParts(dt).reduce((o, p) => (o[p.type] = p.value, o), {});

        const hh = tparts.hour;
        const mi = tparts.minute;
        const ss = tparts.second;

        photo_key = `${meta.client_slug}/${meta.site_slug}/${yyyy}/${mm}/${dd}/${hh}${mi}${ss}.jpg`;
        await putJpeg({ Bucket: process.env.SPACES_BUCKET, Key: photo_key, Body: photoBuffer });
      }


      // If the request included a photo but no measured level (level_m),
      // skip inserting a reading row (the DB enforces level_m NOT NULL).
      if (meta.level_m === undefined || meta.level_m === null) {
        req.log?.warn({ site_id, device_id, ts: meta.ts }, 'photo_only_no_level');
      } else {
        await query(
          `INSERT INTO readings (site_id, device_id, ts, level_m, battery_v, temp_c, photo_key, reading_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (site_id, ts) DO NOTHING`,
          [site_id, device_id, meta.ts, meta.level_m ?? null, meta.battery_v ?? null, meta.temp_c ?? null, photo_key, meta.reading_id ?? null]
        );
      }

      try {
        await redis.set(`latest:${site_slug}`, JSON.stringify({
          ts: meta.ts, level_m: meta.level_m ?? null, battery_v: meta.battery_v ?? null, temp_c: meta.temp_c ?? null, photo_key
        }), 'EX', 86400);
      } catch (e) {
        req.log?.warn({ err: e }, 'redis_set_failed');
      }

      return res.status(202).json({ status: 'processed', reading_id: meta.reading_id || null });
    }
  } catch (e) {
    if (String(e.message).includes('ONLY_JPEG_ALLOWED') || String(e).includes('LIMIT_FILE_SIZE')) {
      return res.status(413).json({ error: 'payload_too_large_or_not_jpeg' });
    }
    req.log?.error({ err: e }, 'ingest-error');
    return res.status(500).json({ error: 'server_error' });
  }
});

app.listen(port, () => console.log(`ingest listening on ${port}`));
