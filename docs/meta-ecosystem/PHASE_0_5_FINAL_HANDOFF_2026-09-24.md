# Phase 0–5 final handoff and testing runbook

**Recheck date:** 24 Sep 2026  
**Scope:** the agreed Meta ecosystem plan through Phase 5. Phase 6/7 are not included.  
**Plan file:** unchanged.

## Final answer

Phase 0–5 is complete at the agreed **code and local-verification level**. The hardening pass after the previous audit is implemented, migrated locally, type-checked, built, and covered by regression tests.

Phase 0–5 is **not live-Meta complete**. Meta App Review, non-WhatsApp permissions, Page/Instagram webhook subscriptions, production OAuth callback registration, real Meta events, and customer-host inbound proof are still open.

Therefore:

- **Yes:** local/internal testing can start now.
- **Yes:** Meta test-mode testing can start after the Meta prerequisites below are configured.
- **No:** do not call the product customer-production-ready or claim live Facebook/Instagram/Ads proof yet.

## What changed after the previous plan/audit

### Phase 0 — Foundation

- Instagram webhook objects are admitted by the HTTP route.
- Signature validation happens before Page/Instagram dispatch.
- Page and Instagram events stay out of the WhatsApp processor.
- Existing durable claim/complete behavior remains in place.
- WhatsApp number isolation and embedded workers remain unchanged.

### Phase 1 — Lead Ads

- Page-only Lead Ads flow remains usable without an active WhatsApp number.
- Phone-less leads remain Lead rows with `contactId = null`; no fake phone is created.
- Meta attribution IDs are retained: `metaLeadId`, `metaFormId`, `metaAdId`, `metaAdSetId`, and `metaCampaignId`.
- Human-readable form/ad names are not yet fetched/rendered; IDs are the current reliable attribution identity. This is a medium UX enhancement, not a routing, tenancy, or consent blocker.
- Duplicate `leadgen_id` delivery remains idempotent.
- WhatsApp follow-up remains fail-closed on phone, consent, and approved-template requirements.

### Phase 2 — CTWA

- Existing referral parsing and WhatsApp source/ad chip are preserved.
- No new live-ad claim was made; real click proof is still required.

### Phase 3 — Messenger

- Facebook Page/Messenger remains a separate channel and inbox.
- 24-hour messaging guard and no-WhatsApp-template behavior remain intact.
- Facebook inbox routes now use the full inbox shell.

### Phase 4 — Instagram

- IG-only keyword automations work without a WhatsApp number.
- WhatsApp automation remains scoped to the selected WhatsApp number.
- Cross-organization Page/Instagram channel takeover now returns `409` without deactivating the other organization.
- Provider comment timestamps are persisted for the seven-day private-reply window.
- Private replies use an atomic database claim to prevent concurrent duplicate sends.
- Instagram inbox/comment routes, mobile navigation, labels, controls, placeholder, and composer accents were hardened.
- Remaining deliberate ceilings: comment-to-DM origin linking, persisted `live_comments` broadcast state, and provider idempotency recovery after a process crash between claim and send.

### Phase 5 — Ads read

- Read-only account discovery and explicit account selection are available.
- Insights remain last 7 days with `7-day click / 1-day view` labeling.
- Snapshot, dashboard recap, account identity, and Ads Manager link use the selected account.
- Disconnecting/changing the Page no longer serves a mismatched fresh snapshot.
- No ad create, edit, pause, budget, audience, or `ads_management` feature was added.

## Final recheck follow-up

An independent recheck found three genuine edge cases in the hardened paths. They are now fixed:

- Instagram comments fall back to the webhook entry timestamp when the comment value has no timestamp.
- Converting a WhatsApp keyword automation to an Instagram keyword explicitly writes `whatsappNumberId = null`.
- A linked Instagram ownership `409` now propagates instead of being hidden behind a successful Page connect.

The same recheck confirmed that the Ads account picker and Settings Facebook HTTPS/return-path guard were already present.

## Verification evidence

Completed:

- Full server suite: **187 files, 1,181 tests passed** after the final follow-up fixes.
- Focused server Phase 0–5 gate: **13 files, 78 tests passed**.
- Full client suite: **46 files, 206 tests passed**.
- Focused client Meta gate: **4 files, 14 tests passed**.
- Server and client TypeScript checks passed.
- Server, client, and admin production builds passed.
- Local API, webhook health, client, and admin returned HTTP `200`.
- Public ngrok webhook challenge returned HTTP `200` with body `ping`.
- Additive local migrations applied successfully:
  - `20260924150000_ig_keyword_automation_scope`
  - `20260924160000_lead_ads_attribution`

Not proven:

