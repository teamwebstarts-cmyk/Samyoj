# Samyoj Meta ecosystem audit

**Audit date:** 24 Sep 2026  
**Scope:** current repository, local runtime evidence, current Meta app configuration, phase specifications, and the vendor benchmark.  
**Change policy:** the follow-up hardening pass changed application code/schema and applied additive migrations to the local test database only. No Meta settings or customer production configuration were changed.

**Final testing handoff:** [PHASE_0_5_FINAL_HANDOFF_2026-09-24.md](PHASE_0_5_FINAL_HANDOFF_2026-09-24.md)

## Executive verdict

Samyoj has a substantial WhatsApp product and code for Facebook Page/Messenger, Lead Ads, Instagram messaging/comments, and read-only Ads Insights. Phase 0–5 code hardening is complete and verified locally, but it is **not customer-production-ready** and the non-WhatsApp Meta surfaces are not live-proven.

The previous audit found a Phase 4 HTTP admission blocker. That blocker has now been corrected: `object: "instagram"` passes the HTTP allow-list/signature path and reaches the non-WhatsApp dispatcher. The remaining gap is external proof through Meta, not an acknowledged code blocker.

The current Meta app is also the dominant live blocker:

The dashboard screenshots captured on 24 Sep 2026 are saved in
[META_APP_CONFIGURATION_2026-09-24.md](META_APP_CONFIGURATION_2026-09-24.md). They confirm
the relevant use-case cards and show several Page permissions as ready for testing, but
`instagram_basic` and `instagram_manage_messages` still show **Add to App** and
`instagram_manage_comments` is not confirmed. This explains the current Invalid Scopes error
on Page reconnect; it does not invalidate an already-saved Page connection.

- app `1766674304665017` / **Samyoj** is in Development mode and is not Live;
- only WhatsApp privileges are approved;
- Page/Messenger/Lead/Ads privileges are rejected or have incomplete review requirements;
- Instagram privileges are absent from the live privilege list;
- only `whatsapp_business_account` is subscribed;
- the production Facebook callback is missing from the OAuth allow-list.

The honest status is: **WhatsApp internal testing: usable; Meta phases 0–5: code-complete for the agreed scope and locally verified; live Meta ecosystem: blocked by permissions/assets/proof; customer production: no.**

## Scoring method

The score is split so a strong unit-test result cannot hide a missing Meta grant or live proof:

- **Code score:** implementation completeness against the agreed phase scope.
- **Live score:** verified Meta configuration and real end-to-end proof.
- **Confidence:** confidence in the audit conclusion, not confidence that Meta will approve a request.

| Area | Code score | Live score | Confidence | Status |
|---|---:|---:|---:|---|
| Phase 0 Foundation | 8/10 | 4/10 | High | Page/Instagram admission and non-WABA routing are hardened; public Meta delivery is pending |
| Phase 1 Lead Ads | 8/10 | 1/10 | High | Code exists with attribution IDs; live Page/Lead permissions and webhook are blocked |
| Phase 2 CTWA | 8/10 | 2/10 | High | WhatsApp referral/chip path exists; real ad proof is pending |
| Phase 3 Messenger | 7/10 | 1/10 | High | Separate inbox exists; live Page/message proof is blocked |
| Phase 4 Instagram | 7/10 | 1/10 | High | HTTP ingress, IG-only automation, ownership, timing, and claim paths are hardened; live proof is pending |
| Phase 5 Ads read | 8/10 | 1/10 | High | Read-only snapshot and explicit account picker exist; `ads_read` and live comparison are blocked |
| Phase 6 Analytics | 0/10 | — | High | Not built |
| Phase 7 Portfolio | 4/10 | — | High | Existing separate Settings tabs; unified Channels list not built |
| Meta ecosystem overall | 6/10 | 1.5/10 | High | Code hardening is materially improved; not production-ready without Meta/live proof |

## Evidence classification

### Confirmed in current code

