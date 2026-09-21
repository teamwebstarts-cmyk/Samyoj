# Gates: V8 Tech Provider production Connect fail-closed

OWNS: server/src/config/validate.ts, server/src/config/validate.test.ts, server/.env.example, client/src/components/whatsapp/WhatsAppConnectModeModal.tsx

Scope: Production startup refuses Tech Provider Connect misconfig (missing ES config, legacy oauth, tunnel webhook); Samyoj picker copy stays short.

- [x] G1: production Meta Connect validator rejects oauth, tunnel, and missing ES config
  CHECK: npx vitest run src/config/validate.test.ts --reporter=dot
  EXPECT: passed
  CWD: server
  EVIDENCE: 2026-09-21 vitest 1 file 6 passed, stdout "Test Files  1 passed"

- [ ] G2: Manual VPS + Meta Live + customer-like Connect on app.samyoj.com
  EVIDENCE: pending
