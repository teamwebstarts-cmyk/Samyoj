# L2 Research Notes — Samyoj → Meta surfaces (from repo)

**Leaf:** `02-samyoj-surfaces.md`  
**Audience:** product + Meta literacy (map user asks onto real files).  
**Source of truth:** repo read 2026-08-29. Do not invent Graph endpoints.  
**Not claimed:** customer production / production-ready. Internal test-deploy is a separate question (`bash start.sh`).  
**Related Graph map:** `.unlazy/meta-learning/research-notes/14-samyoj-surface.md`. Policy/fees: `docs/billing/17-META-WHATSAPP-BILLING-AND-POLICY.md` (spec, not extra call sites).

Hinglish cue: **jo card dikhta hai woh Graph nahi hota** — delivery % local Message rows se aata hai; quality rating alag poll/webhook se.

---

## Dashboard

User ask: replace delivery-rate cards with **quality rating** + **promo / quality-contact messages**.

### What exists today

| Surface | Path | What it shows | Data source |
| --- | --- | --- | --- |
| Live metrics hero | `client/src/pages/DashboardPage.tsx` → `LiveMetricsHero` (`client/src/components/dashboard/LiveMetricsHero.tsx`) | **Total messages sent**, **Delivery %**, **Read rate %**, period picker, MoM-style deltas | `GET /analytics/overview` (`server/src/modules/analytics/routes.ts`) — counts **local** `Message` rows (SENT/DELIVERED/READ), not Graph quality |
| Connect strip | `client/src/components/dashboard/WhatsAppConnectGuide.tsx` | Phone + GREEN/YELLOW/RED hint when `billingApi.usage()` returns `qualityRatings` | `WhatsappNumber.qualityRating` via `getOrgUsage` |
| Layout banner | `client/src/components/Layout.tsx` mounts `QualityRatingBanner.tsx` | Only if rating is YELLOW or RED; links WhatsApp Manager + `/billing` | Same `billingApi.usage()` |
| Billing widget | `client/src/components/billing/BillingUsageWidget.tsx`, `BillingUsageStatsTab.tsx` | First number’s rating; MARKETING labelled “Offers & promos” | Usage + `ConversationCharge` / plan copy |
| Needs attention | `NeedsAttentionCard` on Dashboard | Open chats, failed messages, inbound webhook status | Overview + connect guide |

`LiveMetricsHero` props today: `messagesSent`, `deliveryRate`, `readRate`, `deliveryDelta`, `readRateDelta`, `period`. **No quality rating. No marketing/promo split. No remaining quota.**

Promo / quality-contact: there is **no** Graph call or message type named quality-contact in this repo. Closest existing data:

- Worker `pollConversationAnalytics()` → `GET /{waba-id}?fields=conversation_analytics.start(…).end(…).granularity(DAILY).dimensions(["CONVERSATION_CATEGORY"])` → rows in `ConversationCharge` (`MARKETING` / `UTILITY` / `AUTHENTICATION` / `SERVICE`, …).
- `GET /analytics/meta-health` **hardcodes** `tierLimit = 10000` and **fabricates** category splits (`* 0.52` marketing, etc.) and failure-code shares. Client defines `analyticsApi.metaHealth` but **no page calls it**. Do not treat that as Meta messaging limit.

### Where to put the new UI

1. **Primary:** swap or extend the two `MiniMetricCard`s in `LiveMetricsHero` (wired from `DashboardPage.tsx` ~line 253). Keep the sent-count hero if product still wants volume.
2. **Do not rebuild** `QualityRatingBanner` — it already flags YELLOW/RED globally. Dashboard cards should show GREEN/UNKNOWN too (banner hides those).
3. Reuse `billingApi.usage().qualityRatings` (already fetched in `WhatsAppConnectGuide`) or add quality onto `/analytics/overview` so Dashboard does not double-fetch.
4. Promo / category counts: only honest if you surface `ConversationCharge` (or a new poll). Do not reuse `meta-health` fabricated splits.

### Graph (only what code calls)

