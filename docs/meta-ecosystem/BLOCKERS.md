# Meta ecosystem — Phase 0/1 blockers

**Status:** Phase 0 landed. Phase 1 Lead Ads implemented 2026-09-23 (connect + ingest + Settings/Facebook → Leads).  
**Rechecked:** 2026-09-23 against the current repository and the cited Meta docs.

Agreed product boundaries remain: WhatsApp stays intact, Facebook/Instagram do not use `whatsappNumberId`, Ads Manager is not rebuilt, and inboxes remain separate by platform.

## 1. Non-WABA webhook ownership and durability

**Phase 0 decision (done):** Dedup only when a Channel resolves the Page to exactly one active org. Claim + complete `ProviderWebhookEvent`. Unmatched Page: verify signature, ack, log, do not invent an org.

## 2. Channel migration and canonical tenancy

**Phase 0 decision (done):** `Channel` is additive only. WhatsApp remains keyed by `WhatsappNumber`.

## 3. Phone-less Lead Ads data model

**Phase 1 decision (done):** Do **not** make `Contact.phone` nullable. Phone-less Instant Forms create a `Lead` with `contactId = null`, `metaLeadId` set, `source = META_ADS`. If a normalizable phone exists and the org has an active WhatsApp number, upsert Contact on that number (existing unique). No fake phones.

## 4. Page-only lead routing and source filtering

**Phase 1 decision (done):** `GET /api/leads?source=META_ADS` lists without requiring `activeWhatsappNumberId`. Manual lead create still requires WhatsApp. META_ADS rows are not created via POST — Instant Form webhook only.

## 5. Meta permission, login, and API-version matrix

**Phase 1 scopes requested (connect flow):**
`pages_show_list,pages_manage_metadata,pages_read_engagement,leads_retrieval`

Subscribe uses `POST /{page-id}/subscribed_apps?subscribed_fields=leadgen` with the Page token. Graph version stays `config.meta.apiVersion` (default **v21.0**); WhatsApp default was not changed.

**Still open / live proof needed:**
- App Review + Business Verification for the above scopes.
- If Graph rejects leadgen subscribe without `ads_management` / `pages_manage_ads`, record the exact error here and do **not** invent a second OAuth product. Connect still saves the Channel; `subscribeError` is returned on the connect response.
- Confirm least-privilege in the live App Dashboard before the review screencast.

Until live subscribe is proven on a real Page, treat App Review scope confirmation as the remaining Phase 1 operational blocker — product code ships with the scopes above.