- `Channel`, `ContactPlatformIdentity`, channel-scoped conversations, Instagram comments, and Ads snapshots exist in `server/prisma/schema.prisma`.
- Facebook OAuth/Page token persistence, Page subscription attempt, Lead Ads retrieval, idempotent lead storage, and Page-only `META_ADS` listing exist in:
  - `server/src/modules/facebook/routes.ts`
  - `server/src/modules/facebook/save-page-channel.ts`
  - `server/src/modules/facebook/leadgen-ingest.ts`
  - `server/src/modules/leads/routes.ts`
- CTWA referral parsing and the WhatsApp ad chip exist in:
  - `server/src/modules/inbox/ctwa-referral.ts`
  - `server/src/workers/webhook.processor.ts`
  - `client/src/components/inbox/ChatHeader.tsx`
- Facebook Messenger has a separate channel-scoped inbox, assignment/status/notes, text sending, and a 24-hour send guard:
  - `server/src/modules/facebook/messenger-ingest.ts`
  - `server/src/modules/facebook/messenger-inbox.routes.ts`
  - `client/src/pages/FacebookInboxPage.tsx`
- Instagram has text ingestion/sending, comments, hide, one private reply, and keyword matching code:
  - `server/src/modules/instagram/ingest.ts`
  - `server/src/modules/instagram/comment-ingest.ts`
  - `client/src/pages/InstagramInboxPage.tsx`
  - `client/src/pages/InstagramCommentsPage.tsx`
- Ads is read-only: account lookup, last-7-day Insights, snapshot storage, dashboard recap, and Ads Manager link:
  - `server/src/modules/facebook/ads-insights.ts`
  - `client/src/pages/FacebookAdsPage.tsx`
  - `client/src/components/dashboard/MetaAdsRecap.tsx`
- Normal users do not receive App ID/App Secret fields. Platform credentials remain server-side.
- Standalone workers intentionally exit 1; workers are embedded in `server/src/index.ts`.

### Proven only by isolated/unit evidence

- `server/src/modules/instagram/instagram.test.ts` calls `dispatchInstagramWebhookFields()` directly.
- `server/src/modules/whatsapp/webhook-phase0-router.test.ts` proves Page/lead dispatch behavior in mocked code paths.
- Ads tests prove parsing, account selection, zero-delivery handling, and read-only route shape.

These tests do not prove Meta can deliver a signed Instagram/Page webhook to the public HTTP route.

### Not proven

- A real Page OAuth connection using the current live app.
- A real Lead Ads test tool event creating a Lead in the correct organization.
- A real Messenger inbound/outbound conversation.
- A real Instagram DM, comment, private reply, or 24-hour thread.
- A real ad account snapshot matching Ads Manager.
- A new customer-host WhatsApp reply incrementing `totalReceived`.
- Backup restore on the customer host.

## Phase-by-phase review

### Phase 0 — Foundation

**Implemented**

- Platform-independent `Channel` and identity structures exist.
- Page and Instagram dispatcher code exists separately from WhatsApp.
- Webhook durability primitives and organization/channel resolution exist.
- WhatsApp remains number-scoped and the worker remains embedded.

**Remaining considerations**

1. Channel foreign keys are single-column references. Application queries scope organizations, but the database does not itself prevent an accidental channel belonging to another organization from being referenced.
2. Live signed Page/Instagram delivery is still unproven.

**Score:** 8/10 code, 4/10 live.  
**Confidence:** High.

### Phase 1 — Lead Ads

**Implemented**

- Facebook Page connect and encrypted token storage.
- Page leadgen subscription attempt.
- Lead retrieval and Contact/Lead creation with `source = META_ADS` and `metaLeadId`.
- Page-only Lead Ads listing path without requiring a WhatsApp number.
- Duplicate lead protection and consent-safe optional WhatsApp follow-up.
- Pipeline source filter and no-phone/no-consent messaging.

**Gaps**

