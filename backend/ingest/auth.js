require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('./db');

async function getDevice(ydoc_serial) {
  const r = await query(
    `SELECT d.id, d.site_id, d.token_hash, d.hmac_nonce, d.hmac_ciphertext, d.hmac_tag, s.slug AS site_slug
     FROM devices d JOIN sites s ON d.site_id=s.id
     WHERE d.ydoc_serial=$1 AND d.is_active=TRUE`, [ydoc_serial]);
  return r.rows[0] || null;
}

function checkBearer(req) {
  const a = req.get('authorization') || '';
  const parts = a.split(' ');
  return (parts[0] === 'Bearer' && parts[1]) ? parts[1] : null;
}

function verifyToken(token, token_hash) {
  try { return bcrypt.compareSync(token, token_hash); } catch { return false; }
}

// Optional HMAC over meta + "." + photoSha
function decryptHmacSecret(row) {
  if (!row.hmac_ciphertext || !row.hmac_nonce || !row.hmac_tag) return null;
  const key = Buffer.from(process.env.HMAC_MASTER_KEY_BASE64 || '', 'base64');
  const iv = Buffer.from(row.hmac_nonce);
  const ct = Buffer.from(row.hmac_ciphertext);
  const tag = Buffer.from(row.hmac_tag);
  const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct), dec.final()]);
}
function verifyHmac({ secret, base, signatureB64, algo='sha256' }) {
  const mac = crypto.createHmac(algo, secret).update(base).digest('base64');
  try { return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(signatureB64||'', 'utf8')); } catch { return false; }
}

module.exports = { getDevice, checkBearer, verifyToken, decryptHmacSecret, verifyHmac };
