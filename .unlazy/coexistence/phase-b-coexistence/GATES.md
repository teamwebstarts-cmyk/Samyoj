# Gates: Phase B — Coexistence integration

OWNS: server/src/modules/whatsapp/coexistence/**, server/prisma/schema.prisma, server/prisma/migrations/20260829120000_whatsapp_coexistence/**, client/src/components/settings/WhatsAppChannelsPanel.tsx, client/src/components/inbox/MessageBubble.tsx, scripts/check-coex-webhook-fields.mjs

Scope: Coexistence webhooks, schema flags, connect path, product UX, fixture tests.

- [x] B:G1: Coexistence fields in META_WEBHOOK_FIELDS
  CHECK: node scripts/check-coex-webhook-fields.mjs
  EXPECT: coex_fields_ok
  EVIDENCE: exit 0, stdout coex_fields_ok (2026-08-29)

- [x] B:G2: Echo fixture ingests as OUTBOUND
  CHECK: npm test -- coexistence-echo
  EXPECT: 1 passed
  CWD: server
  EVIDENCE: coexistence-echo.test.ts 1 passed (2026-08-29)

- [x] B:G3: History chunk updates progress
  CHECK: npm test -- coexistence-history
  EXPECT: progress_tracked
  CWD: server
  EVIDENCE: test name progress_tracked, 1 passed (2026-08-29)

- [x] B:G4: Dedupe same metaMessageId from echo
  CHECK: npm test -- coexistence-dedupe
  EXPECT: 1 passed
  CWD: server
  EVIDENCE: coexistence-dedupe.test.ts 1 passed (2026-08-29)

- [x] B:G5: account_update ACCOUNT_OFFBOARDED sets flag
  CHECK: npm test -- coexistence-lifecycle
  EXPECT: 1 passed
  CWD: server
  EVIDENCE: coexistence-lifecycle.test.ts 1 passed (2026-08-29)

- [x] B:G6: Full server suite
  CHECK: npm test
  EXPECT: tests passed
  CWD: server
  EVIDENCE: 157 files, 1019 passed (2026-08-29)

- [ ] B:G7: Manual E2E Business app number + echo in Inbox
  EVIDENCE: pending — requires real Business app number + Meta coexistence config