1. No live Page/Lead permission is granted in the current Meta app.
2. No live `page` webhook subscription exists.
3. The lead row now retains provider IDs from `fetchLeadgenLead()`: form, ad, ad set, and campaign. Form name is still not fetched because it is not needed for the Phase 1 pipeline.
4. The phase document still says Page-only listing and source filtering are missing in `docs/meta-ecosystem/phases/01-lead-ads.md:40-48`.
5. The agreed sidebar currently has Facebook Inbox/Ads, not a `Facebook → Leads` child. The product can still reach the pipeline through the Page settings card, but this differs from the older Phase 1 UI target.
6. Exact least-privilege scopes remain an App Review decision. Do not add `ads_management` merely because a review screen lists it as a dependency; confirm the exact operation and Meta response.

**Score:** 7/10 code, 1/10 live.  
**Confidence:** High code; high confidence that live proof is blocked.

### Phase 2 — CTWA

**Implemented**

- Referral metadata is parsed and persisted on the WhatsApp conversation.
- The first referral is not overwritten on repeat webhook delivery.
- Inbox DTO and header display the WhatsApp ad/source chip.
- The path stays WhatsApp-only and does not mix Instant Form leads with Click-to-WhatsApp chats.

**Gaps**

- No real Click-to-WhatsApp ad click has been observed.
- No broader ad attribution or conversion loop exists.
- The 72-hour referral/FEP policy hint described in the older roadmap is not a complete analytics/notification system.

**Score:** 8/10 code, 2/10 live.  
**Confidence:** High.

### Phase 3 — Messenger

**Implemented**

- Facebook Page/Messenger uses its own channel and conversation path.
- PSID identity mapping, inbound messages, outbound text, assignment, status, notes, search/list, and a 24-hour guard exist.
- The UI intentionally does not offer WhatsApp templates outside WhatsApp.

**Gaps**

- Current live app has no approved `pages_messaging`/Page scope path and no `page` webhook subscription.
- No real Page test account/message has been proven.
- Facebook and Instagram inbox routes now use the full-viewport `isInboxRoute()` predicate; a browser regression is still required.
- Placeholder and primary composer accents are now channel-specific; comment-origin composer linking is still outside Phase 0–5 scope.

**Score:** 7/10 code, 1/10 live.  
**Confidence:** High.

### Phase 4 — Instagram

**Implemented in isolation**

- Page-linked Professional Instagram connection path.
- Separate Instagram inbox with channel identities and 24-hour send enforcement.
- Comments list, hide, one private reply within seven days, and keyword matching.
- UI does not offer WhatsApp templates for Instagram.
- Comment search debounce and friendly connect/empty states exist.

**Hardening completed in this pass**

- `POST /api/whatsapp/webhook` now admits `object: "instagram"` after the same signature gate and routes it to the non-WhatsApp dispatcher.
- IG-only keyword automations can be listed/created/edited/deleted without a WhatsApp number; WhatsApp rows remain number-scoped.
- Active Page/Instagram ownership is rejected across organizations instead of silently deactivating another organization.
- Comment provider timestamps are persisted; private-reply sends use an atomic database claim; the crash-between-claim/send ceiling remains documented.
- Lead Ads fetch and persistence retain `form_id`, `ad_id`, `adset_id`, and `campaign_id`.
- Ads read has an explicit account list/selection path and the UI no longer silently hides which account is selected.

These are code-level results only. Signed/public Meta delivery and App Review are still unproven.

**Other gaps**

1. The composer banner specified for comment-origin conversations is not implemented because the comment-to-DM identity is not stored.
2. `live_comments` has no persisted broadcast/live state; live private-reply support remains a deliberate ceiling.
3. Linked IG subscription failure can leave the Channel saved while subscription failure is only logged; reconnect/retry UX remains the recovery path.

**Score:** 7/10 code after hardening, 1/10 live.  
**Confidence:** High.

### Phase 5 — Ads read

**Implemented**

- Read-only account listing, explicit account selection, and Insights fetch.
- Last 7 days with explicit `7-day click / 1-day view` attribution label.
- Spend, impressions, clicks, Meta leads, and CPL snapshot.
- No-account state does not fake a zero chart.
- Dashboard recap uses the same endpoint/snapshot.
- No ad creation, pause, budget, or `ads_management` UI.

