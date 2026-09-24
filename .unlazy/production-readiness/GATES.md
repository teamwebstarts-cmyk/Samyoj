# Gates: production readiness hardening

OWNS: server/src/utils/jwt.ts, server/src/modules/facebook/connect-oauth-state.ts, server/src/modules/whatsapp/connect-oauth-state.ts, server/src/modules/whatsapp/webhook-signature-gate.ts, server/src/modules/facebook/channel-keyword.ts, server/src/modules/facebook/messenger-ingest.ts, server/src/modules/instagram/ingest.ts, server/src/modules/facebook/save-page-channel.ts, server/src/modules/instagram/inbox.routes.ts, server/src/modules/instagram/comments.routes.ts, server/src/modules/facebook/audit-score.ts, server/src/modules/facebook/audit-score.test.ts, server/prisma/**, client/src/pages/AutomationsPage.tsx, client/src/pages/FacebookAdsPage.tsx, docs/meta-ecosystem/**, docs/deployment/**, scripts/vps-deploy.sh, start.sh, server/.env.example

Scope: harden Meta channel correctness, deployment safety, documentation honesty, and verification without adding Ads mutation or publishing features

- [x] G1: focused Meta/security regression suite passes
  CHECK: npx vitest run src/modules/facebook/audit-score.test.ts src/modules/facebook/channel-keyword.test.ts src/modules/facebook/channel-inbox-actions.test.ts src/modules/facebook/save-page-channel.test.ts src/modules/facebook/leadgen-ingest.test.ts src/modules/instagram/instagram.test.ts src/modules/whatsapp/webhook-signature-gate.test.ts src/modules/whatsapp/route-hardening.test.ts src/modules/whatsapp/webhook-health.test.ts src/modules/whatsapp/meta-token-exchange.test.ts src/utils/jwt.test.ts src/config/validate.test.ts
  EXPECT: Test Files
  CWD: server
  EVIDENCE: 12 test files passed; full server suite also passed (191 files / 1,198 tests).

- [x] G2: server, client, and admin typechecks/builds pass
  CHECK: npm run build && npm --prefix ../client run build && npm --prefix ../admin run build
  EXPECT: built in
  CWD: server
  EVIDENCE: server, client, and admin production builds passed on 2026-09-25.

- [x] G3: tracked example environment values are placeholders
  CHECK: node -e "const fs=require('fs'); const keys=['PLATFORM_OPERATOR_PASSWORD','META_APP_SECRET','NGROK_AUTHTOKEN','AZURE_OPENAI_API_KEY','SARVAM_API_KEY','RAZORPAY_KEY_SECRET','BROWSER_USE_API_KEY']; const bad=fs.readFileSync('server/.env.example','utf8').split(/\r?\n/).map(x=>x.replace(/^#\s*/, '')).filter(x=>keys.some(k=>x.startsWith(k+'=')) && !/=(?:$|your_|replace|changeme|generate|<)/i.test(x)); if(bad.length){console.error(bad.map(x=>x.split('=',1)[0]).join(',')); process.exit(1)} console.log('ENV_EXAMPLE_PLACEHOLDERS_OK')"
  EXPECT: ENV_EXAMPLE_PLACEHOLDERS_OK
  CWD: .
  EVIDENCE: ENV_EXAMPLE_PLACEHOLDERS_OK.

- [x] G4: deployment docs and scripts use the safe production path
  CHECK: node -e "const fs=require('fs'); const files=['docs/deployment/README.md','docs/deployment/DEPLOYMENT_GUIDE.md']; const bad=files.flatMap(f=>fs.readFileSync(f,'utf8').split(/\r?\n/).filter(x=>/prisma migrate deploy|prisma migrate dev/.test(x))); if(bad.length){console.error(bad.join('\n')); process.exit(1)} const s=fs.readFileSync('scripts/vps-deploy.sh','utf8'); for(const needle of ['db:backup','vps-prod-smoke.sh']) if(!s.includes(needle)){console.error('missing '+needle); process.exit(1)} console.log('DEPLOYMENT_DOCS_SAFE_OK')"
  EXPECT: DEPLOYMENT_DOCS_SAFE_OK
  CWD: .
  EVIDENCE: DEPLOYMENT_DOCS_SAFE_OK; shell syntax check passed.

- [x] G5: local runtime health and public challenge remain healthy
  CHECK: node -e "const http=require('http'); const get=(url)=>new Promise((resolve,reject)=>{http.get(url,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>resolve({status:r.statusCode,body:b}))}).on('error',reject)}); Promise.all([get('http://localhost:8000/health'),get('http://localhost:8000/api/whatsapp/webhook/health'),get('http://localhost:3000'),get('http://localhost:3001')]).then(xs=>{if(xs.some(x=>x.status!==200)) throw new Error(JSON.stringify(xs.map(x=>x.status))); const health=JSON.parse(xs[0].body); const wh=JSON.parse(xs[1].body); if(health.status!=='ok'||wh.data?.webhookConfigured!==true) throw new Error('health contract failed'); console.log('LOCAL_RUNTIME_HEALTH_OK')}).catch(e=>{console.error(e);process.exit(1)})"
  EXPECT: LOCAL_RUNTIME_HEALTH_OK
  CWD: .
  EVIDENCE: LOCAL_RUNTIME_HEALTH_OK; local API, webhook health, client, and admin returned 200.

- [x] G6: external Meta and customer-host evidence is reviewed separately
  EVIDENCE: ABANDONED as an external gate; blockers are recorded in docs/meta-ecosystem/BLOCKERS.md.

ABANDON: G6 External Meta App Review, production callback/subscriptions, customer-host inbound, and customer-host restore require Meta/VPS access and cannot be completed from this workspace; they remain explicit release blockers.