| Samyoj feature | Meta path / permission | Purpose | Official doc |
| --- | --- | --- | --- |
| Phone quality poll | `GET /{phone-number-id}?fields=quality_rating,quality_score` · `whatsapp_business_management` | Store `WhatsappNumber.qualityRating` | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers |
| Conversation analytics poll | `GET /{waba-id}?fields=conversation_analytics…` | Fill `ConversationCharge` (legacy conversation-shaped analytics) | https://developers.facebook.com/docs/whatsapp/business-management-api/analytics |
| Quality webhook | inbound field `phone_number_quality_update` (see Quality in code) | Update rating + org alert | https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/reference/phone_number_quality_update |

---

## Quality in code

End-to-end path for **quality rating** (GREEN / YELLOW / RED / UNKNOWN). Throughput **limit strings** are not a first-class column.

| Step | File | What exists |
| --- | --- | --- |
| Graph GET | `server/src/modules/whatsapp/meta.service.ts` `getPhoneNumberQuality` | `quality_rating` or fallback `quality_score.score` |
| Daily poll | `server/src/modules/billing/usage.service.ts` `pollQualityRatings` | Active numbers; writes `qualityRating` |
| Schedule | `server/src/workers/index.ts` | Same 24h interval as `pollConversationAnalytics` |
| Webhook | `META_WEBHOOK_FIELDS` includes `phone_number_quality_update`, `account_alerts`, `business_capability_update`; handler `handlePhoneNumberQualityUpdate` in `server/src/modules/whatsapp/webhook-dispatcher.ts` | Updates `qualityRating`; if YELLOW/RED, `appendOrgAlert(..., 'qualityRating', { currentLimit })`; socket `whatsapp:quality` |
| Persist | `WhatsappNumber.qualityRating` (`server/prisma/schema.prisma`) | String, nullable. **No** `messaging_limit` / `current_limit` column |
| `current_limit` | Same dispatcher + `handleAccountStateUpdate` | Passed through into **org settings alerts JSON** only (`currentLimit`, `maxLimit`) — not queried for UI remaining quota |
| Read API | `getOrgUsage` → `qualityRatings[]`; `GET /analytics/meta-health` quality.rating | Banner + billing + connect guide |
| UI | `QualityRatingBanner.tsx` (Layout), `WhatsAppConnectGuide.tsx`, Billing usage tabs, platform admin account tables | Dashboard **hero does not** use this |

Template quality is separate: list templates requests `quality_score`; webhooks `message_template_quality_update` / `message_template_status_update`. That is **template** quality, not phone quality.

**Missing vs the ask:** no stored Meta messaging-limit tier; no dashboard remaining-broadcast from Graph; no “quality-contact message” product object.

---

## Campaigns

Covers remaining quota, campaign analytics vs retargeting, click tracking, website button.

### Remaining message quota / broadcast remaining

Three different ceilings. Code does **not** mix them.

| Layer | What it is | Where | Graph stored? |
| --- | --- | --- | --- |
| **Samyoj campaign daily cap** | Org JSON `settings.campaigns.dailySendLimit` default **5000** + `dailyBudgetInr` default **5000** | `server/src/modules/campaigns/types.ts` `DEFAULT_CAMPAIGN_SETTINGS`; enforced in `server/src/modules/campaigns/quota.ts` (`assertDailySendQuota`, `reserveCampaignQuota`, `CampaignQuotaLedger`) | No |
| **API for remaining** | `GET /campaigns/quota` → `getDailySendUsage` returns `{ sentToday, batchSize, batchDelayMs }` — **not** `remaining`, **not** Meta limit | `server/src/modules/campaigns/routes.ts`; client `campaignApi.quota` in `client/src/services/api.ts` | — |
| **Quota UI** | **None.** `campaignApi.quota` is unused in pages. Spec leftover: `docs/ui-specs/CAMPAIGNS_FRONTEND_DOCUMENTATION.md` “sentToday of limit remaining” | Put new UI on `CampaignsPage.tsx` toolbar and/or campaign wizard confirm, optionally a third card on `LiveMetricsHero` | — |
| **Samyoj plan quota** | `getOrgEntitlements` — feature flag `campaigns`, plus seats / contacts / WA connect slots / AI. **No message-count SKU** | `server/src/modules/billing/entitlements.service.ts`. Locked plan blocks send. TARGET catalog in `docs/billing/02-ENTITLEMENTS-AND-QUOTAS.md` is **spec, not shipped limits** | No |
| **Meta messaging limit** | Unique-user / throughput tiers on the phone number | Webhook may stash `current_limit` in alerts. `meta-health` **invents** `tierLimit = 10000`. **No** `GET /{phone-number-id}?fields=messaging_limit_tier` (or similar) in `meta.service.ts` | **Not stored as Graph truth** |

