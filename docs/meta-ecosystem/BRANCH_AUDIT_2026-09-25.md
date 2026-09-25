# Branch audit — Facebook / Instagram / Meta ecosystem

**Branch:** `v8.5.0-phase0-ecosystem`
**Audited:** 2026-09-25 · **Rechecked:** 2026-09-25 (every finding re-verified against source before this revision)
**Mode:** read-only. No application code, migration, or existing document was modified. This audit was the only file added.
**Scope:** the Meta ecosystem work on this branch — Phase 0 (foundation) through Phase 7 (channels): the `Channel` data model, Page/Messenger, Instagram DM + comments, Lead Ads, Click-to-WhatsApp, read-only Ads, Analytics, and Settings → Channels.

**Question this answers:** *is anything missing, skipped, or weaker than the plans claim — and what exactly is the fix?*

Every line number was re-read from this working tree. The recheck pass found and corrected **two** inaccurate citations (noted in §14); no finding was invented, and one candidate finding was removed rather than softened.

---

## 1. Verdict

| Question | Answer |
|---|---|
| Is the Phase 0–5 code surface present and internally consistent? | **Yes.** Every phase's server module exists, its migrations are additive and applied locally, and the focused Meta gate passes (18 files / 96 tests). |
| Is every requirement in the phase plans met? | **Almost.** Of ~47 checked requirements, 5 are unmet. Four were already recorded as deliberate ceilings; **one was not** (`G-03`). |
| Is the code safe to keep building on? | **Yes**, after two things: the outbound channel-resolution bug (`G-02`) and the inline webhook work + health blind spot (`G-01`). |
| Are the existing audits accurate? | **Mostly, but not entirely.** 3 claims overstate what the code does, 2 understate it, 1 document is plainly stale. See §7. |
| Is Meta-live or customer-production proven? | **No** — unchanged from `BLOCKERS.md`. Nothing here changes that. |

**Gap register:** 16 (`G-01` … `G-16`) — each with a solution in §6.
**Documentation drift:** 8 (`D-01` … `D-08`).
**Test-coverage holes:** 9 (`T-01` … `T-09`).
**Previously reported gaps that are already fine:** 4 (`F-01` … `F-04`).

---

## 2. What was actually run (evidence, not opinion)

| Check | Result |
|---|---|
| `cd server && npx tsc --noEmit` | pass (exit 0) |
| `cd client && npx tsc -b --noEmit` | pass (exit 0) |
| `cd server && npx vitest run` | **191 files, 1198 tests passed** |
| `cd client && npx vitest run` | 46 files, 206 tests passed |
| `cd admin && npx vitest run` | 9 files, 19 tests passed |
| Focused Meta gate (`modules/facebook`, `modules/instagram`, `analytics/meta-pipeline.test.ts`, `inbox/ctwa-referral.test.ts`, `whatsapp/webhook-phase0-router.test.ts`, `webhook-signature-gate.test.ts`, `webhook-accept.test.ts`, `webhook-url.test.ts`, `route-hardening.test.ts`, `webhook-dispatcher.test.ts`) | **18 files, 96 tests passed** |
| `audit-score.test.ts` output | `SCORE done=19 remaining=1 out=5 live_unproven=2` |
| `migrate-startup-safe.ts:9` regex | executed the exact pattern in Node — results in `G-13` |
| Exhaustive search for `leadAdsWhatsAppTemplate` | exactly 1 match, server-only (see `G-03`) |
| Exhaustive search for writers of `organization.settings` | 5 writers, none accepts `meta` (see `G-03`) |
| Docker (postgres 16-alpine, redis 7-alpine) | both up, healthy |

External facts were checked against Meta's own documentation rather than recalled (see `F-02`). No database was created, dropped, or written.

---

## 3. Inventory of the branch's Meta surface

| Area | Files | Lines (incl. tests) | Test files |
|---|---|---|---|
| `server/src/modules/facebook/` | 20 | 4251 | 9 |
| `server/src/modules/instagram/` | 6 | 1362 | 1 |
| `server/src/modules/analytics/meta-pipeline.ts` | 1 | 86 | 1 |
| `server/src/modules/inbox/ctwa-referral.ts` | 1 | 74 | 1 |
| `server/src/modules/whatsapp/` (webhook router, dispatcher, signature gate, accept, url, health) | shared | — | 8 |
| Meta migrations `20260923153000` → `20260925010000` | 9 | — | — |
| Client pages: `FacebookInboxPage` (721), `InstagramInboxPage` (727), `FacebookAdsPage`, `InstagramCommentsPage`, `AnalyticsPage`, `FacebookCallbackPage` | — | — | 0 direct |
| Client panels: `FacebookPagePanel`, `InstagramPagePanel`, `WhatsAppChannelsPanel`, `MetaChannelChips` | — | — | 0 direct |

Migrations added by this work:

| Migration | Adds | Notes |
|---|---|---|
| `20260923153000_meta_channel_foundation` | `channels`, `contact_platform_identities`, `ChannelPlatform` enum | additive |
| `20260923160000_meta_lead_ads` | `channels.name`, `leads.channel_id`, `leads.meta_lead_id` | additive |
| `20260923180000_messenger_channel_conversation` | `conversations.channel_id` + unique `(organization_id, channel_id, contact_id)` | additive |
| `20260924010000_instagram_comments` | `instagram_comments` | additive |
| `20260924120000_meta_ads_snapshot` | `meta_ads_snapshots` (one per org, deliberate) | additive |
| `20260924150000_ig_keyword_automation_scope` | **data `UPDATE`** nulling `whatsapp_number_id` on IG keyword automations | intentional; not destructive-SQL-flagged |
| `20260924160000_lead_ads_attribution` | `leads.meta_form_id / meta_ad_id / meta_adset_id / meta_campaign_id` | additive |
| `20260924220000_lead_amount` | `leads.amount DECIMAL(12,2)` | additive |
| `20260925010000_meta_channel_parent_page` | `channels.parent_page_id` + **partial unique index** `(platform, platform_account_id) WHERE is_active = true` + `RAISE EXCEPTION` guard + backfill `UPDATE` | additive + data |

That partial unique index is the database-level single-owner guarantee for an active Page/IG account. It closes the cross-organization connect race that `assertActiveChannelOwnership()` alone could not enforce (`save-page-channel.ts:13-24`).

---

## 4. Phase-by-phase conformance

**met** = implemented and verified · **met (ceiling)** = implemented with a previously documented deliberate limit · **not met** = the plan asks for something the code does not do.

### Phase 0 — Foundation

| Requirement | Status | Evidence |
|---|---|---|
| Add `Channel` + `ContactPlatformIdentity`, keep `WhatsappNumber` | met | `schema.prisma:1115-1205`; migration `20260923153000` |
| Branch the HTTP webhook on `payload.object` after signature | met | `whatsapp/routes.ts:894-903` (object gate), `:937-975` (signature), `:982-1002` (Page/IG branch) |
| Page/IG must not enter the WhatsApp processor | met | `workers/webhook.processor.ts:337-338` |
| Durable claim/complete, no duplicate insert | met | `webhook-dispatcher.ts:59-127`, `:513-540`; `webhook-phase0-router.test.ts` |
| WhatsApp branch unchanged | met | `routes.ts:1004-1043` still persist → queue → ack |
| Page token stored with the existing encrypt helper | met | `save-page-channel.ts:36`, `:145` |

### Phase 1 — Lead Ads

| Requirement | Status | Evidence |
|---|---|---|
| Facebook Login, pick an **existing** Page, save `Channel(platform=FB)` | met | `facebook/routes.ts:93-275`; `save-page-channel.ts:30-134` |
| Subscribe the Page to `leadgen` (+`messages`) | met | `page-client.ts:222-236` |
| Webhook → `GET /{leadgen_id}` → name/phone/email | met | `webhook-dispatcher.ts:663-673`; `leadgen-ingest.ts:51`; `mapLeadgenFields` (`page-client.ts`) |
| Upsert Contact + Lead, `source = META_ADS`, `metaLeadId` unique per org | met | `leadgen-ingest.ts:130-152`; `schema.prisma:1295` |
| Phone-less → `Lead` with `contactId = null`, no fake phone | met | `leadgen-ingest.ts:65-119` |
| Retain form/ad/adset/campaign IDs | met | `leadgen-ingest.ts:134-142` |
| WhatsApp follow-up only with phone + auditable consent + approved template | met (ceiling) | `leadgen-ingest.ts:193-252` |
| Pipeline listable without an active WhatsApp number | met | `leads/routes.ts:14-30`, `:66-77` |
| Sidebar child **Leads → `/contacts?tab=pipeline&source=META_ADS`** | **not met** | `client/src/config/navigation.ts:70-76` has Facebook → Inbox, Ads only (see `D-05`) |
| A way to configure the follow-up template | **not met** | `leadAdsWhatsAppTemplate` exists only at `leadgen-ingest.ts:211` (see `G-03`) |

### Phase 2 — Click-to-WhatsApp chip

| Requirement | Status | Evidence |
|---|---|---|
| Parse the referral, store on the conversation | met | `ctwa-referral.ts:47-66`; written from `webhook.processor.ts` |
| Ad-only referrals (not post/product) | met | `ctwa-referral.ts:28-35` |
| Chip with ad name = headline else body | met | `ctwa-referral.ts:69-86` |
| No fake 72h countdown | met | `ctwa-referral.ts:12-14` |
| Must not enter Meta Ads lead count / CPL | met | `meta-pipeline.ts:38-50` |