**Gaps**

1. Live `ads_read` is rejected and Marketing API access is incomplete.
2. No ad account is shared with the connected Page in the current test setup.
3. Live `ads_read` is not proven and no real Ads Manager comparison has been performed.
4. The Facebook → Ads navigation remains visible before a live asset exists; the page uses an honest no-account/permission empty state rather than fake rows.

**Score:** 7/10 code, 1/10 live.  
**Confidence:** High.

## UI/UX audit

### Strengths

- Separate Facebook and Instagram inboxes are clear and avoid mixing channel policy.
- Connect chips reuse existing visual language and are OWNER/ADMIN gated.
- Ads page distinguishes Meta spend from Samyoj revenue and avoids fake ₹0 when no account exists.
- Empty states now offer direct connect/reconnect actions.
- Instagram comments explain the one-private-reply/seven-day/24-hour sequence.
- No App ID, App Secret, `.env`, or developer override is exposed.

### Remaining UI gaps

- Facebook/Instagram inbox routes now use the full-viewport shell predicate; browser smoke proof is still pending.
- Settings/shared connect flow has HTTPS and safe return-path guards; live OAuth proof is still blocked by Meta App Review.
- Facebook/Instagram navigation is always visible before a live Page/IG asset exists. Decide whether to keep the current honest empty-state model or gate the groups until connected; do not leave this as an accidental mismatch between specs.
- Mobile More includes Instagram Inbox and Comments.
- Comments search and hide/private-reply controls now have accessible labels; failure recovery remains toast + reload.
- Unread badge aggregation is WhatsApp-only.
- Facebook/Instagram composer and placeholder accents are channel-specific.
- Settings has separate tabs, not the unified Channels portfolio promised by Phase 7.

## Capability matrix: what Samyoj does and does not ship

| Capability | Meta API possible | Samyoj current status | Product decision |
|---|---|---|---|
| WhatsApp Cloud messaging/templates/flows | Yes | Implemented; internal testing | Keep |
| Facebook Page connect | Yes | Code exists; live blocked | Phase 1 |
| Lead Ads → Lead/Contact | Yes | Code exists; no live proof | Phase 1 |
| Click-to-WhatsApp referral | Yes | Code exists; no real ad proof | Phase 2 |
| Messenger DM inbox | Yes | Code exists; no live proof | Phase 3 |
| Instagram DM inbox | Yes | Code exists; HTTP gate hardened; no live proof | Phase 4 |
| Instagram comments/hide/private reply | Yes | Code/UI exists; no live proof | Phase 4 |
| Instagram feed posts | Yes with content-publish permission | Not implemented | Later, only if product asks |
| Instagram carousel | Yes | Not implemented | Later |
| Instagram Reels | Yes | Not implemented | Later |
| Instagram Stories | API capability exists with limitations | Not implemented | Later; verify current Meta limits first |
| Facebook Page posts | Yes | Not implemented | Later |
| Facebook Page scheduling | Yes with publishing permission | Not implemented | Later |
| Facebook Page comments | Yes | Not implemented | Later |
| Social content calendar/scheduling | Yes through separate publishing APIs | Not implemented for Meta; local Content Studio is not Meta publishing | Later |
| Ads Insights read | Yes | Narrow read-only snapshot exists; no live proof | Phase 5 |
| Ad creation/editing/pause/budget | Yes with Marketing API permissions | Not implemented | Explicitly out of v1 |
| Custom/Lookalike Audiences | Yes with consent and Marketing API | Not implemented | Not Phase 6/7 |
| Instagram Insights | Yes | Not implemented | Later |
| Conversions API closed-loop attribution | Yes | Not implemented | Later |
| Cross-platform Customer 360 | Not supplied by Meta automatically | Not implemented | Later; merge by phone/email/agent only |
| Shops order management | Restricted/not a safe current product assumption | Not implemented | Do not schedule |

**Important:** “Meta API possible” is not “Samyoj implemented.” Posts, Reels, Stories, Facebook scheduling, audiences, CAPI, and ad creation must not be advertised as existing.

