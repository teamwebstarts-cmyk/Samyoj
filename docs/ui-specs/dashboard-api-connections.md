# Dashboard Home — API Connections

**Scope:** `DashboardPage` (`/`) and `client/src/components/dashboard/*` only.  
**Envelope:** All authenticated JSON APIs use `sendSuccess` → `{ success: true, data: T }`. Axios clients read `response.data.data`.  
**Auth:** Bearer `Authorization` + org from JWT. Scoped metrics also send `X-WhatsApp-Number-Id` (set by `WhatsAppNumberContext` via `setActiveWhatsappNumberId`).

---

## Endpoint matrix (by UI block)

| UI block | Method | Path | Query / body | Auth | Response shape used (`data`) | Client | Notes / gaps |
|---------|--------|------|--------------|------|------------------------------|--------|--------------|
| KPIs + Needs attention + Message performance donut | `GET` | `/api/analytics/overview` | `days=7\|14\|30` (default 7) | Bearer + org + `X-WhatsApp-Number-Id` | `{ days, messagesSent, messagesDelivered, messagesDeliveredOnly, messagesRead, messagesFailed, messagesPending, deliveryRate, readRate, failedMessages, activeConversations, totalContacts, deltas }` | `analyticsApi.overview` → `DashboardPage` | Rates are numeric strings (e.g. `"45.5"`); UI appends `%`. `activeConversations` / `totalContacts` deltas are always `null`. Reloads on period change and active-number switch. |
| Connection strip (numbers) | `GET` | `/api/whatsapp/numbers` | — | Bearer + org | **Array** of `{ id, phoneNumber, phoneNumberId, wabaId, isActive, createdAt }` (not `{ numbers }`) | `whatsappApi.numbers` → `WhatsAppConnectGuide` | Client hardens both array and `{ numbers }` envelopes. Prefer context active id, then DB `isActive`, then first. |
| Connection strip (OAuth URL) | `GET` | `/api/whatsapp/connect-url` | `redirectUri` (optional; dashboard uses `{origin}/settings/whatsapp/callback`) | Bearer + org | `{ url, state, redirectUri }` | `whatsappApi.connectUrl` | Platform Meta App ID/Secret only from server `.env` — no App ID/Secret UI. |
| Connection strip (disconnect) | `DELETE` | `/api/whatsapp/numbers/:id` | — | Bearer + org | `{ disconnected: true }` | `whatsappApi.disconnect` | After success, refreshes number context + connect URL. |
| Quality chip | `GET` | `/api/billing/usage` | — | Bearer + org | `{ period, totalConversations, totalCostInr, byCategory, qualityRatings[{ phoneNumber, qualityRating, wabaId }], messagesWithPricing }` | `billingApi.usage` → `WhatsAppConnectGuide` | Match rating by digit-normalized phone; no false fallback to another number’s rating. Layout-level `QualityRatingBanner` uses the same endpoint. |
| Incoming webhook chip | `GET` | `/api/whatsapp/webhook-status` | — | Bearer + org | `{ connected, phoneNumber?, wabaId?, webhookUrl, subscribed }` (or `{ connected: false, … }` when no number) | `whatsappApi.webhookStatus` → `WhatsAppConnectGuide` | Real Meta subscribe flag — **not** a fake “Cloud API 99%” metric. Shown as Incoming on/off. |
| Upcoming campaigns | `GET` | `/api/campaigns` | Parallel: `status=SCHEDULED&limit=20` and `status=DRAFT&limit=20` | Bearer + org + `X-WhatsApp-Number-Id` | `{ campaigns, total, page, limit, summary }` | `campaignApi.list` → `DashboardPage` → `UpcomingCampaignsCard` | Client parses `{ campaigns }` (also tolerates raw array). Filters to upcoming scheduled + drafts, max 3. |
| Getting started checklist | `GET` | `/api/onboarding/status` | — | Bearer + org | `{ steps[{ id, title, description, completed, href? }], progress, isReady, completedCount, totalSteps, stats }` | `onboardingApi.status` → `GettingStartedCard` | Hidden when all steps complete. Org-wide (not number-scoped). |

---

## Field mapping — analytics overview → UI

| UI | Field(s) |
|----|----------|
| Needs attention · open chats | `activeConversations` |
| Needs attention · failed | `failedMessages` (same as `messagesFailed`) |
| KPI · Messages sent | `messagesSent` + `deltas.messagesSent` |
| KPI · Delivery rate | `deliveryRate` + `deltas.deliveryRate` |
| KPI · Read rate | `readRate` + `deltas.readRate` |
| KPI · Active chats | `activeConversations` (+ null delta) |
| KPI · Contacts | `totalContacts` (+ null delta) |
| Donut center | `messagesSent` |
| Donut · Delivered (funnel) | `messagesDelivered` (= DELIVERED + READ) |
| Donut slice · still delivered | `messagesDeliveredOnly` |
| Donut · Read / Failed / Pending | `messagesRead` / `messagesFailed` / `messagesPending` |

---

## Reload behavior

| Trigger | What reloads |
|---------|----------------|
| Mount | Overview + campaigns + onboarding; ConnectGuide numbers/usage/webhook/connect-url |
| Period select (`days`) | Overview only |
| Active WhatsApp number change (`useOnActiveNumberChange`) | Overview + campaigns + onboarding (`DashboardPage`) |
| Active number id change | ConnectGuide reloads (depends on `activeNumber?.id`) |
| OAuth success postMessage | ConnectGuide + `refreshNumbers` |
| Disconnect | Clears local strip state; `refreshNumbers`; reloads connect-url |

---

## Client modules

| Module | File |
|--------|------|
| Axios + auth headers | `client/src/services/api.ts` |
| Dashboard page | `client/src/pages/DashboardPage.tsx` |
| Connect strip | `client/src/components/dashboard/WhatsAppConnectGuide.tsx` |
| Active number header | `client/src/contexts/WhatsAppNumberContext.tsx` |

## Server modules

| Module | File |
|--------|------|
| Overview | `server/src/modules/analytics/routes.ts` |
| WhatsApp | `server/src/modules/whatsapp/routes.ts` |
| Campaigns | `server/src/modules/campaigns/routes.ts` |
| Billing usage | `server/src/modules/billing/routes.ts` + `usage.service.ts` |
| Onboarding | `server/src/modules/onboarding/routes.ts` |

---

## Known gaps (acceptable / out of scope)

1. **Campaign `status` filter** is single-value (`equals`) on the server — dashboard issues two parallel list calls instead of `status=in:(SCHEDULED,DRAFT)`.
2. **Onboarding “approve_template”** currently completes if any campaign with a template name exists (not Template store approval) — product semantics, not a dashboard wire bug.
3. **No sparklines / activity feed / AI tip** on home — intentional; do not invent fake stats.
4. **Meta App ID/Secret** remain server-only; Connect flow is OAuth-only for normal users.
5. **CampaignsPage** still uses `data.data.numbers` for WhatsApp numbers (wrong envelope for `/whatsapp/numbers`); outside dashboard scope — dashboard ConnectGuide and NumberContext parse correctly.