### Phase 3 — Messenger inbox

| Requirement | Status | Evidence |
|---|---|---|
| Subscribe `messages`; PSID → `ContactPlatformIdentity`; thread on `channelId` | met | `webhook-dispatcher.ts:552-628`; `messenger-ingest.ts:42-146` |
| `whatsappNumberId` never set on channel threads | met | `messenger-ingest.ts:79`, `:115`, `:128`, `:143` |
| Text send/receive inside 24h | met | `messenger-inbox.routes.ts:228` (window check), `:229-300` (send) |
| Reuse assign / notes / status / handoff | met | `messenger-inbox.routes.ts:314-434` |
| Separate route, not a filter on `/inbox` | met | `client/src/App.tsx` `/facebook/inbox`; `navigation.ts:74` |
| No template picker; composer locked outside 24h | met | `FacebookInboxPage.tsx:675-685` |
| Attachment-only inbound persisted as a typed message | met | `channelMessageAttachment` (`webhook-dispatcher.ts:13-32`); `phase0-router.test.ts:140` |
| Same PSID twice → one thread | met | `schema.prisma` unique `(organizationId, channelId, contactId)`; `messenger-inbox.test.ts:178` |

### Phase 4 — Instagram

| Requirement | Status | Evidence |
|---|---|---|
| Connect the Page-linked IG account as `Channel(platform=IG)` | met | `save-page-channel.ts:136-197`; `instagram/index.ts:41-66` |
| Bind IG to its parent Page, fail closed on rebinding | met | `parent-page.ts`; migration `20260925010000`; `save-page-channel.ts:77-93` |
| IG-only keyword automation without a WhatsApp number | met | `channel-keyword.ts:63-72`; migration `20260924150000` |
| Comment list + one private reply (7 days) | met | `comment-ingest.ts:11-15`, `:131-183`; `comments.routes.ts:66-88` |
| Atomic claim, no concurrent duplicate reply | met | `comment-ingest.ts:153-166` |
| Comment timestamp persisted (webhook `entry.time` fallback) | met | `webhook-dispatcher.ts:822-824` |
| Keyword must not cross platforms | met | `comment-ingest.ts:112-118`; `instagram.test.ts:292` |
| Reconnecting a different Page cannot send an old IG thread | met | `findParentPageChannel` resolves via `parentPageId` |
| WhatsApp template never offered | met | `InstagramInboxPage.tsx:676-683` |
| Comment→DM origin linking, persisted `live_comments` state | met (ceiling) | `webhook-dispatcher.ts:799-800`; `comment-ingest.ts:153` |
| Visual flow graph on Instagram | met (ceiling) | abandoned in `.unlazy/facebook-remaining/GATES.md` `G4` — correct, the flow engine sends via WhatsApp credentials |

### Phase 5 — Ads read

| Requirement | Status | Evidence |
|---|---|---|
| Read-only Insights, 7-day click / 1-day view, last 7 days | met | `page-client.ts:420-431`; `ads-insights.ts:9-10` |
| Tiles + **Open Ads Manager** | met | `ads-insights.ts:87-92` |
| Explicit account selection by owner/admin | met | `facebook/routes.ts:84-91`; `ads-insights.ts:211-232` |
| No account → message, never a fake zero chart | met | `ads-insights.ts:134-137` + `clearSnapshot` |
| Dashboard recap from the same payload | met | `client/src/services/api.ts:502` reuses `adsSummary` |
| Disconnect/replace Page cannot serve a mismatched snapshot | met | `ads-insights.ts:277-285` |
| No create/pause/budget, no `ads_management` | met | scope list `connect-oauth-state.ts:75-85`; no mutation endpoint exists |
| Live match vs Ads Manager | **unproven** | external — `BLOCKERS.md` §7 |

### Phase 6 — Analytics

| Requirement | Status | Evidence |
|---|---|---|
| Two separate columns, no single ROI number | met | `meta-pipeline.ts:61-85`; `pages/AnalyticsPage.tsx` |
| `Lead.amount` nullable, revenue "—" not ₹0 | met | `schema.prisma:1285`; `meta-pipeline.ts:61-71`; `AnalyticsPage.tsx:31-40` |
| Won + amount + `metaLeadId` only in the right column | met | `meta-pipeline.ts:48-59` |
| CTWA chat not joined into form leads | met | `meta-pipeline.ts:38-50` honest note |
| `/reports` not silently revived | met | `App.tsx` still redirects `/reports` → `/billing?tab=usage` |
| Filters affect only the pipeline column | met by construction | `analytics/routes.ts:1324-1400` — the left column reads the org snapshot regardless of `platform` |
| Browser smoke | **unproven** | no authenticated browser run recorded |

### Phase 7 — Channels

| Requirement | Status | Evidence |
|---|---|---|
| Settings → one Channels list (WhatsApp, Facebook, Instagram) | met | `SettingsPage.tsx:536`, `:557`, `:566` |
| Disconnect is soft (`isActive=false`), history kept | met | `save-page-channel.ts:199-221`; `instagram/index.ts:68-81` |
| No App ID / secret field | met | `FacebookPagePanel.tsx:23`, `:103`; `InstagramPagePanel.tsx:78`; no `appId`/`appSecret` in `components/settings/` |
| Topbar switcher stays WhatsApp-only | met | `NumberSwitcher` is used on `/inbox`, not in the FB/IG pages |
| Three inboxes never merged | met | three routes, three `channelId`-scoped queries |

---

## 5. Gap register

Severity reflects blast radius on the product, not effort to fix.

### G-01 — Page/Instagram webhook work is inline, undurable, and invisible to webhook health

**Severity: High (architectural)**

`whatsapp/routes.ts:982-1002` awaits `dispatchNonMessageWebhookFields(payload)` inside the HTTP request and then returns `200 EVENT_RECEIVED`. Unlike the WABA path immediately below it (`:1004-1043`), it does **not** call `persistAndEnqueueInboundWebhook`, and **not** `trackWebhookReceived()` / `trackWebhookQueued()` (compare `:1007-1010`).

Work running inside that request:

- `webhook-dispatcher.ts:663-673` calls `ingestLeadgenForChannel`, which performs a live Meta Graph fetch at `leadgen-ingest.ts:51`.
- `webhook-dispatcher.ts:616-624` (Messenger) and `:781-789` (Instagram) call `sendChannelAutoReply`, which can call `generateBotReply` — an LLM round trip — at `channel-keyword.ts:109-118`.

Consequences:

1. **Meta ack latency.** Meta expects a fast 2xx. A slow Graph call or an AI reply delays it; a timeout makes Meta retry the whole event.
2. **No durable queue.** There is no BullMQ queue for Page/IG at all (`config/queues.ts` defines none). A restart mid-request loses the event; the claim row is released (`webhook-dispatcher.ts:536`), so a Meta retry re-runs it — but once Meta's retries are exhausted the event is gone.
3. **Monitoring is blind for the whole Meta ecosystem.** `totalReceived` / `totalQueued` / `totalProcessed` and `lastReceivedAt` never move for Page or Instagram traffic. `/api/whatsapp/webhook/health` and admin telemetry report *zero events received* while Facebook and Instagram work correctly. This matters because `totalReceived` is exactly the metric used as WhatsApp inbound proof — so any future "is Meta inbound alive?" check for FB/IG returns a false negative.
4. `recordProviderWebhookReceipt()` (`webhook-dispatcher.ts:128-151`) — whose own comment reads *"Durable receipt for every Meta POST (health + ops)"* — has **zero call sites** in the repo. Unmatched Page/IG events (`webhook-dispatcher.ts:568`, `:639`, `:744`, `:801`, `:807`, `:817`) therefore leave no database trace, only a log line.

### G-02 — Outbound Facebook replies, media and `mark_seen` resolve "the first active Page", not the conversation's Page

**Severity: Medium-High (wrong-credential sends)**

Inbound resolves the Page exactly — `webhook-dispatcher.ts:590` → `resolveOrgFromPageChannel(pageId)` → matching `platformAccountId` (`:493-511`).

Outbound does not:

| Path | Line | Code |
|---|---|---|
| Keyword / WELCOME / AWAY / bot reply (FB) | `channel-keyword.ts:142` | `prisma.channel.findFirst({ where: { organizationId, platform: 'FB', isActive: true } })` — no `orderBy`, ignores `opts.conversationId` |
| `mark_seen` (FB) | `channel-inbox-actions.ts:67` | same `findFirst`, same omission |
| Outbound media (FB) | `channel-inbox-actions.ts:371` | same `findFirst`, same omission |

The Instagram branches are correct — they call `findParentPageChannel(organizationId, conversation.channelId)` (`channel-keyword.ts:138`; `channel-inbox-actions.ts:64-65`, `:368-369`).

The model permits more than one active Page per org (`Channel` is keyed by `(organizationId, platform, platformAccountId)`); only the *connect* flow deactivates extras (`save-page-channel.ts:68-91`). So this is latent today, but real the moment a second Page is connected: the reply goes out on the wrong Page token, producing a Graph error, or — worse — an outbound attempt aimed at a PSID that Page has no thread with. `findFirst` without `orderBy` also makes the pick arbitrary rather than deterministic.

