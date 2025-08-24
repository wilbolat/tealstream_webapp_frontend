require('dotenv').config();
const pino = require('pino')({ level: process.env.LOG_LEVEL || 'info' });
const { query } = require('./db');
const { redis } = require('./redis');
const { putJpeg } = require('./spaces');
const { Worker } = require('./queue');

async function processJob(job) {
  const { meta, photoBuffer } = job.data;

  // Resolve site/device
  const r = await query(
    `SELECT c.id client_id, s.id site_id, d.id device_id, s.slug site_slug
     FROM clients c
     JOIN sites s ON s.client_id=c.id AND c.slug=$1 AND s.slug=$2
     JOIN devices d ON d.site_id=s.id AND d.ydoc_serial=$3 AND d.is_active=TRUE`,
    [meta.client_slug, meta.site_slug, meta.ydoc_serial]
  );
  if (!r.rowCount) throw new Error('META_REF_NOT_FOUND');
  const { site_id, device_id, site_slug } = r.rows[0];

  // Optional photo upload
  let photo_key = null;
  if (photoBuffer) {
    const dt = new Date(meta.ts);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth()+1).padStart(2,'0');
    const dd = String(dt.getUTCDate()).padStart(2,'0');
    const hh = String(dt.getUTCHours()).padStart(2,'0');
    const mi = String(dt.getUTCMinutes()).padStart(2,'0');
    const ss = String(dt.getUTCSeconds()).padStart(2,'0');
    photo_key = `${meta.client_slug}/${meta.site_slug}/${yyyy}/${mm}/${dd}/${hh}${mi}${ss}.jpg`;
    await putJpeg({ Bucket: process.env.SPACES_BUCKET, Key: photo_key, Body: photoBuffer });
  }

  // Idempotent insert
  await query(
    `INSERT INTO readings (site_id, device_id, ts, level_m, battery_v, temp_c, photo_key, reading_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (site_id, ts) DO NOTHING`,
    [site_id, device_id, meta.ts, meta.level_m, meta.battery_v ?? null, meta.temp_c ?? null, photo_key, meta.reading_id ?? null]
  );

  // Update Redis "latest:<site_slug>"
  await redis.set(`latest:${site_slug}`, JSON.stringify({
    ts: meta.ts, level_m: meta.level_m, battery_v: meta.battery_v ?? null, temp_c: meta.temp_c ?? null, photo_key
  }), 'EX', 86400);
}

// IMPORTANT: pass the Redis connection to the Worker
new Worker('ingest', async job => processJob(job), { connection: redis });
