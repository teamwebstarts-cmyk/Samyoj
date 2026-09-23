# Architecture — what exists, what phase 0 must add

**Code reviewed 2026-09-23. No product code changed in this pass.**  
Reuse WhatsApp. Do not fork a second CRM.

## Already built (reuse)

| Piece | Where | Reuse for |
|-------|--------|-----------|
| Encrypted token | `WhatsappNumber.accessToken` AES-GCM | Same helper on a Page token |
| OAuth state | `server/src/modules/whatsapp/connect-oauth-state.ts` | New state purpose `page`, same redirect whitelist |
| Webhook durability | `ProviderWebhookEvent` claim/complete | New `object` values, same table |
| Org tenancy | `organizationId` on every row | Page belongs to one org |
| Pipeline | `Lead` + `LeadStage` | Instant Form becomes a `Lead` |
| Inbox shell | `/inbox` 3-pane | Later Messenger / IG are **copies of this shell**, not a mixed list |
| Send template | existing campaign/inbox send | Optional follow-up only |
| AI | `AiBot` `CHAT` \| `CALL` | Do not add a third channel enum until IG inbox exists |

## Code facts that block Meta (do not paper over)

1. **`no Channel` model.** IG/FB cannot use `whatsappNumberId`. That key is number isolation (`whatsapp_numbers`).
2. **Webhooks drop anything else.** `processWebhookPayload` returns immediately unless `object === 'whatsapp_business_account'` (`server/src/workers/webhook.processor.ts`). `dispatchNonMessageWebhookFields` does the same (`server/src/modules/whatsapp/webhook-dispatcher.ts`). A `leadgen` POST is discarded.
3. **Leads API refuses work without a WhatsApp number.** `server/src/modules/leads/routes.ts` throws `Connect a WhatsApp number before creating leads`. Schema allows `Lead.whatsappNumberId` null; the route does not.
4. **`Contact.phone` is required.** Unique `(organizationId, whatsappNumberId, normalizedPhone)`. A form with only email cannot be inserted.
5. **`ContactSource`** is only `MANUAL | IMPORT | INBOUND | OUTBOUND`. No Meta Ads value.
6. **Contact detail 404s** when `whatsappNumberId` is missing (`contacts/service.ts`).
7. **`Lead` has no `amount`, no `metaLeadId`.** Do not promise ₹ revenue or dedupe.
8. **`/reports` redirects to Billing.** Analytics is not “turn reports back on”.

## Add once (phase 0), then every phase uses it

```text
Channel
  organizationId, platform (WA|FB|IG), platformAccountId,
  encrypted token, isActive
  WhatsappNumber stays. Do not delete it. Backfill later.

ContactPlatformIdentity
  contactId, platform, externalId   unique per org

Lead
  channelId nullable
  metaLeadId unique per org
  source string already exists — set META_ADS
  amount stays absent until phase 6

Contact.phone
  stays required for WhatsApp contacts
  lead-only row: phone null ONLY if email or metaLeadId exists
  do not invent a fake phone
```

Webhook router: if `object` is `page` and `field` is `leadgen`, claim the event, resolve Page → org via `Channel`. Anything else still returns. Do not parse Instagram in phase 0.

## Do not reuse

| Tempting reuse | Why not |
|----------------|---------|
| `meta.service.ts` WhatsApp send | Different Graph path. New small Page client. |
| `ConversationCharge` | WhatsApp conversation cost, not ad spend |
| `X-WhatsApp-Number-Id` as the only header | Page work uses channel id |
| Stuffing Page id into `phoneNumberId` | Breaks SAMYOJ-49 isolation |
| One Inbox query for all platforms | Product decision: separate lists |

## API surface (new, small)

| Phase | Route | Notes |
|-------|--------|--------|
| 1 | `POST /api/facebook/connect` | Facebook Login, save Page `Channel` |
| 1 | existing `POST /api/whatsapp/webhook` | Router only. No second public URL. |
| 1 | `GET /api/leads?source=META_ADS` | Same pipeline |
| 2 | none | Referral already on the WA message payload |
| 3–4 | `POST /api/channels/:id/messages` | Text only, 24h check |
| 5 | `GET /api/facebook/ads-summary` | Read Insights. Cache. No write. |

Credentials stay in `server/.env`. Never a settings field.
