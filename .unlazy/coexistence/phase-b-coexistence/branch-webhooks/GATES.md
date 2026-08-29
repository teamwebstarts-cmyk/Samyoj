# Gates: Phase B — Webhooks branch

OWNS: server/src/modules/whatsapp/coexistence/**, server/src/modules/calling/call.processor.ts, server/src/modules/whatsapp/meta.service.ts

Scope: history, smb_message_echoes, smb_app_state_sync, account_update handlers wired into webhook pipeline.

- [ ] B-W:G1: Coexistence processor registered in processWebhookFields
  CHECK: node -e "const s=require('fs').readFileSync('server/src/modules/calling/call.processor.ts','utf8'); if(!/processCoexistenceWebhookFields/.test(s)) process.exit(1); console.log('coex_wire_ok');"
  EXPECT: coex_wire_ok
  EVIDENCE: pending
