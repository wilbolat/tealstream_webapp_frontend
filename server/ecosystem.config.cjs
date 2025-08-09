module.exports = {
  apps: [
    {
      name: process.env.APP_NAME || "tealstream-server",
      script: process.env.SERVER_ENTRY || "server.js",
      cwd: process.env.SERVER_DIR || ".",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: process.env.APP_PORT || 9001,
        HTTP_PORT: process.env.APP_PORT || 9001
      },
      out_file: "../logs/app.out.log",
      error_file: "../logs/app.err.log",
      merge_logs: true,
      time: true
    }
  ]
}
