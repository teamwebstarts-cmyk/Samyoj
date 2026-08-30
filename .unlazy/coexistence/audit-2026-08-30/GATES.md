# Gates: ES v4 + Coexistence audit (2026-08-30)

OWNS: .unlazy/coexistence/audit-2026-08-30/**, client/src/utils/embeddedSignup.ts, client/src/hooks/useWhatsAppConnectOAuth.ts, client/src/contexts/WhatsAppNumberContext.tsx, server/src/modules/whatsapp/coexistence/**, server/src/modules/whatsapp/routes.ts, server/src/modules/whatsapp/webhook-dispatcher.ts, server/src/modules/calling/call.processor.ts, scripts/check-coex-*.mjs

Scope: Exhaustive code audit of ES v4 Connect + Coexistence; fix P0 + remaining P1 (idempotency, history media, isOnBizApp, multi-number routing, Redis throttle); high-value P2; runnable verification gates.

- [x] AUD-G1: ES v4 config wired (META_ES_CONFIG_ID)
  CHECK: node scripts/check-es-config.mjs
  EXPECT: es_config_ok
  EVIDENCE: exit 0, stdout es_config_ok (2026-08-30)

- [x] AUD-G2: No legacy /dialog/oauth in connect URL builder
  CHECK: node scripts/grep-connect-url.mjs
  EXPECT: ES_V4_SDK
  EVIDENCE: exit 0, stdout ES_V4_SDK (2026-08-30)

- [x] AUD-G3: Coexistence webhook fields subscribed
  CHECK: node scripts/check-coex-webhook-fields.mjs
  EXPECT: coex_fields_ok
  EVIDENCE: exit 0, stdout coex_fields_ok (2026-08-30)

- [x] AUD-G4: Coexistence unit tests pass
  CHECK: npm test -- coexistence
  EXPECT: tests passed
  CWD: server
  EVIDENCE: 6 files, 22 passed (2026-08-30 P1 follow-up)

- [x] AUD-G5: Full server test suite green
  CHECK: npm test
  EXPECT: tests passed
  CWD: server
  EVIDENCE: 165 files, 1064 passed (2026-08-30 P1 follow-up)

- [x] AUD-G6: Client production build succeeds
  CHECK: npm run build
  EXPECT: build succeeded
  CWD: client
  EVIDENCE: tsc -b && vite build exit 0 (2026-08-30 P1 follow-up)

- [x] AUD-G7: Audit report documents findings and gate counts
  EVIDENCE: `.unlazy/coexistence/audit-2026-08-30/AUDIT_REPORT.md` — P1 follow-up landed; met 11 / unmet 0 / abandoned 0

- [x] AUD-G8: Coexistence webhooks claim/complete/release with field+waba+phone+event keys
  CHECK: node scripts/check-coex-idempotency.mjs
  EXPECT: coex_idempotency_ok
  EVIDENCE: exit 0, stdout coex_idempotency_ok (2026-08-30)

- [x] AUD-G9: Coexistence 20/sec throttle is Redis token-bucket with in-memory fallback
  CHECK: node scripts/check-coex-redis-throttle.mjs
  EXPECT: coex_redis_throttle_ok
  EVIDENCE: exit 0, stdout coex_redis_throttle_ok (2026-08-30)

- [x] AUD-G10: isOnBizApp Graph-checked after any successful connect, not only coexistence modal
  CHECK: node scripts/check-coex-isonbizapp-connect.mjs
  EXPECT: isonbizapp_any_connect_ok
  EVIDENCE: exit 0, stdout isonbizapp_any_connect_ok (2026-08-30)

- [x] AUD-G11: Missing phone_number_id with 2+ active numbers fail-closes (never pick latest)
  CHECK: node scripts/check-coex-fail-closed-routing.mjs
  EXPECT: coex_fail_closed_routing_ok
  EVIDENCE: exit 0, stdout coex_fail_closed_routing_ok (2026-08-30)
