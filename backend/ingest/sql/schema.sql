BEGIN;

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sites (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS devices (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  ydoc_serial TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,             -- bcrypt hash of device bearer token
  hmac_nonce BYTEA,                     -- encrypted per-device HMAC secret (nonce/ciphertext/tag)
  hmac_ciphertext BYTEA,
  hmac_tag BYTEA,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- readings: PK (site_id, ts) for clustering by site/time
CREATE TABLE IF NOT EXISTS readings (
  site_id   BIGINT NOT NULL REFERENCES sites(id)   ON DELETE CASCADE,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ts        TIMESTAMPTZ NOT NULL,
  level_m   NUMERIC(10,4) NOT NULL,
  battery_v NUMERIC(6,3),
  temp_c    NUMERIC(6,3),
  photo_key TEXT,                        -- Spaces object key
  reading_id UUID,                       -- optional device-provided id
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, ts)
);

-- Idempotency guards
CREATE UNIQUE INDEX IF NOT EXISTS ux_readings_device_ts 
  ON readings(device_id, ts);

CREATE UNIQUE INDEX IF NOT EXISTS ux_readings_reading_id 
  ON readings(reading_id) 
  WHERE reading_id IS NOT NULL;

-- Optional alerts table for future use
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);

COMMIT;
