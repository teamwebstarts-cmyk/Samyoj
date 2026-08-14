# Palermo WhatsApp Platform — Production Runbook

> **Correction (2026-08-15):** Workers are embedded in `whatsapp-api` via `startWorkers()`. Do not run PM2 `whatsapp-worker` or `npm run start:worker`. See `config/ecosystem.config.js` and `docs/deployment/DEPLOYMENT_GUIDE.md`.

## Architecture

- **API**: Express on port 5000 (PM2: `whatsapp-api`)
- **Workers**: BullMQ processors (PM2: `whatsapp-worker`)
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7
- **Frontend**: React static build served by Nginx

## Deployment

```bash
# 1. Pull latest
git pull origin main

# 2. Install dependencies
npm run install:all

# 3. Run migrations
cd server && npx prisma migrate deploy && npx prisma generate

# 4. Build
cd ../client && npm run build
cd ../server && npm run build

# 5. Restart services
pm2 restart whatsapp-api whatsapp-worker
```

## Environment Variables (Production)

Required secrets (server will fail-fast if missing):
- `ENCRYPTION_KEY` — 64-char hex string
- `META_APP_SECRET` — Meta app secret
- `META_VERIFY_TOKEN` — non-default webhook verify token
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — strong random strings
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string

Recommended:
- `STORAGE_DRIVER=s3` with S3 credentials
- `SENTRY_DSN` for error tracking
- `META_WEBHOOK_URL` — HTTPS webhook endpoint

## Health Checks

```bash
curl https://your-domain.com/health
# Expected: { "status": "ok", "checks": { "api": "ok", "database": "ok", "redis": "ok" } }
```

## Backups

### PostgreSQL (nightly)

```bash
pg_dump $DATABASE_URL | gzip > /backups/whatsapp-$(date +%Y%m%d).sql.gz
aws s3 cp /backups/whatsapp-$(date +%Y%m%d).sql.gz s3://$S3_BUCKET/backups/
```

### Restore drill (monthly)

```bash
gunzip -c backup.sql.gz | psql $DATABASE_URL
```

**RTO**: 4 hours | **RPO**: 1 hour

## Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        root /var/www/whatsapp/client/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

## PM2 Ecosystem

```javascript
module.exports = {
  apps: [
    { name: 'whatsapp-api', script: 'server/dist/index.js', instances: 1 },
    { name: 'whatsapp-worker', script: 'server/dist/workers/index.js', instances: 1 },
  ],
};
```

## Incident Response

1. Check `/health` endpoint
2. Check Sentry for recent errors
3. Check Redis: `redis-cli ping`
4. Check Postgres: `psql $DATABASE_URL -c "SELECT 1"`
5. Check PM2: `pm2 status && pm2 logs --lines 50`
6. Check webhook delivery log in Settings → Integrations

## Key Rotation

1. Generate new `ENCRYPTION_KEY` (requires re-encrypting all stored tokens)
2. Update `JWT_SECRET` (invalidates all sessions)
3. Rotate `META_APP_SECRET` in Meta Developer Console
4. Restart all services after rotation