## Competitive read

The existing benchmark remains directionally correct:

- Respond.io, Wati, Interakt, SleekFlow, ManyChat, Gallabox, Kommo, and Chatwoot establish WA + IG DM as table stakes for an omnichannel inbox.
- Comment-to-DM is common in ManyChat, Wati, Respond.io, SleekFlow, Interakt, Gallabox, and Kommo. Samyoj has the intended narrow private-reply behavior but not live proof.
- Native Lead Ads ingestion is a differentiator against Respond.io and Wati, while Interakt, Gallabox, Kommo, SleekFlow, and AiSensy document similar ingestion. Samyoj’s code direction is competitive, but live permission/reliability proof is missing.
- Ads spend/CPL read is a useful v1 boundary. Mature tools still rely on Meta Ads Manager and do not all clone it.
- Phone/email identity merge, CAPI lifecycle feedback, and richer attribution are where Respond.io/Kommo/Wati narratives go beyond the current product.
- Social publishing is not a universal inbox requirement; the vendor benchmark notes that many vendors point customers to Meta Business Suite. Keeping publishing out of this phase is defensible, but the UI/docs must say so clearly.

**Competitive conclusion:** Samyoj is not missing a hidden requirement to become an Ads Manager clone. It is missing reliable live enablement, working Instagram HTTP ingress, IG-capable automation configuration, and later analytics/portfolio polish. Native Lead Ads plus separate Messenger/Instagram inboxes can be a credible position once proven.

## Exact Meta connection and Phase 5 test runbook

Do not call a code-level test “live proof.” Record each result, timestamp, organization, asset ID, and observed UI/API evidence without storing tokens.

### A. App and OAuth prerequisites

1. Use the app matching server `META_APP_ID`: **Samyoj**, app `1766674304665017`.
2. Resolve the previous review state. Current read-only status says the submission is `UNSUBMITTED`, a previous submission is still in review, and new submission is currently blocked.
3. Finish the use-case, screencast, API precheck, data-use checkup, and test-page requirements shown by App Review.
4. Obtain the required Page, Messenger, Lead Ads, Instagram, and Ads Insights grants. Current live app only has WhatsApp/public profile/openid approved.
5. Add production OAuth redirects:
   - `https://app.samyoj.com/settings/facebook/callback`
   - the production popup callback if that flow is used.
6. Verify privacy, terms, data deletion, support, and contact-email settings are production URLs/identities. Current basic settings include generic Facebook terms/data-deletion URLs and an unverified contact email.
7. Confirm the final least-privilege scope set with Meta. Keep `ads_management` out of Samyoj’s read-only Ads flow unless a separate future product explicitly needs mutations.

### B. Page and Instagram assets

1. Add a test/admin Facebook account as an app role in Development mode.
2. Ensure that account administers a test Page and has the required Page tasks.
3. Connect the Page from Samyoj using an HTTPS origin.
4. Link a Professional Instagram account to that Page in Meta Business Suite.
5. Connect Instagram from Samyoj and confirm the IG Channel is active.
6. Subscribe the Page webhook to `leadgen,messages`.
7. Subscribe the Instagram webhook to `messages,comments,live_comments`.
8. Verify the public HTTPS callback challenge and signed delivery. A 200 response alone is not proof if the route drops the object.

### C. Lead Ads test

1. Create a test Instant Form and use Meta’s Lead Ads testing tool.
2. Record the `leadgen_id` and Page ID.
3. Pass condition: one `META_ADS` Lead in the correct organization, deduplicated on repeated delivery, correct form/field data, and no cross-organization row.
4. Test phone + consent, phone without consent, email-only, and no-contact-field cases.
5. Pass condition: optional WhatsApp follow-up happens only with phone, consent, and an approved template.

### D. Messenger test

1. Send a new message from a test user to the connected Page.
2. Pass condition: it appears only in Facebook Inbox, creates a Page-scoped conversation, and does not enter WhatsApp or Instagram.
3. Reply within 24 hours and confirm delivery.
4. After the window closes, confirm the composer is blocked and does not offer WhatsApp templates as a workaround.

