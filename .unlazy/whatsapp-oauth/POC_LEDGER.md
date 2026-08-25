# PoC ledger — findings vs current code (2026-08-25)

Do **not** rebuild rows marked BUILT / FIXED. Document EXTERNAL.

| # | Finding | Status | Notes |
|---|---------|--------|-------|
| 1 | Popup OAuth | **BUILT** | No redo |
| 2 | Consent omit → optedIn false | **BUILT** | No redo |
| 3 | `.env.example` secrets | **BUILT** | No redo |
| 4 | Settings success toast | **BUILT** | No redo |
| 5 | Meta Dev mode / App not active | **EXTERNAL** | Meta console |
| 6 | Meta Valid OAuth URI `/callback/popup` | **EXTERNAL** | Meta console |
| 7 | Embedded Signup v4 | **DEFERRED** | Product |
| 8 | `client_secret` in query | **FIXED** | POST body |
| 9 | JWT HttpOnly cookies | **DEFERRED** | SAMYOJ-3 |
| 10 | Inbound stack / challenge | **OPS DONE** | Fresh phone reply still manual |
| 11 | Email verify theater | **FIXED** | `emailVerifiedAt: null` |
| 12 | Live Meta browser G7 | **EXTERNAL** | Manual |
| 13 | Startup warn “configure Meta in Settings” | **FIXED** | Platform `.env` only wording |
| 14 | Webhook verify_token `!==` | **FIXED** | SHA-256 + `timingSafeEqual` |
| 15 | Stale docs (AUTH/STATUS/skills/README) | **FIXED** | Aligned to code |

## Still needs a human / Meta / Phase 2
- Meta redirect URI + Connect popup test + Live/Tester
- One new phone reply
- SAMYOJ-3 cookies, TARGET billing, Embedded Signup v4 — deferred