Hinglish: **Samyoj 5000/day = hamara throttle. Meta ka messaging limit Graph se nahi rakha. Plan quota messages nahi ginta.**

### Campaign analytics today vs retargeting tabs

| Piece | Path | Today |
| --- | --- | --- |
| Detail panel | `client/src/components/campaigns/CampaignAnalyticsPanel.tsx` | Two `section`s: `overview` (failed/pending banners only) and `errors` (failed count + top errors + retry). **No charts. No retargeting.** |
| Host tabs | `client/src/pages/CampaignsPage.tsx` `detailSection` | If `failedCount > 0`: **Summary** vs **Failed**. List page period filter is **All time / This month** (campaign list), not analytics vs retarget |
| API | `getCampaignAnalytics` in `server/src/modules/campaigns/service.ts` | Latest `runGeneration`; `byStatus` counts; `deliveryRate` / `readRate` vs `totalContacts`; `topErrors` |
| Recipients | Prisma `CampaignRecipient` | `status` = `MessageStatus`: **PENDING, SENT, DELIVERED, READ, FAILED, AMBIGUOUS**. Timestamps `sentAt` / `deliveredAt` / `readAt`. Synced from webhook via `syncCampaignRecipientFromWebhook` |
| Retargeting | — | **No feature.** Only unrelated comment in `server/src/utils/safe-webhook-url.ts` (socket URL). No audience-from-FAILED/READ tabs |

**Where to put new UI:** extra tabs beside Summary/Failed in `CampaignsPage.tsx` view-only slideover; feed from `CampaignRecipient.status` (and optional new queries). Retargeting would be **new** (e.g. create campaign from FAILED/READ phones) — not an existing Meta analytics tab.

### Click tracking

**Absent as events.** Template and inbox can **send** URL / CTA buttons. Reports **estimate** CTR.

| Exists | Does not exist |
| --- | --- |
| Template button type `URL` labelled “Visit website (URL)” — `TemplateButtonEditor.tsx` | No webhook field for button clicks |
| Inbox interactive `cta_url` — `InteractiveComposer.tsx`, `server/src/modules/messages/interactive.ts` | No `clickedAt` on `CampaignRecipient` or `Message` |
| `clickThroughRate: Math.min(readRate * 0.4, 25)` in `server/src/modules/analytics/routes.ts` (universal templates) → Reports `UniversalTemplateTable.tsx` “Est. CTR” | No Graph insights call for template button clicks |

Do not present Est. CTR as Meta click data.

### WhatsApp website button

**Partial, not a Business Profile product.**

- **Yes:** template CTA **Visit website (URL)**; library clone URL suffix (`templateLibrary.ts` `normalizeWebsiteUrl`); session **CTA URL** interactive (`cta_url`).
- **No:** Graph `whatsapp_business_profile` / `websites` field, Click-to-WhatsApp ads button, or a Settings “add website on WhatsApp” flow.
- Clicks on those URL buttons are **not** tracked (see above).

If the ask is “show website button on the WhatsApp profile,” that is **new Graph + UI**, not an existing Samyoj feature.

### Campaign Graph send (already in product)

