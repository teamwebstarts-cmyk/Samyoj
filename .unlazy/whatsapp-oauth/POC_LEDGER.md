# PoC ledger — findings vs current code (2026-08-25)

Do **not** rebuild rows marked BUILT / FIXED. Document EXTERNAL.

| # | Finding | PoC (current code) | Status | Action |
|---|---------|-------------------|--------|--------|
| 1 | Popup stays open / dashboard inside popup | `/callback/popup` route, marker, `completeOAuthPopupFlow` | **BUILT** | No redo |
| 2 | Consent omit auto-opts-in | `contactCreateConsentFields` → `optedIn: false` | **BUILT** | No redo |
| 3 | Secrets in `.env.example` | Placeholders only | **BUILT** | No redo |
| 4 | Settings no success toast | `toastSuccess` on Settings connect | **BUILT** | No redo |
| 5 | Meta Development mode / App not active | Meta dashboard App Mode | **EXTERNAL** | Checklist only |
| 6 | Meta Valid OAuth Redirect URI for `/callback/popup` | Server allowlist OK; Meta console must list URL | **EXTERNAL** | Checklist in DEV_SETUP |
| 7 | Embedded Signup v4 migration | Still `/dialog/oauth` | **DEFERRED** | Not this pass |
| 8 | `client_secret` in query string | POST + form body in `meta.service.ts` | **FIXED** | Done |
| 9 | JWT HttpOnly cookies | sessionStorage Pick A; cookies = SAMYOJ-3 | **DEFERRED** | Do not rewrite AUTH |
| 10 | Inbound stack / webhook health | `start.sh` up; challenge + webhook OK; `totalReceived: 49` historical | **OPS DONE** | Fresh phone reply still manual |
| 11 | Email verification theater | Register → `emailVerifiedAt: null`, `emailVerified: false` | **FIXED** | Login still allowed |
| 12 | Live Meta browser G7 | Cannot automate Meta login here | **EXTERNAL** | User manual steps |

## Code gaps closed this pass
- #8 Meta token exchange uses POST body (no secret on URL)
- #11 Register no longer auto-verifies email
- #5/#6 notes in `docs/DEV_SETUP_CHECKLIST.md`

## Still needs a human / Meta
- Add `{origin}/settings/whatsapp/callback/popup` in Meta Valid OAuth Redirect URIs
- Manual Connect: popup should close + parent refresh
- Meta Live / Tester for second FB account (“App not active”)
- One new phone reply to prove inbound increment
- SAMYOJ-3 cookies + Embedded Signup v4 — deferred by product rule
