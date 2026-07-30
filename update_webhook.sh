#!/bin/bash
cd /workspaces/Samyoj/server
sed -i "s|META_WEBHOOK_URL=.*|META_WEBHOOK_URL=https://zany-potato-pj46q477jr9p265rj-5000.app.github.dev/api/whatsapp/webhook|" .env
grep META_WEBHOOK_URL .env