| Feature | Meta path | File | Purpose | Official doc |
| --- | --- | --- | --- | --- |
| Broadcast send | `POST /{phone-number-id}/messages` type `template` | campaigns worker / `meta.service.ts` `sendMessage` | Template blast | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages |
| Delivery ticks | inbound `messages` status | `provider-status.ts` → `syncCampaignRecipientFromWebhook` | SENT/DELIVERED/READ/FAILED | https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components |

---

## Template library

User ask: Meta library vs **this account**; confirm create form category + language.

### What exists today

| Surface | Path | Today |
| --- | --- | --- |
| Library page | `client/src/pages/TemplateLibraryPage.tsx` | Tabs `sourceTab`: **`meta`** vs **`account`** (`LibrarySourceTab` in `client/src/utils/templateLibrary.ts`) |
| Meta tab | `templateApi.library` → `GET /templates/library` → `MetaWhatsAppService.listMessageTemplateLibrary` | `GET /message_template_library?…` (search, language hardcoded `en_US` on the page, usecase, limit) |
| Account tab | `templateApi.list({ all: 'true' })` | WABA templates already on this number (`listMessageTemplates`) |
| Clone | `createMessageTemplateFromLibrary` | `POST /{waba-id}/message_templates` with `library_template_name` (+ optional button inputs). Category forced **UTILITY or AUTHENTICATION** (not MARKETING clone) |
| Custom create | `client/src/components/templates/TemplateCreateForm.tsx` | **Category and language are already there** — `AppSelect` `template-category` (`CATEGORY_OPTIONS`: UTILITY / MARKETING / AUTHENTICATION) and `template-language` (`LANGUAGE_OPTIONS`). Also name, header type/media, body, footer, buttons, examples |
| Wizard | `TemplateWizardPage.tsx` / library review steps | Same form model; library path collects URL/phone for clone |

### What is actually missing (not category/language)

- **Not missing:** category + language on `TemplateCreateForm.tsx`. Do not rebuild those fields for this ask.
- **Partial:** `LANGUAGE_OPTIONS` is **eight** locales (`en_US`, `en_GB`, `hi`, `hi_IN`, `es`, `es_ES`, `pt_BR`, `ar`) — not Meta’s full language list.
- Library browse language is **fixed `en_US`** on `TemplateLibraryPage` (query param, not a picker).
- Phone **quality** and template **quality_score** are not shown on the create form (list templates does request `quality_score`).
- Entitlement gate: `canUseFeature('templates')` can block library additions by plan.

### Graph

| Feature | Meta path | File | Purpose | Official doc |
| --- | --- | --- | --- | --- |
| Browse Meta library | `GET /message_template_library` | `meta.service.ts` `listMessageTemplateLibrary`; `templates/routes.ts` `GET /library` | Search Meta’s catalog | https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/template-library |
| Clone from library | `POST /{waba-id}/message_templates` (`library_template_name`) | `createMessageTemplateFromLibrary` | SAMYOJ-11 clone | same library doc |
| List / create custom | `GET` / `POST /{waba-id}/message_templates` | `meta.service.ts`; `templates/routes.ts` | Account library + MARKETING/UTILITY/AUTHENTICATION create | https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates |

**Where to put new UI:** Meta vs account is **already** the library page. Extra filters (language picker, quality) belong on `TemplateLibraryBrowseStep` / `TemplateLibraryPage.tsx`, not a new page. Custom create gaps (more locales) belong in `LANGUAGE_OPTIONS` + `TemplateCreateForm.tsx`.

---

## Inbox window

User ask: Inbox **active / inactive** filter = **24h customer service window open vs closed** (not CRM Open/Pending).

### What exists today

