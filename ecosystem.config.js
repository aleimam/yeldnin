// PM2 process definition for YeldnIN (production, behind nginx).
// Usage on the server:  pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: "yeldnin",
      // Run Next.js directly (avoids an extra npm shell process under PM2).
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3200",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3200",
        // Node 22 gates node:sqlite behind this flag (stable & flag-free in Node 24+).
        NODE_OPTIONS: "--experimental-sqlite",
        // SESSION_SECRET / DATABASE_URL come from .env.local (loaded by Next).
      },
    },
  ],
};
