/**
 * PM2 — production runs only the Express server (serves client/dist + /api).
 * Build first: npm run build
 * Start: pm2 start config/ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'whatsapp-api',
      cwd: './server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
      },
    },
    {
      name: 'whatsapp-worker',
      cwd: './server',
      script: 'dist/workers/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