- Real Page OAuth and Page webhook delivery.
- Real Lead Ads, Messenger, Instagram DM/comment/private-reply, or Ads Insights events.
- Production OAuth callback and production Page/Instagram subscriptions.
- New customer-host WhatsApp inbound reply.
- Customer-host restore drill.
- Browser visual smoke through the forwarded Codespace URL; it stopped at GitHub sign-in and needs manual browser takeover.

## Local testing: start here

From the repository root:

```bash
bash start.sh
```

Expected local services:

- Client: `http://localhost:3000`
- Admin: `http://localhost:3001`
- API: `http://localhost:8000`
- Public webhook: the URL printed by `start.sh`

Health checks:

```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/whatsapp/webhook/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001
```

For WhatsApp inbound, use a **new** reply from a real test phone. Outbound success alone does not prove inbound. Confirm `totalReceived` increases and the message appears only in WhatsApp Inbox.

## Meta test-mode prerequisites

Before online Page/Instagram/Ads testing, configure the same Meta app used by `META_APP_ID`:

1. Add the tester/admin Facebook account to the app and give it access to a test Page.
2. Link a Professional Instagram account to that Page.
3. Add the HTTPS OAuth callback:
   - `https://app.samyoj.com/settings/facebook/callback`
   - the actual HTTPS Codespace preview callback during development.
4. Resolve App Review/use-case access for:
   - `pages_show_list`
   - `pages_manage_metadata`
   - `pages_read_engagement`
   - `pages_messaging`
   - `leads_retrieval`
   - `instagram_basic`
   - `instagram_manage_messages`
   - `instagram_manage_comments`
   - `ads_read`
5. Do **not** add `ads_management` for this read-only scope.
6. Subscribe the callback to:
   - Page: `leadgen,messages`
   - Instagram: `messages,comments,live_comments`
7. Share an active test ad account with the connected Page.
8. Create a test Instant Form and ensure the test account can submit it.

Meta Development mode is sufficient for app-role/test-user testing. It is not customer-production approval.

## Online test sequence and pass criteria

### 1. Page and Lead Ads

- Connect the test Page from Settings over HTTPS.
- Submit a test Instant Form using Meta’s Lead Ads testing tool.
- Confirm exactly one `META_ADS` Lead in the correct organization.
- Repeat the same delivery and confirm no duplicate Lead.
- Test email-only, no-phone, phone-without-consent, and phone-with-consent cases.
- Confirm no WhatsApp template is sent unless phone, auditable consent, active number, and approved template all exist.
- Confirm attribution IDs appear on the stored Lead when Meta returns them.

### 2. Messenger

- Send a new test-user message to the Page.
- Confirm it appears only in Facebook Inbox.
- Reply within 24 hours.
- After the service window closes, confirm sending is blocked and WhatsApp templates are not offered as a workaround.

### 3. Instagram

- Send a new Instagram DM and confirm it appears only in Instagram Inbox.
- Comment `PRICE` on a test post.
- Confirm the comment appears in Comments and the configured IG keyword sends at most one private reply.
- Repeat the webhook/private-reply action and confirm there is no second send.
- Reply in the resulting DM and confirm the 24-hour window starts only after that reply.
- Test an older-than-seven-day comment and confirm private reply is blocked.
- Confirm a WhatsApp keyword does not fire on an Instagram comment.

### 4. Ads read

- Open Facebook → Ads.
- Select the intended account when more than one account is available.
- Record account ID, period, attribution label, spend, impressions, clicks, leads, and CPL.
- Compare with Ads Manager for the same account and period.
- Confirm zero-lead CPL displays `—`.
- Confirm no-account/permission states do not display fake zero spend.
- Confirm no Samyoj control can create, pause, edit, or budget an ad.

### 5. WhatsApp regression

- Send a new phone reply through the public HTTPS webhook.
- Confirm `totalReceived` increments.
- Confirm it appears only in WhatsApp Inbox.
- Confirm Facebook and Instagram channels do not receive the message.

## Evidence to record

For every online test, record:

- UTC timestamp
- organization/test account identifier
- Page ID, Instagram account ID, ad account ID, or leadgen ID as applicable
- screen/result observed
- relevant API status and safe response summary
- duplicate/retry result

Never record access tokens, App Secret, `.env` contents, or full signed webhook headers in the report.

## Remaining phases and production gate

Phase 6 Analytics and Phase 7 Portfolio/Channels remain unbuilt by design. Posts, Reels, Stories, Facebook publishing/scheduling, Ads Manager mutation, audiences, CAPI, live WebRTC transfer, and TARGET billing are also outside this handoff.

Before customer production, complete Meta approval, production callback/subscriptions, the real event sequence above, token expiry/reauthorization proof, customer-host restore verification, and the browser visual smoke. Current customer-production status remains **NO**.
