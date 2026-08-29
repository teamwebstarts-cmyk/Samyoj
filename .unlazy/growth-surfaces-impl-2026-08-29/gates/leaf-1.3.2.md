# Gates: Official check / OBA checklist

OWNS: client/src/components/settings/OfficialCheckCard.tsx, client/src/components/settings/WhatsAppChannelsPanel.tsx, server/src/modules/whatsapp/meta.service.ts, server/src/modules/billing/usage.service.ts

Scope: Settings WhatsApp shows an Official check checklist. Copy: we help apply, Meta decides. No sell-the-tick language.

- [x] G1: checklist exists and forbids selling the badge
  CHECK: node .unlazy/growth-surfaces-impl-2026-08-29/scripts/verify-impl.mjs --leaf 1.3.2
  EXPECT: growth-surfaces impl verification passed
  CWD: /workspaces/Samyoj
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=OK include client/src/components/settings/WhatsAppChannelsPanel.tsx | growth-surfaces impl verification passed