### G-03 — The Lead Ads WhatsApp follow-up template cannot be configured: implemented but unreachable

**Severity: Medium (dead feature)**

`leadgen-ingest.ts:209-211` reads `organization.settings.meta.leadAdsWhatsAppTemplate`. Proof by exhaustion that nothing can write it:

- The identifier `leadAdsWhatsAppTemplate` appears **exactly once** in the entire repository — that reading line.
- `saveOrgMetaSettings` (`org-meta.service.ts:50-55`) immediately calls `rejectOrgMetaConfigWrite()`, which throws `AppError(410, …)` (`:12-14`). Org-level Meta credentials are deliberately locked.
- The five writers of `organization.settings` each write only a **named sub-key** and never spread request data into `meta`: `settings/routes.ts:139-146` (`businessHours`), `:192-199` (`campaigns`), `:309-316` (`uiToggles`), `:361-367` (`alerts`), plus `onboarding/routes.ts:140` and `templates/variable-meta.ts:98`. The only `meta` writer is `ads-insights.ts:224`, which constructs `{ ...meta, adsAccountId }` explicitly.

So `maybeSendLeadAdsTemplate` returns `false` at `:212` on every lead, always.

Secondary defect in the same function: the send at `leadgen-ingest.ts:236` passes `template: { name, language }` with **no `components`**, so only a zero-variable template could ever succeed.

This is the one unmet plan requirement not previously recorded as a deliberate ceiling. `phases/01-lead-ads.md` presents the follow-up as an available optional, and `PHASE_0_5_FINAL_HANDOFF` describes it only as "fail-closed on phone, consent, and approved-template requirements" — which reads as if it were configurable.

### G-04 — Facebook and Instagram inboxes render controls that do nothing

**Severity: Medium (user-visible)**

`FacebookInboxPage.tsx:540`, `:592` and `InstagramInboxPage.tsx:541`, `:593` pass `onNewChat={() => undefined}`. That prop is bound to a real button: `InboxListHeader.tsx:341` and `InboxListEmpty.tsx:123`. Compare WhatsApp, which opens the real slide-over at `InboxPage.tsx:809`, `:845`, `:998`.

Likewise `onCallBack={() => undefined}` at `FacebookInboxPage.tsx:622` / `InstagramInboxPage.tsx:623`, and `viewers={[]}` at `FacebookInboxPage.tsx:616` / `InstagramInboxPage.tsx:617`.

A dead button reads as broken, not as unbuilt.

### G-05 — Channel contacts get a synthetic phone number, can be orphaned, and are modelled differently from phone-less Meta leads

**Severity: Medium (data hygiene + consistency)**

`messenger-ingest.ts:10` returns `` `messenger:${psid}` ``; `instagram/ingest.ts:9` returns `` `instagram:${igsid}` ``. Both are written into `Contact.phone` **and** `Contact.normalizedPhone` with `whatsappNumberId: null` (`messenger-ingest.ts:72-81`; `instagram/ingest.ts:67-76`, `source: 'INBOUND'` at `:74` / `messenger-ingest.ts:78`).

The uniqueness that would prevent duplicates does not apply: `Contact` is unique on `(organizationId, whatsappNumberId, normalizedPhone)` (`schema.prisma:1108`), and Postgres treats `NULL` in a unique index as distinct — channel-only contacts therefore have no uniqueness at all. The compensating constraint lives on the identity table (`schema.prisma:1202`).

The create order makes it visible: the Contact is created **first** (`messenger-ingest.ts:72`, `instagram/ingest.ts:68`), then the identity (`messenger-ingest.ts:85`, `instagram/ingest.ts:81`). On a lost race the identity insert correctly reuses the winner's `contactId` (`messenger-ingest.ts:95-104`, `instagram/ingest.ts:87-95`) — but the Contact row it just created is **left behind with no cleanup**. A repository search finds no cleanup job or query for the `messenger:` / `instagram:` prefixes.

This is also inconsistent with Lead Ads, which deliberately refuses to invent a phone (`leadgen-ingest.ts:65-119`; `ARCHITECTURE.md` "do not invent a fake phone").

### G-06 — Contacts from Messenger/Instagram are indistinguishable from WhatsApp inbound

**Severity: Medium (segmentation)**

Both ingests write `source: 'INBOUND'` (`messenger-ingest.ts:78`, `instagram/ingest.ts:74`). `ContactSource` is `MANUAL | IMPORT | INBOUND | OUTBOUND` — no channel value, and `ARCHITECTURE.md` explicitly decided against adding `META_ADS` to that enum for leads. The consequence for *contacts* was not addressed: `/contacts` cannot filter or segment "arrived via Messenger" or "arrived via Instagram"; the only discriminator is the synthetic phone prefix from `G-05`.

### G-07 — `Message.metaMessageId` is globally unique; cross-org dedupe is not org-scoped

**Severity: Low**

`schema.prisma:1434`: `metaMessageId String? @unique`. Dedupe is `prisma.message.findUnique({ where: { metaMessageId } })` with no org or channel predicate (`messenger-ingest.ts:152-171`, `instagram/ingest.ts:147-166`), and the hit path returns `existingMsg.conversationId`.

Meta message IDs are globally unique in practice, so this is theoretical. The returned `conversationId` could be another org's row; it is only used for logging and to skip the auto-reply, so there is **no cross-tenant write**. Deliberately Low.

### G-08 — Entitlement gating and channel selection are inconsistent across Meta routes

**Severity: Low**

`facebook/routes.ts:93-97` gates `/connect-url` with `requireActiveCommercial()`. These do not: `/connect/callback` (`facebook/routes.ts:134-208`), `/connect/select` (`:210-251`), `instagram/index.ts:41-66` (`/connect`), `instagram/index.ts:68-81` (`/disconnect`). A lapsed-commercial org can complete a Meta connection it was not allowed to start.

Separately, the active-channel pick is inconsistent **for the same query shape**. These pass `orderBy: { updatedAt: 'desc' }`: `instagram/index.ts:22-26`, `messenger-inbox.routes.ts:22-33`, `comments.routes.ts:14-21`, and all three `ads-insights.ts` lookups (`:105-109`, `:175-179`, `:270-274`). These do not: `instagram/index.ts:46-49`, `channel-keyword.ts:142`, `channel-inbox-actions.ts:67`, `:371`. Which row wins is therefore unspecified in four call sites.

*(Corrected during the recheck: an earlier draft of this audit also listed `ads-insights.ts` as missing `orderBy`. It does not — all three of its lookups specify it. The list above is the verified one.)*

### G-09 — `providerCallStartedAt` is written after the provider call on Facebook/Instagram sends

