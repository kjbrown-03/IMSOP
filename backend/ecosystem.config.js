// Production process manager config (PM2): https://pm2.keymetrics.io
//
// Why this exists: a single `node src/server.js` uses one CPU core and, if it
// crashes, stays down until someone notices and restarts it manually - every
// connected user is affected until then. Cluster mode runs one worker per CPU
// core behind PM2's built-in load balancer, so traffic is spread across all
// of them and a crashed worker is respawned in under a second while its
// siblings keep serving requests without interruption.
//
// Usage on the production server:
//   npm install -g pm2
//   pm2 start ecosystem.config.js --env production
//   pm2 save && pm2 startup   # survive server reboots
//   pm2 logs                  # tail all workers
//   pm2 monit                 # live CPU/memory per worker
module.exports = {
  apps: [
    {
      name: 'imsop-backend',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
