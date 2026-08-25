# WhatsApp OAuth popup and readiness review — 2026-08-25

## Verdict

The popup-return defect was a real client lifecycle bug and is fixed in code, but
the product is not customer-production-ready until Meta app access, Embedded Signup
versioning, credential handling, and live webhook behavior are verified.

## Scope

Reviewed the current WhatsApp connect path from Dashboard and Settings through the
Meta OAuth callback, including popup result delivery, redirect allowlisting, token
handoff, multi-number persistence, and the documented production risks.

## Confirmed working in code

- The platform App ID and App Secret are read from server environment configuration
  (`server/src/config/index.ts:42-48`); normal users are not given credential fields.
- The OAuth URL uses the configured platform App ID and WhatsApp permissions
  (`server/src/modules/whatsapp/meta.service.ts:262-275`).
- The callback validates the signed state and the signed organization/user owner
  before exchanging the code (`server/src/modules/whatsapp/routes.ts:189-229`).
- Multiple Meta-visible phone numbers can be selected and saved independently
  (`server/src/modules/whatsapp/routes.ts:242-305` and `316-359`).
- The opaque pending token keeps the Meta access token server-side
  (`server/src/modules/whatsapp/connect-pending.ts:39-42`).
- The callback is outside the protected route so Meta's `code` and `state` can be
  read before authentication hydration (`client/src/App.tsx:65-70`).
- New Contacts and Inbox-created records are now fail-closed for campaign consent:
  omitted or unchecked consent produces `optedIn: false` without an invented audit
  source (`server/src/modules/contacts/consent.ts:62-69`).

## Fixed this pass

The browser could lose `window.name` and `window.opener` after Meta's cross-origin
redirect. The callback then believed it was a normal page and navigated inside the
popup instead of publishing the result and closing.

- Added a dedicated `/settings/whatsapp/callback/popup` route.
- Added a short-lived local-storage popup marker as a second lifecycle signal.
- Added cleanup for success, failure, cancellation, blocked-popup fallback, and
  closed-popup polling.
- Centralized popup callback URL creation for Dashboard, Settings, and the shared
  connect hook.
- Preserved the popup callback path when authentication hydration must redirect to
  Login.
- Allowed both the new popup callback and the old callback path server-side for
  backward compatibility.
- Removed real credentials from the tracked `server/.env.example`.

## Fixed after PoC ledger (no redo of built items)

PoC: `.unlazy/whatsapp-oauth/POC_LEDGER.md` — only GAP rows were touched.

- Token exchange / long-lived: `client_secret` sent via POST form body (not query URL).
  Test: `meta-token-exchange.test.ts`.
- Register honesty: `emailVerifiedAt` stays null; API returns `emailVerified: false`;
  verification email attempted; login still allowed (no hard gate — product choice).
- DEV_SETUP checklist: popup redirect URI + Meta Development-mode tester note.
- Ops: `bash start.sh` — API/client/admin up; public challenge `ping`; webhook
  registered; health `webhookConfigured: true` (prior `totalReceived: 49`; fresh
  phone reply still needed to prove a new increment).

## Still EXTERNAL (not solvable in Samyoj code alone)

1. Meta App Mode Live / App Review / second-account Tester invite
2. Exact Valid OAuth Redirect URI registration in the Meta console
3. Live browser Connect popup proof (human G7)
4. Fresh phone reply to prove a new `totalReceived` increment
5. HttpOnly cookies (SAMYOJ-3) — deferred by product rule
6. Embedded Signup v4 migration — deferred (large; ~2026-10-15)

## Critical / high findings still requiring external or separate work

1. **Meta app is still in Development mode**
   - Evidence: the supplied Meta dashboard screenshot explicitly shows
     `Mode: In development`.
   - Impact: non-role customer Facebook accounts cannot authorize the app. This
     explains why the first account works and the second account fails.
   - Fix: add a tester for development testing, or complete Business Verification,
     App Review/Advanced Access, Tech Provider setup, and switch the main app Live
     before customer onboarding.
   - Verify: test with a Facebook account that is not an app role after the app is
     Live.

2. **Exact popup callback must be registered in Meta**
   - Evidence: client now requests
     `/settings/whatsapp/callback/popup`; server accepts it in
     `connect-oauth-state.ts:13-16`.
   - Impact: if Meta's Valid OAuth Redirect URIs does not contain the exact
     environment URL, Meta will return a redirect mismatch after app access is
     fixed.
   - Fix: register the exact HTTPS production popup callback, plus the exact local
     or Codespaces test callback. Keep the base callback only as fallback.
   - Verify: Meta authorization reaches the popup callback and the browser returns
     to the originating page without manual refresh.

3. **Current OAuth implementation needs the Embedded Signup v4 migration**
   - Evidence: `meta.service.ts` still builds `/dialog/oauth`.
   - Impact: may stop working after Meta's documented deprecation window (~2026-10-15).
   - Fix: migrate to Embedded Signup v4 when scheduled; do not mix with popup lifecycle.
   - Verify: Integration Helper + external-business onboarding test.

4. **~~Meta token exchange places client_secret in the request URL~~ → FIXED**
   - Now POST form body in `meta.service.ts`.

5. **Live JWTs remain readable by JavaScript**
   - Evidence: `sessionStorage` Pick A (SAMYOJ-49). Cookies = SAMYOJ-3 (deferred).

6. **Inbound stack up; fresh phone proof still manual**
   - Infra verified 2026-08-25 via `start.sh` (challenge + registration).
   - A **new** phone reply is still required to prove a fresh `totalReceived` bump.


## Development-only test app warning

`Samyoj-Test1` is a separate child app with its own App ID, roles, settings, and
credentials. The current server reads one `META_APP_ID` from `.env`; opening the
test app in Meta does not switch Samyoj to it. Use the main `Samyoj` app for the
current test, or configure a separate staging environment before testing the child
app.

## Manual gate

The code can prove result publication and route contracts, but it cannot prove a
real Meta browser session from this environment. A human must test:

1. Existing Facebook account: connect a number and confirm the opener refreshes.
2. Second Facebook account in Development mode: confirm the expected role-gate
   behavior, then add it as Tester and confirm authorization proceeds.
3. Popup success: callback closes the popup and the original Settings/Dashboard
   page refreshes its number list.
4. Popup cancel/error: popup closes and the original page stops its connecting
   state without a manual refresh.
5. Live customer-like account after Meta approval: connect a different Business
   Portfolio/WABA and verify isolated Inbox, Contacts, Campaigns, and webhook
   routing.