**Severity: Low (but it defeats the field's purpose)**

`messenger-inbox.routes.ts:281` and `instagram/inbox.routes.ts:289` set `providerCallStartedAt: new Date()` inside the **success** update, alongside `status: 'SENT'`.

That field exists to mark the point of no return. The campaign worker sets it *before* calling Meta — `workers/index.ts` comments it as "the final database boundary before Meta" — precisely so a crash cannot look retryable. On the channel paths, a crash between Graph success and the DB write leaves the row `PENDING` with `providerCallStartedAt: null`, i.e. indistinguishable from "never attempted", while Meta may already have delivered.

### G-10 — `skippedReason` mislabels the multi-number Lead Ads case

**Severity: Low (misleading diagnostics)**

`leadgen-ingest.ts:111-119` skips Contact creation when the org has 2+ active WhatsApp numbers — correct number-isolation behaviour, refusing to guess. But the returned `skippedReason` at `:160-166` maps any missing `contactForSend` to `'no_whatsapp_number'`, which reads as "no WhatsApp number connected". The operator-visible reason says the wrong thing.

### G-11 — The Instagram comment keyword matcher bypasses the shared matcher and does not scope `whatsappNumberId`

**Severity: Low**

`comment-ingest.ts:101-118` queries `automation.findMany({ organizationId, enabled, triggerType: 'KEYWORD' })` then filters `config.platform === 'IG'` in JS. The DM matcher deliberately adds `whatsappNumberId: null` (`channel-keyword.ts:63-72`) and reuses the exported `matchChannelKeyword`. Today the two agree only because migration `20260924150000` nulls `whatsapp_number_id` on existing IG keyword rows; an IG keyword automation created later *with* a number set would fire on comments. Two matchers that must stay in agreement is also a maintenance trap.

### G-12 — The Graph client has no retry, no rate-limit handling, no token-expiry classification, and drops `fbtrace_id` on GET

**Severity: Low-Medium (operability)**

`page-client.ts:33-78`. `graphGet` builds its error from `data.error.message` only — `fbtrace_id` is captured for POST (`:71`) but **not** for GET, so GET failures cannot be traced with Meta support. Neither helper retries 429/5xx or backs off; they throw straight into the request or bot path.

Token expiry is also not distinguished from a missing permission. `isPermission` (`ads-insights.ts:93-97`) treats Graph codes 10 / 200 / **190** as a permission problem, so `refreshOrgAdsSnapshot` returns `needs_permission` (`:129`, `:146`) and `listOrgAdsAccounts` returns `needs_permission` (`:190`) when the real remedy is "reconnect the Page".

### G-13 — The startup migration gate's destructive-SQL pattern misses column-level destruction

**Severity: Low-Medium (safety net narrower than it reads)**

`server/scripts/migrate-startup-safe.ts:9`:

```
/\b(DELETE\s+FROM|TRUNCATE\b|DROP\s+TABLE)\b/i
```

I executed that exact pattern in Node:

| Statement | Result |
|---|---|
| `DELETE FROM whatsapp_numbers;` | **caught** |
| `TRUNCATE TABLE foo;` | **caught** |
| `DROP TABLE "whatsapp_numbers";` | **caught** |
| `DROP TABLE IF EXISTS x;` | **caught** |
| `ALTER TABLE a DROP COLUMN b;` | **missed** |
| `ALTER TABLE a DROP CONSTRAINT c;` | **missed** |
| `DROP INDEX idx;` | **missed** |
| `DROP TYPE "ChannelPlatform";` | **missed** |
| `DROP SCHEMA public;` | **missed** |
| `UPDATE x SET y = 1;` | **missed** |

`ALTER TABLE … DROP COLUMN` destroys data as irretrievably as `DROP TABLE`, and an `UPDATE` with no `WHERE` is the classic accident. The pattern is applied only to *pending* migration files (`:89`), so it is a last line of defence rather than the primary control — but it does not defend the two most obvious cases.

Directly relevant to this branch: its own migrations contain `UPDATE` statements (`20260924150000`, `20260925010000`). Those are intentional; the gate would not have flagged a destructive one either.

### G-14 — The uncommitted fresh-database bypass is untested, and its precondition may be unreachable

**Severity: Low-Medium (safety-critical, unverified)**

The working-tree change adds `verifyFreshDatabaseIsEmpty()` (`migrate-startup-safe.ts:26-42`) and lets a verified-empty database bypass the historical-destructive-migration refusal (`:59-70`), then deploy the whole chain.

Two problems:

1. **No test.** `server/scripts/migrate-startup-safe.ts` has no test file at all.
2. **The precondition may never hold.** The bypass requires `public_table_count = 0` (`:35-39`). It runs **after** `spawnSync('npx', ['prisma', 'migrate', 'status'])` at `:44`, and `_prisma_migrations` lives in `public`. The Prisma schema-engine binary ships the DDL `CREATE TABLE "_prisma_migrations" (...)`, and the CLI help for `migrate status` describes *reading* that table. Whether `status` **creates** it on an otherwise-empty database decides whether this branch is reachable, or dead code that still refuses fresh installs.

I could not settle point 2 from source alone and did not create a database to test it — out of scope for a read-only audit. It must be settled empirically before this change is trusted (§6 `S-14` has the procedure).

**Secondary note.** `verifyFreshDatabaseIsEmpty()` returns `check.status === 0`, so it fails closed on any error — good. But it cannot distinguish "database unreachable" from "database not empty", so a connection failure produces the misleading refusal message about the historical migration.

### G-15 — No SLA fields are set on Facebook/Instagram threads

**Severity: Low**

`firstResponseAt` and `slaDueAt` never appear anywhere in `server/src/modules/facebook/` or `server/src/modules/instagram/`. WhatsApp sets and reads them (`inbox/routes.ts:704-712`). Every SLA / first-response metric asks zero for channel threads, and `Conversation.slaDueAt` / `slaBreached` stay at defaults. `FACEBOOK_INTEGRATION_AUDIT` records this as "SLA tracking — ⚠️ Model only"; confirmed, and specifically these two fields are never written.

### G-16 — Analytics loads every lead of the org into memory on each page view

**Severity: Low (performance, grows with org size)**

`analytics/routes.ts:1336-1337` runs `prisma.lead.findMany` with `where: { organizationId: orgId }` and **no** date bound, stage filter, pagination or `take`; date filtering happens afterwards in JS (`meta-pipeline.ts:48-52`). `analytics/routes.ts:1347` and `:1351` additionally fetch channel connectivity per request. Phase 6's page cost therefore scales with total lead history, not with the selected range.

---

## 6. Solution register

Solutions are specified, not implemented. Nothing below was added to the codebase. Each entry is sized to be independently shippable, and each ends with acceptance criteria that can actually be tested.

Field, file and route names are given so the work is unambiguous; the actual code is deliberately left to whoever implements it.

---

### S-01 — Make Page/Instagram ingestion durable, observable, and off the request path (fixes G-01)

**Root cause.** The Page/IG branch was added as a synchronous handler bolted onto the WhatsApp webhook route, so it inherited none of the durability or telemetry the WABA path already had.

**Target behaviour.** A Page or Instagram webhook is persisted, queued and acknowledged exactly like a WABA webhook; all Graph fetches and LLM calls happen in a worker; every received object — including ones that cannot be routed to an org — leaves a database trace and moves the health counters.

**Steps, in order (each shippable on its own).**

1. **Observability only.** In the Page/IG branch of `modules/whatsapp/routes.ts`, call the same counters the WABA path uses — `trackWebhookReceived()` on entry and `trackWebhookQueued()` after dispatch — and a `trackWebhookProcessed()`/`trackWebhookFailed()` pair around the dispatch result. No behaviour change; this alone removes the false-negative monitoring described in G-01.
2. **Receipts for unmatched events.** Add a `recordProviderWebhookReceipt` call before dispatch for every Page/IG object, with an event key derived from the existing `providerWebhookEventKey`. This finally makes the exported helper used, and gives ops a queryable "we received a Page event we could not attribute" signal instead of a log line.
3. **Move the slow work to a queue.** Add a `meta-channel-queue` in `config/queues.ts` and a worker in `workers/index.ts`. The route enqueues the raw payload and acks; the worker calls `dispatchNonMessageWebhookFields`. Because `dispatchNonMessageWebhookFields` already does its own durable claim/complete/release, it is safe to retry at the queue level — the existing claim makes the retry idempotent. Do not duplicate the claim.
4. **Move the bot reply off the ingest path.** `sendChannelAutoReply` currently runs inline. Enqueue it on the existing `automation-queue` (it is already an LLM-backed, retry-friendly unit) instead of awaiting it inside the webhook worker. The inbound message is already persisted before this point, so ordering for the customer is unchanged.
5. **Only then** consider moving the leadgen Graph fetch (`leadgen-ingest.ts:51`) — it is fast and already inside the claimed region, so step 3 covers the ack-latency risk without further change.

**Watch out for.** The `ProviderWebhookEvent` claim has a 60s stale threshold (`webhook-dispatcher.ts:57`). If the worker queue backs up longer than that, a second delivery could re-claim an event still in flight. Either keep worker concurrency comfortably above delivery rate, or raise the stale threshold to exceed the queue's expected worst-case wait.

**Acceptance criteria.**
- A signed Page fixture increments `totalReceived`, `totalQueued` and `totalProcessed`, and moves `lastReceivedAt`.
- An unmatched Page fixture (no Channel) creates exactly one durable receipt row and leaves `unmatched` visible in the response/telemetry.
- The webhook route returns `200` without making any outbound Graph call — provable by asserting no `fetch` occurs while a Page payload is handled.
- Re-delivering the same fixture produces no second inbox message, no second Lead, and no second bot reply.

**Effort.** Step 1–2 small (hours). Steps 3–4 medium (a day), touching `config/queues.ts`, `workers/index.ts`, `routes.ts`, and the dispatcher.

---

### S-02 — Resolve every outbound channel from the conversation (fixes G-02)

**Root cause.** The outbound helpers were written before multiple Pages were considered, and the Instagram branch was later fixed while the Facebook branch was not.

**Target behaviour.** No outbound Facebook call ever guesses a Page. Every send resolves through the conversation's own `channelId`, exactly as the IG path already does.

**Steps.**

1. In `modules/facebook/channel-keyword.ts`, change `deliverChannelText` so the FB branch resolves from `opts.conversationId` → conversation → `channelId` → `Channel` (the same two-step the IG branch uses), instead of the "first active FB channel" query. `conversationId` is already passed by both callers.
2. Do the same for `markConversationSeen` in `modules/facebook/channel-inbox-actions.ts` — it already accepts `channelId` as an optional parameter; make it required and use it for both platforms.
3. Do the same for `deliverChannelMedia` in the same file; it already receives `channelId`.
4. Choose an explicit failure policy. Recommended: if the conversation has no `channelId`, or the Channel is missing/inactive, log at warn with the conversation id and return a "Facebook Page is not connected" error rather than falling back. A wrong-credential send is strictly worse than a visible failure.
5. Optional hardening: add `orderBy: { updatedAt: 'desc' }` to the remaining `findFirst` channel lookups listed in G-08 so behaviour is deterministic even where a single row is expected.

**Watch out for.** `deliverChannelText` is also called from `sendChannelKeywordReply`, which passes `conversationId` as optional. Make `conversationId` required there for FB, or handle the absent case explicitly — silently reverting to "first active Page" is the bug being fixed.

**Acceptance criteria.**
- With two active FB Page channels seeded for one org, a keyword reply for a conversation on Page B is delivered with Page B's token (assert the `pageId` passed to the Graph client).
- Same assertion for outbound media and for `mark_seen`.
- A conversation whose `channelId` points to an inactive Channel fails loudly and sends nothing.

**Effort.** Small — three call sites plus tests.

---

### S-03 — Make the Lead Ads follow-up real, or remove it (fixes G-03)

**Root cause.** The reader was implemented with no writer, and the send path was written for the simplest possible template.

**Target behaviour.** Either a documented, configurable follow-up with honest limits, or no code at all. Half-present is the one option to avoid.

**Option A — make it configurable (recommended if the feature is wanted).**

1. Decide where the template name lives. Two candidates: a field on `Channel` (Page-scoped, survives reconnect, and is where the user is already looking) or `organization.settings.meta.leadAdsWhatsAppTemplate` (org-scoped, matches today's reader). Pick one and delete the other code path. `Channel` is the better fit because a template is approved per WABA and the Page is what the lead arrived through.
2. Add a real write surface: a Settings → Facebook Page field with OWNER/ADMIN guard, validated against the approved templates already listed by the existing template endpoints. Do not accept a free-text name that might not exist.
3. Fix the send: hydrate template variables from the lead's mapped fields (`mapLeadgenFields` already returns name, phone, email) and refuse to send when the template requires variables that cannot be filled. Refusing is better than a Meta rejection.
4. Keep every existing gate: phone required, auditable consent required, template status `APPROVED` required, and no send at all when the org has 2+ active numbers and cannot pick one.
5. Document the ceiling in `phases/01-lead-ads.md`: utility templates only on first contact; marketing templates and consent-sourcing rules are the customer's responsibility.

**Option B — remove it (recommended if the feature is not wanted).**

1. Delete `maybeSendLeadAdsTemplate` and its call site in `leadgen-ingest.ts`; drop the `whatsappSent` field from `LeadgenIngestResult`. Keep the `skippedReason` values that describe *why a Contact was not linked*, since those are still meaningful.
2. Update `phases/01-lead-ads.md` and `PHASE_0_5_FINAL_HANDOFF` to say plainly that Lead Ads does not send WhatsApp follow-ups in this phase.
3. If keeping a template path ever returns, it should arrive with its own plan entry rather than as dead code.

**Acceptance criteria (Option A).**
- Setting the template in Settings and submitting a lead with phone + consent sends exactly one WhatsApp template.
- A template requiring a variable that the form did not provide produces no send and a recorded reason.
- A phone-less lead, or a lead without auditable consent, produces no send and still stores the Lead.
- An unapproved template name produces no send.

**Effort.** Option A: medium (route + validation + variable hydration + UI). Option B: small (deletion + doc edits).

---

### S-04 — Stop rendering controls that do nothing (fixes G-04)

**Root cause.** The FB/IG inbox pages were built from the WhatsApp page by passing no-op callbacks instead of removing the capability.

**Target behaviour.** A control either works or is not shown.

**Steps.**

1. In `FacebookInboxPage.tsx` and `InstagramInboxPage.tsx`, stop passing `onNewChat` and `onCallBack` where they are no-ops. The simplest correct change is to omit the props, then confirm the components render nothing for a missing prop — `InboxListEmpty` and `ChatPlaceholder` already treat `onNewChat` as optional; `InboxListHeader` and `ConversationList` currently require it and need their prop made optional (or the button guarded).
2. Replace `viewers={[]}` with no presence prop at all, so no empty avatar row is drawn.
3. If "new chat" for Messenger/Instagram is actually wanted, implement it as a separate follow-up: a slide-over that picks an existing contact with a `ContactPlatformIdentity` for that platform, and opens/creates a `channelId`-scoped conversation. Note this is only useful inside the 24h window, so it needs the same window gate the composer has.
4. Callback for Messenger/Instagram is genuinely out of scope (no voice channel there) — remove the control, do not stub it.

**Acceptance criteria.**
- Neither FB nor IG inbox renders a button that performs no action (screenshot or DOM assertion).
- No empty presence row is rendered.
- The WhatsApp inbox remains unchanged.

**Effort.** Small.

---

### S-05 — One honest representation for channel-only contacts (fixes G-05)

**Root cause.** `Contact.phone` is required, so the cheap fix (synthesise a phone) was chosen rather than the correct one, and the create order allows an orphan on a race.

**Target behaviour.** A contact that exists only on Messenger or Instagram is represented the same way every time, cannot be duplicated or orphaned by concurrent delivery, and does not pollute phone-based search or export.

**Steps (recommended order).**

1. **Stop the leak first — reorder the insert.** Create the `ContactPlatformIdentity` first inside a transaction, then create the Contact only if this request wins the identity. Concretely: attempt the identity insert with a temporary contact reference is not possible without the contact, so the cleanest ordering is: create Contact → create Identity → on P2002, reuse the winner's `contactId` **and delete the Contact this request just created** (it has no messages and no conversations at that point, so the delete is safe). This removes the orphan class of bug with no schema change and no data migration.
2. **Make phone optional for channel-only contacts.** Relax `Contact.phone` and `Contact.normalizedPhone` to nullable and add the corresponding migration. The existing unique index `(organizationId, whatsappNumberId, normalizedPhone)` keeps working for WhatsApp rows; channel rows simply have NULLs. Then the synthetic `messenger:` / `instagram:` strings disappear from new rows.
   - Important: do **not** rely on a unique index to dedupe channel contacts — with `whatsappNumberId` NULL, Postgres will not enforce it. The `ContactPlatformIdentity` unique constraint is and remains the real identity key. Say so in the schema comment so the next reader does not try to "fix" the phone index.
3. **Clean up existing rows** in a one-off, reviewed data migration: find contacts whose `phone` starts with `messenger:` or `instagram:` and that have no conversation, no message and no lead; delete them. For contacts that do have history, keep them and null the phone only if they are provably channel-only (i.e. every conversation has a non-null `channelId`).
4. **Protect the UI and export.** Whatever Contacts display and CSV export do with phone, they must render an em dash for a null phone rather than the string "null" — verify the Contacts table, the contact detail panel, and `/contacts` search do not treat a null phone as matchable.
5. Add a regression test that fires two concurrent ingests for one brand-new PSID and asserts exactly one Contact, one identity and one conversation.

**Watch out for.** `contactsForNumberFilter` and the number-scoped contact queries in `modules/whatsapp/active-number.ts` assume `whatsappNumberId` is set for WhatsApp contacts; confirm they still exclude channel rows after the change (they filter on `whatsappNumberId`, so they should).

**Acceptance criteria.**
- Two concurrent first-message webhooks from one PSID create exactly one Contact row.
- A Messenger-only contact has a null phone and is invisible to phone search.
- Contacts CSV export renders channel-only contacts without a synthetic phone.
- All existing WhatsApp contact uniqueness tests still pass.

**Effort.** Medium. Step 1 is small and can ship alone; steps 2–3 need a migration and a data audit.

---

### S-06 — Let Contacts know which channel a contact came from (fixes G-06)

**Root cause.** Channel provenance was modelled on `Lead` but not on `Contact`.

**Target behaviour.** The Contacts surface can answer "did this person come in through Messenger, Instagram, or WhatsApp?" without string-matching a phone prefix.

**Steps.**

1. Add nullable `Contact.channelId` with the same relation shape `Lead.channelId` already uses (`onDelete: SetNull`), populated by the two channel ingests. This is additive and cheap.
2. Alternatively — and with no migration — derive provenance through `ContactPlatformIdentity.platform`, which is already unique per org and already written by both ingests. Add the platform to the contact list/detail DTO and a Contacts filter for it.
   - Recommendation: do the DTO approach first (no schema change, immediate value), and add `channelId` only if per-Page rather than per-platform granularity is needed.
3. Surface it: Contacts list column/filter chip, contact detail panel line, and (optionally) a Reports breakdown.

**Acceptance criteria.**
- Contacts can be filtered to "Messenger" and "Instagram" sources, and the result matches the set of contacts with a matching `ContactPlatformIdentity`.
- Existing WhatsApp contacts are unaffected and default to no channel provenance.

**Effort.** Small (DTO path) to small-medium (schema path).

---

### S-07 — Scope inbound message dedupe by channel (fixes G-07)

**Root cause.** Dedupe leans on a global unique index instead of the conversation's own scope.

**Target behaviour.** A duplicate `mid` is only treated as a duplicate within the conversation/channel it belongs to, so a hypothetical collision cannot silently drop a message or return a foreign `conversationId`.

**Steps.**

1. In `messenger-ingest.ts` and `instagram/ingest.ts`, replace the bare `findUnique({ where: { metaMessageId } })` with a lookup constrained by `conversationId` (the conversation is already resolved a few lines above), for example a `findFirst` on `{ conversationId, metaMessageId }`.
2. Keep the global unique index — it is still a useful invariant — but do not treat it as the dedupe scope.
3. If a `metaMessageId` is found in a *different* conversation, log it at warn with both conversation ids; that is a real signal worth seeing rather than a silent skip.

**Acceptance criteria.**
- The same `mid` delivered twice to the same conversation produces one message.
- A unit test with the same `mid` in two conversations produces two messages and a warning.

**Effort.** Small.

---

### S-08 — Make entitlement gating and channel selection consistent (fixes G-08)

**Root cause.** The connect endpoints grew at different times, so the commercial gate was applied to the first one only; the channel lookups were copied from each other with and without `orderBy`.

**Target behaviour.** The whole Meta connect surface is gated the same way, and every "the org's active channel" lookup is deterministic.

**Steps.**

1. Decide the intended rule and apply it uniformly. Recommended: gate the *start* and the *finish* of a connect — `/connect-url`, `/connect/callback`, `/connect/select` for Facebook, and `/connect` for Instagram — with `requireActiveCommercial()`. Leave `/disconnect` ungated (a customer must always be able to disconnect).
2. Apply the same rule to `instagram/index.ts`; today it has none on either route.
3. Add `orderBy: { updatedAt: 'desc' }` to the four lookups listed in G-08 so all eight channel lookups behave identically.
4. While in there, consider extracting a single `activeChannelFor(orgId, platform)` helper so there is one definition of "the org's active channel" rather than eight. That is the durable fix for this class of inconsistency.

**Acceptance criteria.**
- A lapsed-commercial org receives the same entitlement error from every connect entry point.
- Disconnect still succeeds for a lapsed org.
- All channel lookups use the same ordering; a test asserts the helper is used where expected.

**Effort.** Small.

---

### S-09 — Mark the irreversibility boundary before the provider call (fixes G-09)

**Root cause.** The channel send handlers were written to write one final "success" row, rather than two rows around a boundary.

**Target behaviour.** If the process dies after Meta accepts a message, the database shows that a provider call was in flight — so no recovery path can mistake it for a never-attempted message.

**Steps.**

1. In `messenger-inbox.routes.ts` and `instagram/inbox.routes.ts`, split the write: create the outbound row with `status: 'PENDING'` as today, then set `providerCallStartedAt` in a separate update immediately before the Graph call, then set `status: 'SENT'` + `metaMessageId` after.
2. On failure, keep the current behaviour (`status: 'FAILED'` plus error metadata) but preserve `providerCallStartedAt` so the attempt is auditable.
3. Mirror the naming/semantics already used by the campaign worker so a future reader sees one convention.

**Acceptance criteria.**
- A simulated crash between the two writes leaves a row with `providerCallStartedAt` set and `status: 'PENDING'`.
- A successful send still ends with `SENT` and a `metaMessageId`.

**Effort.** Small.

---

### S-10 — Report the real reason a lead had no WhatsApp follow-up (fixes G-10)

**Root cause.** A single `contactForSend` null check collapses several distinct causes into one reason string.

**Target behaviour.** Logs and return values say which gate stopped the follow-up.

**Steps.**

1. In `leadgen-ingest.ts`, return a specific reason at the point each condition is known: `no_phone`, `invalid_phone`, `ambiguous_whatsapp_number` (2+ active numbers), `no_whatsapp_number` (zero active), `no_consent`, `no_approved_template`.
2. Keep the existing `notes` line on the Lead for the user-visible explanation; this change is about the machine-readable reason.
3. If the reason is ever surfaced in the UI or admin telemetry, make sure the ambiguous case reads as an operator action ("choose a single WhatsApp number for Lead Ads") rather than as a missing number.

**Acceptance criteria.**
- An org with two active numbers and a phone-bearing lead logs `ambiguous_whatsapp_number`, not `no_whatsapp_number`.
- An org with zero numbers logs `no_whatsapp_number`.

**Effort.** Small.

---

### S-11 — One keyword matcher for DMs and comments (fixes G-11)

**Root cause.** The comment path re-implemented matching instead of reusing the channel matcher.

**Target behaviour.** A single matcher decides keyword matching for every channel surface, scoped the same way, so the two paths cannot drift.

**Steps.**

1. In `comment-ingest.ts`, replace the inline automation query and JS filter with `matchChannelKeyword` from `channel-keyword.ts`, passing the same automation rows the DM path uses.
2. Add the `whatsappNumberId: null` filter to the query so comment automations are explicitly org-scoped rather than relying on the `20260924150000` data fix.
3. Confirm the DM path's trigger precedence (KEYWORD → WELCOME → LEAD_CAPTURE → AWAY) is *not* applied to comments — comments are keyword-only by design.
4. Add a test asserting a comment keyword and a DM keyword with the same keyword value are matched by their own platform only.

**Acceptance criteria.**
- The comment keyword path and the DM keyword path agree on matching rules and disagree only on scope.
- An automation row with a `whatsappNumberId` set and `config.platform = 'IG'` does **not** fire on comments.

**Effort.** Small.

---

### S-12 — Harden the Graph client (fixes G-12)

**Root cause.** The client was written for the happy path; error classification was added only where a UI state needed it.

**Target behaviour.** Graph failures are traceable, transient failures are retried, and an expired token is told apart from a missing permission.

**Steps.**

1. Capture `fbtrace_id` on GET errors too, so both verbs produce the same structured error (`metaCode`, `fbtraceId`, message).
2. Introduce one classification helper used by every caller, distinguishing at minimum: expired/invalid token (190), rate limit (4 / 613 / 80007), permission (10 / 200), throttling subcodes, and everything else. Keep it in `page-client.ts` so it cannot drift.
3. Add bounded retry with exponential backoff and jitter for rate-limit and 5xx responses only — never for permission or token errors. Make the retry budget smaller than any enclosing queue's attempt budget so a message is not effectively retried twice (relevant once `S-01` lands).
4. Map the token-expiry class to a distinct, actionable state: a "Facebook Page connection expired — reconnect in Settings" status instead of `needs_permission`, and emit it wherever banners already render.
5. Add a token-expiry health check: the code already knows how to inspect WhatsApp token expiry; the equivalent Page check plus a daily poll would let the UI warn before Meta starts failing. This also closes the "no Page token expiry monitoring" item the Facebook audit lists as Medium.

**Acceptance criteria.**
- A stubbed 429 is retried and eventually succeeds; a stubbed 190 is not retried and reports "reconnect".
- Every GET failure carries `fbtrace_id` when Meta supplies one.
- No infinite or unbounded retry loop is possible.

**Effort.** Medium.

---

### S-13 — Widen the destructive-SQL gate (fixes G-13)

**Root cause.** The pattern was written for the three statements the team had in mind at the time.

**Target behaviour.** Any pending migration whose SQL can lose data is refused unless the operator follows the documented backup/preflight path.

**Steps.**

1. Extend the pattern to cover `DROP TABLE`, `DROP INDEX`, `DROP TYPE`, `DROP SCHEMA`, `DROP CONSTRAINT`, and `ALTER TABLE … DROP COLUMN` / `DROP CONSTRAINT` (the last two need a non-greedy cross-line match, since the `ALTER` and the `DROP` are rarely on the same line).
2. Decide the policy for `UPDATE` and `DELETE` in pending migrations. Recommendation: do not try to detect "destructive UPDATE" heuristically — instead require that any pending migration containing `UPDATE` or `DELETE` outside the approved reconciliation allowlist goes through the existing backup workflow, where the operator names a verified dump. The reconciliation command already models exactly this and validates the dump with `pg_restore --list`.
3. Prefer a small, unit-tested function over an ever-growing regex: a handful of tests with the ten statements in the G-13 table would lock the behaviour down permanently. This is the same test file that `T-05` asks for.
4. Ask Prisma to help: since this branch ships a migration that intentionally mutates data, add a short note in `docs/WHATSAPP_NUMBER_MIGRATION_SAFETY.md` listing which migrations are known-mutating, so the operator does not have to infer it.

**Acceptance criteria.**
- The G-13 table has a test per row, and every "missed" row becomes "caught".
- A synthetic pending migration containing `DROP COLUMN` is refused with a clear message.
- Existing migrations in the repo still pass the gate (no false positives).

**Effort.** Small, mostly tests.

---

### S-14 — Settle the fresh-database bypass, then test it (fixes G-14)

**Root cause.** The bypass was written against an assumption about Prisma's behaviour that has not been verified, and the script has never had a test.

**Target behaviour.** Either the bypass works and is proven by a test, or it does not exist and the refusal message is honest about what a fresh install requires.

**Steps, in order.**

1. **Measure.** Run the four commands in the procedure below on a throwaway database in the local Docker Postgres, and record the table count. This is the only open question in this audit and it needs approval before running, because it touches the dev database (it creates and drops only a scratch database, and touches no existing data):

   ```
   docker compose exec postgres createdb -U postgres scratch_fresh_check
   cd server && DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/scratch_fresh_check' npx prisma migrate status
   docker compose exec postgres psql -U postgres -d scratch_fresh_check -c "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public';"
   docker compose exec postgres dropdb -U postgres scratch_fresh_check
   ```

2. **If the count is 0**, the bypass is reachable and correct as written. Keep it, and add the test from step 4. Also fix the diagnostic split noted in the gap: distinguish "cannot connect" from "not empty" so the operator gets the right message for each.
3. **If the count is 1** (because `_prisma_migrations` now exists), the check is wrong: it should look at whether the database contains any *application* tables, or whether `_prisma_migrations` has any applied rows, rather than counting every table in `public`. Rewrite the emptiness test in those terms, then re-measure.
4. **Add the missing test.** Because the script shells out to the Prisma CLI, the honest options are (a) unit-test the pure decision logic by extracting it from the CLI calls, or (b) an integration test gated behind an explicit env flag that provisions and drops a scratch database. Option (a) is strongly preferred: extract the decision — given the status output and a table count, what should the script do? — and test all four branches (up to date, clean install, historical-destructive pending with empty DB, historical-destructive pending with data). Option (b) is the only way to prove Prisma's actual behaviour, so keep it as a single, clearly-marked integration test.
5. **Then** re-check `docs/env-backup/README.md` against whichever behaviour is true (see `D-06`).

**Acceptance criteria.**
- The scratch-database measurement is recorded in this document or its successor, with the observed count.
- Every branch of the decision logic has a test.
- The refusal message is accurate for both "not empty" and "unreachable".

**Effort.** Small once approval to run the measurement is given; the test extraction is the bulk of the work.

---

### S-15 — Set SLA fields for channel threads (fixes G-15)

**Root cause.** Channel threads were added to `Conversation` without adopting the SLA writes that the WhatsApp inbox performs.

**Target behaviour.** A Messenger or Instagram thread behaves like a WhatsApp thread in every metric that reads `firstResponseAt` / `slaDueAt`.

**Steps.**

1. Find where the WhatsApp path sets `firstResponseAt` on the first agent reply, and `slaDueAt` when the conversation is created, and apply the same logic in `channel-inbox-actions.ts` and the two channel inbox routes.
2. Use the org's existing SLA configuration source, not a new setting; a channel thread should not invent its own SLA policy.
3. Decide and document whether channel threads should count in the same SLA/team metrics as WhatsApp. The product decision to keep inboxes separate does not automatically mean the metric should be separate — writing the fields and then filtering is preferable to leaving them null.

**Acceptance criteria.**
- A Messenger conversation that receives an agent reply has a non-null `firstResponseAt`.
- The SLA/team metric for channel threads is no longer consistently zero.

**Effort.** Small.

---

### S-16 — Bound the Analytics query (fixes G-16)

**Root cause.** The date filter was implemented in the pure function rather than pushed to SQL, which was fine for the initial honest-two-column shape but does not scale.

**Target behaviour.** Phase 6's page cost scales with the selected range and the number of Meta leads, not with the org's entire lead history.

**Steps.**

1. Move the `from` / `to` bounds into the `where` clause using `createdAt`, and add `metaLeadId: { not: null }` since the pipeline column only counts Meta leads (`meta-pipeline.ts:49`). Keep the pure function's filtering as a defensive no-op so its existing tests keep passing unchanged.
2. Add `take` with a sane upper bound, or aggregate in SQL (`groupBy` stage plus a sum of `amount`) so the page never materialises a large array.
3. Select only the columns the column needs (`id`, `title`, `stage`, `amount`, `metaLeadId`, `createdAt`) — it already does, which is why this is a small change.
4. Do the same for future filters: the page is expected to gain a source filter, and one unbounded query is easier to fix now than two later.

**Acceptance criteria.**
- The query plan for the analytics endpoint no longer depends on total lead count.
- The four `meta-pipeline.test.ts` cases and the `AnalyticsPage` rendering are unchanged.

**Effort.** Small.

---

## 7. Documentation-vs-code drift

I did **not** edit any of these. Each has a one-line fix.

| ID | Document | Wrong claim | Correct state / fix |
|---|---|---|---|
| D-01 | `PHASE_0_5_FINAL_HANDOFF_2026-09-24.md` | *"Phase 6 Analytics and Phase 7 Portfolio/Channels remain unbuilt by design."* | Both shipped 2026-09-25: `/analytics` routed (`client/src/App.tsx`), `analyticsApi.metaPipeline` (`services/api.ts:993`), `analytics/routes.ts:1324`, Settings → Channels (`SettingsPage.tsx:536`, `:557`, `:566`), sidebar (`navigation.ts:52`, `:136-140`). **Fix:** replace the sentence with the two shipped statements already present in `phases/06` and `phases/07`. |
| D-02 | `FACEBOOK_INTEGRATION_AUDIT_2026-09-24.md` §3.1 | State token is *"signed with the application JWT secret"*; *"dedicated state audience/secret hardening remains a release task"*. | Already done: `config.jwt.oauthStateSecret` + `audience: 'samyoj-oauth-state'` + HS256 (`facebook/connect-oauth-state.ts:48-72`), enforced in production (`config/validate.ts:34-36`; `scripts/vps-deploy.sh:20`). **Fix:** change the status to implemented and strike the remaining-task line. |
| D-03 | `INSTAGRAM_INTEGRATION_AUDIT_2026-09-24.md` §5.2 | *"No IG message read status (outbound) — SAMYOJ-IG-002."* | Instagram supports `sender_action: mark_seen` on `POST /{PAGE-ID}/messages`, and the code implements the exact required shape (`page-client.ts:279-289`, wired at `instagram/inbox.routes.ts:338`). **Fix:** close the item, citing Meta's Sender Actions page. |
| D-04 | `INSTAGRAM_INTEGRATION_AUDIT_2026-09-24.md` §2.2 | *"`message_reactions`, `message_typing_on`, and `mentions` are handled in code."* | Not handled: `webhook-dispatcher.ts:734` drops any event without a `message`; `:800-801` drops any change field other than `comments`/`live_comments`. **Fix:** rewrite as "not handled in Phase 0–5" and list them as explicit non-goals. |
| D-05 | `phases/01-lead-ads.md` §UI | Sidebar child **Leads → `/contacts?tab=pipeline&source=META_ADS`**. | `navigation.ts:70-76` has Inbox + Ads only; there is no Leads child. **Fix:** pick one — add the nav child, or delete the table row and say the pipeline is reached from the Page settings card. Do not leave both. |
| D-06 | `docs/env-backup/README.md` | Gate *"is fail-closed and refuses fresh installs"*. | Only true for non-empty databases after `S-14`; possibly still true for empty ones depending on the measurement. **Fix:** restate the contract after `S-14` is settled (one sentence). |
| D-07 | `INSTAGRAM_INTEGRATION_AUDIT` §7.1 item 5 | *"Replace `useSocket` reload-all with surgical updates."* | `FacebookInboxPage.tsx:161-176` already filters by `payload.platform` and appends the message. **Fix:** narrow the recommendation to presence/typing and per-conversation patching, which is the real remaining delta. |
| D-08 | `BLOCKERS.md` §5 | *"No `ads_management`"* stated as a control. | Enforced only by an `audit-score.ts` string check plus the absence of any mutation endpoint. **Fix:** add one clause — "enforced by scope list + absence of a mutation endpoint; the audit-score entry is a regression marker, not a guard". |

---

## 8. Test-coverage gaps and what to add

| ID | Gap | Test to add |
|---|---|---|
| T-01 | No test for `modules/facebook/routes.ts` | Connect-url builds a URL with the 9 scopes and rejects a non-whitelisted redirect; callback rejects a state belonging to another org/user; select rejects a Page outside the pending list; disconnect deactivates and cascades to IG |
| T-02 | No test for `modules/facebook/parent-page.ts` | An IG conversation resolves the Page from `parentPageId`; a mismatched or inactive parent returns null; reconnecting a different Page makes the old IG channel unresolvable |
| T-03 | No test for `modules/instagram/index.ts` | `/connect` without a Page returns 400; a 409 from linked-IG ownership propagates rather than being swallowed; `/disconnect` deactivates all IG channels for the org |
| T-04 | `channel-inbox-actions.test.ts` covers 3 pure helpers only | Handler contract tests: `/bulk` rejects >50 ids and validates agent membership; window-closed send returns 403; cross-org conversation returns 404; `/export` content type and filename |
| T-05 | No test for `scripts/migrate-startup-safe.ts` | Extract the decision logic and test all four branches (see `S-14` step 4) |
| T-06 | No client test for FB/IG pages | Render `FacebookInboxPage`/`InstagramInboxPage` with no connected channel and assert the empty state; assert no dead New-chat/Callback control (`S-04`); assert composer is disabled when the window is closed |
| T-07 | Nothing pins webhook-health behaviour for Page/IG | Assert a signed Page fixture moves the counters (`S-01` step 1) — this is the test whose absence hid `G-01` |
| T-08 | No test for multi-Page outbound resolution | Seed two active FB channels; assert the reply/media/mark_seen use the conversation's Page (`S-02`) |
| T-09 | `audit-score.test.ts` asserts a whitespace-sensitive schema literal | Replace the raw string match with a structural check (parse the model block, assert `@unique` on the field), so Prisma reformatting cannot fail the build |

---

## 9. Previously-reported gaps that are already correct

Recorded so they are not "fixed" again. Each was checked in source; `F-02` was checked against Meta's own documentation.

| ID | Previously reported | Actual state |
|---|---|---|
| F-01 | Cross-org Page/IG takeover is prevented only by an application-level 409, leaving a race | `20260925010000_meta_channel_parent_page` adds a partial unique index on `(platform, platform_account_id) WHERE is_active = true`. The database enforces single ownership. Residual nit only: a true race surfaces as Prisma P2002 / 500 rather than the intended 409 — worth mapping in the error handler |
| F-02 | "No IG message read status (outbound)" | Instagram supports `sender_action: mark_seen`, and `markPageSeen` (`page-client.ts:279-289`) uses exactly the request shape Meta requires (only `recipient` + `sender_action`). See `D-03` |
| F-03 | "Replace `useSocket` reload-all with surgical updates" | The FB/IG handlers already filter by `platform` and patch the message list. See `D-07` |
| F-04 | `MetaAdsSnapshot.organizationId @unique` is a bug | Deliberate and documented (`ADS-unique` verdict `out`), matching the one-selected-account product decision |

---

## 10. Verified good — do not disturb

- **Signature before dispatch.** `whatsapp/routes.ts:937-975` validates `X-Hub-Signature-256` before the Page/IG branch at `:982`; `route-hardening.test.ts:27-40` asserts the WABA path acks only after persist, and `:42-58` asserts the Page/IG ordering.
- **Object isolation.** `workers/webhook.processor.ts:337-338` and `webhook-dispatcher.ts:856-869` both refuse non-WhatsApp objects, so a Page event can never create a WhatsApp conversation.
- **Claim / complete / release** with a 60s stale-claim reclaim (`webhook-dispatcher.ts:59-127`) and P2002-based duplicate tolerance (`:75-84`).
- **Token handling.** Bearer headers, never query strings (`page-client.ts:33-38`); AES-GCM at rest (`save-page-channel.ts:36`, `:145`); no token in Settings or public JSON (`route-hardening.test.ts:16-25`).
- **Lead Ads follow-up gates** fail closed on phone, consent, template status and number ambiguity (`leadgen-ingest.ts:193-252`) — even though the path is currently unreachable (`G-03`). The gates are right; only the wiring is missing.
- **`/reports` remains a redirect** to Billing, so Phase 6 did not silently revive an abandoned page.
- **Phase 2 honesty.** No 72h countdown is fabricated because Meta sends no click timestamp (`ctwa-referral.ts:12-14`); only ad referrals are stored (`:28-35`).
- **`saveLinkedInstagramChannel` re-throws 409** rather than hiding an ownership conflict behind a successful Page connect (`save-page-channel.ts:104-116`).

---

## 11. External gates still open

Not code defects, and not closable from this repository. From `BLOCKERS.md` §7, re-verified as still accurate:

1. Meta App Review / Live mode for the requested Page, `pages_messaging`, `instagram_*`, `leads_retrieval`, `ads_read`.
2. Production OAuth callback (`https://app.samyoj.com/settings/facebook/callback`) registered on the live app, plus `page` (`leadgen,messages`) and `instagram` (`messages,comments,live_comments`) webhook subscriptions — today only `whatsapp_business_account` is subscribed.
3. Real Page DM, Instagram DM, comment/private-reply, and Ads Manager comparison evidence (what `LEAD-live` and `ADS-live` mean in `audit-score.ts`).
4. A new customer-host WhatsApp inbound reply incrementing `totalReceived`.
5. An off-box backup followed by an isolated customer-host restore drill.

**Given `G-01`, items 3 and 4 need a measurement correction:** `totalReceived` cannot be used as evidence for Facebook or Instagram, because Page/IG traffic never increments it.

---

## 12. Recommended order of work

Ordered by blast radius ÷ effort, conservative about scope. Each item is independently shippable.

**Do first — correctness**
1. `S-02` (fixes G-02) — three call sites; removes the only path that can send on the wrong credentials.
2. `S-01` steps 1–2 (fixes G-01 partially) — counters and receipts; restores observability of the whole Meta ecosystem.
3. `S-09` (fixes G-09) — small, and makes channel sends consistent with the campaign convention before anything depends on it.

**Do next — the honest-reporting and safety items**
4. `S-14` (fixes G-14) — one measurement, then a test; currently the single largest unverified claim in the repo's migration story.
5. `S-13` (fixes G-13) — widen the gate, add the ten-case test.
6. `S-03` (fixes G-03) — decide Option A or B. Do not leave it half-present a moment longer than necessary.
7. `S-04` (fixes G-04) — remove the dead controls.

**Then — data correctness**
8. `S-05` step 1 (fixes the orphan half of G-05) — no schema change, removes the leak.
9. `S-05` steps 2–3 + `S-06` (fixes the rest of G-05 and G-06) — one migration, one data audit.
10. `S-01` steps 3–4 (completes G-01) — queue and bot reply.

**Then — hardening and parity**
11. `S-12` (fixes G-12) — Graph client classification and retry.
12. `S-08` (fixes G-08) — entitlement uniformity and the shared channel helper.
13. `S-15` (fixes G-15), `S-16` (fixes G-16), `S-10` (fixes G-10), `S-11` (fixes G-11), `S-07` (fixes G-07).

**Tests and docs**
14. `T-02`, `T-01`, `T-03` — `parent-page.ts` first (highest-consequence invariant), then the two route modules.
15. §7 documentation sweep (`D-01` … `D-08`) — mostly one-line edits; `D-01` matters most because a stale handoff is what a new reader trusts first.
16. `T-04` … `T-09`.

**Do not** start Phase 6/7 expansion, ad mutation, Stories, publishing, or a full `Automation.channelId` engine rewrite. `G-16` is the only item that degrades over time, and only for orgs with long lead histories.

---

## 13. Appendix — sources reviewed

**Server, Facebook (20 files):** `routes.ts`, `page-client.ts`, `messenger-inbox.routes.ts`, `messenger-ingest.ts`, `channel-keyword.ts`, `channel-inbox-actions.ts`, `save-page-channel.ts`, `parent-page.ts`, `connect-oauth-state.ts`, `leadgen-ingest.ts`, `ads-insights.ts`, `audit-score.ts`, and the 9 test files in the module.
**Server, Instagram (6 files):** `index.ts`, `ingest.ts`, `comment-ingest.ts`, `comments.routes.ts`, `inbox.routes.ts`, `instagram.test.ts`.
**Server, shared:** `whatsapp/routes.ts`, `whatsapp/webhook-dispatcher.ts`, `webhook-signature-gate.ts`, `webhook-accept.ts`, `webhook-url.ts`, `webhook-health.ts`, `whatsapp/org-meta.service.ts`, `workers/webhook.processor.ts`, `workers/index.ts`, `config/queues.ts`, `config/index.ts`, `config/validate.ts`, `analytics/routes.ts`, `analytics/meta-pipeline.ts`, `inbox/ctwa-referral.ts`, `leads/routes.ts`, `settings/routes.ts`, `onboarding/routes.ts`, `templates/variable-meta.ts`, `scripts/migrate-startup-safe.ts`, `scripts/migration-reconciliation-constants.ts`.
**Schema / migrations:** `prisma/schema.prisma` (Channel, InstagramComment, MetaAdsSnapshot, ContactPlatformIdentity, Conversation, Contact, Lead, Message) and the 9 Meta migrations listed in §3.
**Client:** `App.tsx`, `config/navigation.ts`, `pages/FacebookInboxPage.tsx`, `pages/InstagramInboxPage.tsx`, `pages/FacebookAdsPage.tsx`, `pages/InstagramCommentsPage.tsx`, `pages/AnalyticsPage.tsx`, `pages/InboxPage.tsx` (parity baseline), `pages/SettingsPage.tsx`, `components/settings/*`, `components/layout/MetaChannelChips.tsx`, `components/layout/Sidebar.tsx`, `components/inbox/*`, `hooks/useSocket.ts`, `services/api.ts`.
**Docs:** all of `docs/meta-ecosystem/` — `README`, `ARCHITECTURE`, `BLOCKERS`, `STATUS_SIMPLE`, `PHASE_0_5_FINAL_HANDOFF_2026-09-24`, `META_ECOSYSTEM_UI_BY_PHASE_2026-09-22`, `FACEBOOK_INTEGRATION_AUDIT_2026-09-24`, `INSTAGRAM_INTEGRATION_AUDIT_2026-09-24`, and all 9 files under `phases/`; plus `docs/env-backup/README.md`, `docs/WHATSAPP_NUMBER_MIGRATION_SAFETY.md`, `RUNBOOK.md`, `.cursor/rules/*`, and the `.unlazy/` gate ledgers (`meta-audit`, `facebook-audit-gaps`, `facebook-remaining`, `meta-phase-1`…`5`, `meta-phase-pack`, `meta-nav-inbox`, `meta-ui-ia`, `production-readiness`).
**External:** Meta, *Instagram Messaging → Sender Actions* (`developers.facebook.com/documentation/business-messaging/instagram-messaging/features/sender-actions`) — fetched 2026-09-25, not recalled.

---

## 14. Honesty statement

- Every `G-` finding cites a file and line re-read in this working tree on 2026-09-25, **except `G-14`**, which is explicitly marked unverified together with the procedure that settles it (`S-14`).
- **Two inaccuracies were found during this recheck and corrected, not hidden:**
  - `G-08` originally listed `ads-insights.ts` among the channel lookups that lack `orderBy`. Re-reading showed all three of its lookups (`:105-109`, `:175-179`, `:270-274`) do specify `orderBy: { updatedAt: 'desc' }`. It has been removed from that list, which is why the corrected list cites four call sites instead of seven.
  - `G-16` and the Phase 4 row were citing line ranges that had drifted; they now point at `analytics/routes.ts:1336-1337`, `:1347`, `:1351` and `channel-keyword.ts:63-72`.
- **One candidate finding was discarded rather than softened.** I initially suspected `markPageSeen` was unsupported for Instagram. Meta's documentation says otherwise, so it is recorded as `F-02`.
- **One earlier misreading was corrected by re-measurement.** I first believed the destructive-SQL regex failed to match `DROP TABLE` — I had mis-transcribed the pattern when testing it. Re-testing the exact pattern from `migrate-startup-safe.ts:9` shows `DROP TABLE` **is** caught; `G-13` reports the corrected result and the four genuinely-missed cases.
- **One claim is deliberately weaker than it could be.** `G-07` is rated Low because the only observable effect is a logged skip, not a cross-tenant write. It is recorded for completeness, not because it is dangerous.
- No application code, migration, or existing document was changed. Nothing was deployed; no database was created, dropped, or written.
- Passing tests are not treated as proof of live behaviour. `audit-score.ts` remains a marker lock, and `T-04` documents exactly what its `must` strings do and do not guarantee.
