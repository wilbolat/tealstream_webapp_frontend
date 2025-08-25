# Tealstream Ingest (Node/Express)

Ingest endpoint for YDOC devices.
- Auth: `Authorization: Bearer <device_token>` (bcrypt-hashed in DB).
- Payload: JSON. Server maps `data[0].AIN] -> level_m` and defaults `ts`.
- Storage: Postgres (`clients/sites/devices/readings`) + Redis cache `latest:<site_slug>`.

## Paths
- Repo code (live): `/home/tealstream/apps/tealstream_webapp_frontend/backend/ingest`
- Secrets (LOCAL ONLY, git‑ignored): `.env`, `secrets/*.token`

## Quick runbook
```bash
# start / restart via ecosystem file
sudo -u tealstream pm2 start /home/tealstream/apps/tealstream_webapp_frontend/backend/ingest/ecosystem.config.js --only ingest-server --update-env
sudo -u tealstream pm2 save

# logs
sudo -u tealstream pm2 logs ingest-server --lines 120

# health
curl -sS http://127.0.0.1:3000/healthz && echo

Deploy (manual)
cd /home/tealstream/apps/tealstream_webapp_frontend
git pull
cd backend/ingest
sudo -u tealstream pnpm install --prod
sudo -u tealstream pm2 restart ingest-server --update-env
sudo -u tealstream pm2 save

Env & secrets

Copy .env.example to .env (do NOT commit .env).

Device tokens live under secrets/<SERIAL>.token (plaintext). DB stores bcrypt hashes.

DB/Cache checks
PGPASSWORD="$DBPW" psql -h 127.0.0.1 -U tealuser -d tealstream \
  -c "SELECT ts, level_m FROM readings ORDER BY inserted_at DESC LIMIT 5;"

redis-cli GET latest:coquitlam

Rotate a device token
SERIAL=ML-417ADS-125638581
# 1) write new token file (keep 0600 perms if you lock later)
echo "<NEW_PLAINTEXT_TOKEN>" > secrets/$SERIAL.token
# 2) update DB hash (use your helper or a quick SQL calling bcrypt in app script)
node utils/check-bcrypt.js  # (or dedicated script)
# 3) push token into YDOC config
# 4) test with curl

Optional features
A) Photo uploads (DigitalOcean Spaces)

Set in .env:

SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
SPACES_BUCKET=<bucket>
SPACES_KEY=<key>
SPACES_SECRET=<secret>


Restart ingest-server.

Send multipart form: meta (JSON) + photo (JPEG).
Files are stored at client/site/yyyy/mm/dd/hhmmss.jpg.

B) Queue mode (BullMQ) — enable later

In .env: ENABLE_QUEUE=1

Start worker:

sudo -u tealstream pm2 start /home/tealstream/apps/tealstream_webapp_frontend/backend/ingest/ecosystem.config.js --only ingest-worker --update-env
sudo -u tealstream pm2 save


Disable queue (default now):

sudo -u tealstream pm2 delete ingest-worker || true

Troubleshooting

401 bad_token: wrong bearer token; load from secrets/<serial>.token.

400 invalid_meta: body missing level_m → server maps data[0].AIN] automatically; check logs for invalid_meta with rawMeta.

500: pm2 logs ingest-server and /var/log/nginx/error.log for details.

Security notes

.env and secrets/ are git‑ignored; never commit them.

Cloudflare is set to Full (strict); do not cache POST /api/ingest.

Consider rate‑limit / firewall rules for /api/ingest.