| Piece | Path | Today |
| --- | --- | --- |
| Window math (server) | `isWithin24HourWindow` in `meta.service.ts`; `resolveCs24hWindowOpensAt` in `server/src/modules/inbox/service-window.ts` | Open if stored/inbound/user-call timestamp is &lt; 24h old |
| Persist | `Conversation.cs24hWindowOpensAt` | Set on inbound (`inbound-side-effects.ts`) |
| Thread API | `GET /inbox/:id` returns `serviceWindow: { open, expiresAt, lastInboundAt, windowOpensAt }` | `inbox/routes.ts` |
| Thread UI | `ServiceWindowBanner.tsx` / `ServiceWindowBadge` in `ChatHeader.tsx`; composer locks free-text when closed (`ChatThread.tsx`, `useInboxSender.ts`) | Closed → template (or campaign link) |
| Client helper | `client/src/components/inbox/inboxUtils.ts` `isWithin24HourWindow` / `getServiceWindowInfo` | Same 24h rule |
| **List filters** | `InboxListHeader.tsx` chips: All, Unread, Unreplied, **Open**, Favorites, **Pending**, Tickets, AI Bot | **Open / Pending = `Conversation.status` CRM** (`OPEN` / `PENDING` / `CLOSED` / `SNOOZED`) via `buildInboxListParams` → `GET /inbox?status=` |
| List row | `ConversationItem.tsx` | Shows CRM status pill. **No** CSW open/closed. Client `Conversation` type has **no** `cs24hWindowOpensAt` / `serviceWindow` |
| Send gate | `inbox/routes.ts`, `messages/send.service.ts` | TEXT / interactive / media / reaction rejected outside window; templates allowed |

Hinglish: **list ka Open = ticket/chat status. 24h window alag cheez hai — abhi sirf open thread pe banner.**

There is **no** list query for `serviceWindow=open` / `cs24hWindowOpensAt gte now-24h`.

### Where to put the new UI

1. New chips (e.g. **Window open** / **Window closed**) in `InboxListHeader.tsx` + `ListChip` + `buildInboxListParams.ts` (Vitest already locks the filter contract).
2. Server: `GET /inbox` in `inbox/routes.ts` — filter on `cs24hWindowOpensAt` (and/or last inbound), **not** `status=OPEN`.
3. Optional row badge: extend list payload + `ConversationItem.tsx` so the list matches the thread banner.
4. Do **not** overload existing Open/Pending chips — agents already use those for CRM.

### Graph

24h CSW is a **Cloud API send rule**, not a list endpoint. Samyoj implements the clock locally.

| Feature | Meta path | File | Purpose | Official doc |
| --- | --- | --- | --- | --- |
| Free-form send inside window | `POST /{phone-number-id}/messages` type `text` / `interactive` / media | inbox + `send.service.ts` | Session messages | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages |
| Template when closed | same, type `template` | Inbox Template composer | Re-open conversation (paid category rules still apply) | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates |
| Error 131047 | inbound status errors | service-window tests / send path | Window closed at Meta | https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes |

---

## Ask → file map (checklist)

| # | User ask | Exists today | Put new UI |
| --- | --- | --- | --- |
| 1 | Quality + promo on dashboard | Rating in banner/connect/billing; **not** in `LiveMetricsHero`. Promo = `ConversationCharge` MARKETING, unused on dashboard. `meta-health` splits are fake | `LiveMetricsHero` via `DashboardPage.tsx`; honest category from charges if needed |
| 2 | Remaining quota | Campaign 5000/day in `quota.ts`; `GET /campaigns/quota` unused in UI; **no Graph limit stored**; plan has no message quota | Campaigns toolbar / wizard; do not show Meta remaining until a real Graph field is persisted |
| 3 | Template library Meta vs account | **Done** on `TemplateLibraryPage`. `TemplateCreateForm` **already has** category + language | Language picker / more locales only if product wants them |
| 4 | Inbox active = 24h window | Thread banner + send gate; list Open ≠ CSW | New list chips + `GET /inbox` filter on `cs24hWindowOpensAt` |
| 5 | Analytics vs retargeting tabs | Summary / Failed only; `CampaignRecipient` statuses; **no retargeting** | New tabs on `CampaignsPage` detail; retarget = new campaign from statuses |
| 6 | Click tracking | URL buttons yes; click events **no**; Est. CTR is `readRate * 0.4` | Only after a real click signal exists (not in code today) |
| 7 | WhatsApp website button | Template URL + inbox `cta_url` only | Business-profile website would be new Graph + Settings; not present |
