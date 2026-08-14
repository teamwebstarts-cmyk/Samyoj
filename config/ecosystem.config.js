/**
 * PM2 — testing/production runs only the Express server (serves client/dist + /api).
 * Build first: npm run build
 * Start: pm2 start config/ecosystem.config.js
 *
 * Workers are embedded in the API via startWorkers() in server/src/index.ts.
 * Do NOT also run dist/workers/index.js — that starts a second BullMQ consumer
 * (duplicate jobs; Inbox realtime can miss Socket.IO emits).
 *
 * Existing hosts that already have `whatsapp-worker`:
 *   pm2 delete whatsapp-worker && pm2 start config/ecosystem.config.js && pm2 save
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
        SAMYOJ_EMBEDDED_WORKERS: '1',
      },
    },
    // Intentionally omitted: whatsapp-worker / dist/workers/index.js
    // (duplicate of in-process startWorkers() in the API).
  ],
};
