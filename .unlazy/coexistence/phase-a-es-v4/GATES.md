# Gates: Phase A — ES v4 migration

OWNS: server/src/config/**, server/src/modules/whatsapp/**, client/src/utils/embeddedSignup.ts, client/src/hooks/useWhatsAppConnectOAuth.ts, client/src/components/dashboard/WhatsAppConnectGuide.tsx, client/src/pages/SettingsPage.tsx, client/src/services/api.ts, scripts/grep-connect-url.mjs, server/.env.example

Scope: Migrate WhatsApp Connect from `/dialog/oauth` redirect to FB JS SDK Embedded Signup v4 (`config_id`); harden token expiry, Meta send backoff, and production webhook HMAC.

- [x] A:G1: `META_ES_CONFIG_ID` wired in server config
  CHECK: node scripts/check-es-config.mjs
  EXPECT: es_config_ok
  EVIDENCE: exit 0, stdout es_config_ok (2026-08-29)

- [x] A:G2: No `/dialog/oauth` in connect URL builder
  CHECK: node scripts/grep-connect-url.mjs
  EXPECT: ES_V4_SDK
  EVIDENCE: exit 0, stdout ES_V4_SDK (2026-08-29)

- [x] A:G3: Server tests green
  CHECK: npm test
  EXPECT: tests passed
  CWD: server
  EVIDENCE: 157 files, 1019 passed (2026-08-29)

- [ ] A:G4: Manual dev Meta connect E2E completes
  EVIDENCE: pending — requires META_ES_CONFIG_ID in Meta Dashboard + dev app
