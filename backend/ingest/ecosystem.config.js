module.exports = {
  apps: [
    { name: "ingest-server", script: "server.js", cwd: "/srv/ingest", env: { NODE_ENV: "production" } },
    { name: "ingest-worker", script: "worker.js", cwd: "/srv/ingest", env: { NODE_ENV: "production" } }
  ]
}