### E. Instagram test

1. Send a new DM from the test Instagram account.
2. Pass condition: it reaches `POST /api/whatsapp/webhook`, passes signature validation, claims a durable event, creates an IG-scoped conversation, and appears only in Instagram Inbox.
3. Comment `PRICE` on a test post.
4. Pass condition: comment appears in Comments and the configured IG keyword sends at most one private reply.
5. Click/reply in the private DM.
6. Pass condition: only then does the 24-hour IG conversation window open.
7. Test a second private-reply click and a comment older than seven days. Both must fail safely without a second Meta send.

### F. Ads read test

1. Share an active ad account with the connected Page/business and ensure it has recent delivery.
2. Open Facebook → Ads and record account ID, period, attribution label, spend, impressions, clicks, leads, and CPL.
3. Compare against Ads Manager for the same account and last-7-day window.
4. Pass condition: ballpark metrics match; zero-lead CPL is `—`; no-account state does not display fake zero spend; dashboard recap uses the same snapshot.
5. Confirm no Samyoj button can create, pause, edit, or budget an ad.

### G. WhatsApp regression

1. Send a **new** reply from a real test phone to the connected business number on the public HTTPS endpoint.
2. Pass condition: `totalReceived` increments, the message is in the WhatsApp Inbox, and no Page/IG channel receives it.
3. Record the public webhook URL and API health response; do not rely on historical counters.

## Critical, high, and medium findings

### Critical/high

1. **Current Meta app cannot complete non-WhatsApp OAuth.**  
   Evidence: Meta read-only review/privilege/subscription checks on 24 Sep 2026; `docs/meta-ecosystem/BLOCKERS.md`.  
   Impact: Page, Messenger, Lead Ads, Instagram, and Ads live flows are blocked.  
   Required next step: resolve App Review/use cases/permissions and production redirects.

2. **External Meta proof is still absent.**  
   Evidence: no signed/public Page, Instagram, Lead Ads, Messenger, or Ads event has been observed in this pass.  
   Impact: code correctness does not prove production delivery or permission readiness.  
   Required next step: execute the runbook with a Meta test user/Page and record asset IDs plus API/UI evidence.

### Medium

- Comment-origin composer banner is absent.
- Atomic private-reply claim still has a crash-between-claim/send ceiling; provider idempotency is the upgrade if recovery is required.
- Current docs/status must stay synchronized with the code-level hardening result.
- API version policy is not deliberate across code/docs; config defaults to `v21.0` while roadmap research discusses v26.0.
- Token expiry/re-authorization behavior is not proven as a production lifecycle.
- A prior runtime review reported a full-suite bootstrap test failure and Admin `:3001` unavailable; these require final verification before being treated as current blockers.

## Phase 6 — Analytics: exact remaining build

Phase 6 is not implemented. It must be a new Analytics page, not a revival of `/reports`; `/reports` currently redirects to Billing.

### Data model

- Add nullable `Lead.amount` money field.
- Set it when an agent marks a lead Won, with validation and clear currency semantics.
- A Won lead without amount displays `—`, never ₹0.
- Do not infer revenue from ad spend, CPL, chat count, or an ad headline.

### Page and data

- Add Analytics under Dashboard in the main rail, not under Facebook.
- Left column: the Phase 5 snapshot for the selected period — spend, Meta leads, CPL.
- Right column: qualified count, won count, and the sum of `amount` only for `stage = WON AND metaLeadId IS NOT NULL`.
- Date filter must apply consistently to both sides.
- Add a platform filter only when that platform inbox/data exists.
- A Click-to-WhatsApp chat without a Lead does not increment the pipeline.
- Do not show one combined ROI or pretend Meta calculated CRM revenue.

### Acceptance tests

- Won Meta lead with no amount renders `—`.
- Setting amount changes only the CRM/pipeline side.
- A WhatsApp ad-chip conversation without a Lead does not increment pipeline totals.
- Left-side numbers match the Phase 5 snapshot for the same period.
- Organization and channel boundaries are enforced in every query.

