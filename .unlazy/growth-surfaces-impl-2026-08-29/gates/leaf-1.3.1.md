# Gates: wa.me website button builder

OWNS: client/src/utils/waMe.ts, client/src/utils/waMe.test.ts, client/src/components/settings/WhatsAppButtonBuilder.tsx, client/src/components/settings/IntegrationsPanel.tsx, client/src/pages/SettingsPage.tsx

Scope: Settings Integrations (or WhatsApp tab) copies official wa.me snippet for the active number. No App ID. No fake in-page chat.

- [ ] G1: snippet is wa.me with digits-only number and no META_APP_ID
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.3.1
  EXPECT: growth-surfaces impl verification passed
  EVIDENCE: pending
