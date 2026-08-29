# Gates: Phase B — Connect branch

OWNS: server/src/modules/whatsapp/routes.ts, server/src/modules/whatsapp/connect-*.ts, client/src/utils/embeddedSignup.ts, client/src/hooks/useWhatsAppConnectOAuth.ts

Scope: Coexistence connect path with featureType whatsapp_business_app_onboarding; skip register; post-connect Graph is_on_biz_app check.

- [ ] B-C:G1: Client embeddedSignup supports coexistence featureType
  CHECK: node -e "const s=require('fs').readFileSync('client/src/utils/embeddedSignup.ts','utf8'); if(!/whatsapp_business_app_onboarding/.test(s)) process.exit(1); console.log('coex_connect_ok');"
  EXPECT: coex_connect_ok
  EVIDENCE: pending

- [ ] B-C:G2: connect-url accepts mode=coexistence
  CHECK: node -e "const s=require('fs').readFileSync('server/src/modules/whatsapp/routes.ts','utf8'); if(!/mode === 'coexistence'/.test(s)) process.exit(1); console.log('coex_route_ok');"
  EXPECT: coex_route_ok
  EVIDENCE: pending