### Dependencies and decisions before build

- Decide date semantics for local Leads versus fetched Ads snapshots.
- Decide amount currency policy; do not silently mix currencies.
- Decide whether a lead can move to Won without amount and how editing is audited.
- Preserve the separate Meta and Samyoj ledgers.

## Phase 7 — Portfolio/Channels: exact remaining build

Phase 7 is not implemented as specified. Settings currently has separate connection tabs rather than one Channels list.

### UI

- Add a Settings Channels section with grouped rows:
  - WhatsApp numbers
  - Facebook Page
  - Instagram account
- Reuse existing connect actions and role gates.
- Show active/disconnected state, display name, and safe metadata only.
- Never show App ID, App Secret, tokens, or `.env`.
- Deep-link to the existing Facebook/Instagram/WhatsApp connect actions.

### Disconnect and tenancy

- Disconnect is soft (`isActive = false`); history remains.
- Page disconnect must stop new Page leads/Messenger delivery without deleting old data.
- Instagram disconnect must stop new IG delivery without deleting comments/conversations.
- WhatsApp disconnect must retain current soft-disconnect behavior.
- The topbar switcher remains a WhatsApp-number switcher. Do not merge Page/IG assets into that control.
- Do not merge the three inboxes.

### Acceptance tests

- Disconnecting a Page stops new leads but preserves old Leads.
- Disconnecting Instagram preserves comments/conversations.
- WhatsApp disconnect regression remains green.
- Cross-organization channel references are rejected or impossible by query/constraint.
- No secret fields render in any role.

## Explicitly not Phase 6/7

These are separate roadmap decisions, not hidden omissions from the two next phases:

- Instagram/Facebook feed posts, carousels, Reels, Stories, and scheduling.
- Facebook Page post/comment management.
- Ad creation, campaign/ad-set editing, pause, budget, or Ads Manager parity.
- Custom/Lookalike Audiences.
- Instagram Insights.
- Conversions API lifecycle feedback.
- Automatic cross-platform Customer 360 merge.
- Live WebRTC transfer.
- TARGET Razorpay subscriptions/GST billing.

## Verification run

These checks were run after the Phase 0–5 hardening changes and migrations:

- Focused server Phase 0–5 gate: **13 files, 78 tests passed**.
- Full server suite: **187 files, 1,181 tests passed** after the final follow-up fixes.
- Focused client Meta gate: **4 files, 14 tests passed**; full client suite: **46 files, 206 tests passed**.
- Server/client TypeScript checks and server/client/admin production builds passed.
- Local health: API `/health` **200**, webhook health **200**, client `:3000` **200**, Admin `:3001` **200**.
- Public ngrok webhook challenge: **200 `ping`**.
- Browser visual smoke: blocked at the Codespace forwarded-port GitHub sign-in; no manual credentials were supplied.
- No real Page/Instagram event, real Ads snapshot, or new customer-host WhatsApp inbound was observed.

## Production gate list

Before saying “production ready”:

1. Resolve Meta App Review and all required use cases/permissions.
2. Add and verify production Facebook OAuth callbacks.
3. Replace temporary ngrok callback with a stable production HTTPS endpoint.
4. Subscribe and verify Page and Instagram webhooks.
5. Prove one real Lead Ads event, Messenger message, Instagram DM/comment/private reply, Ads snapshot, and new WhatsApp inbound reply.
6. Prove token expiry/reauthorization behavior.
7. Complete the browser visual smoke after the forwarded-port manual sign-in.
8. Verify customer-host restore drill and keep customer production disabled.
9. Keep all out-of-scope capabilities visibly marked as unavailable.

## Audit source notes

Independent read-only review passes were used for backend, frontend, Meta/live configuration, and runtime/production readiness. Their conclusions were reconciled against current source rather than accepted blindly. Where a runtime check was reported by a reviewer but not independently rerun in this audit, it is labeled as requiring final verification rather than presented as a confirmed current failure.
