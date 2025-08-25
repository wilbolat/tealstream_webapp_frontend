module.exports = {
  apps: [
    {
      name: "ingest-server",
      script: "server.js",
      cwd: "/home/tealstream/apps/tealstream_webapp_frontend/backend/ingest",
      env: { NODE_ENV: "production", PORT: 3000 }
    },
    {
      // only use this if you enable the queue (ENABLE_QUEUE=1 in .env)
      name: "ingest-worker",
      script: "worker.js",
      cwd: "/home/tealstream/apps/tealstream_webapp_frontend/backend/ingest",
      env: { NODE_ENV: "production" }
    }
  ]
}
