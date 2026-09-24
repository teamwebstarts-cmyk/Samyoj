# Meta ecosystem — Phase 0/1 blockers

**Audit:** [META_ECOSYSTEM_AUDIT_REPORT_2026-09-24.md](META_ECOSYSTEM_AUDIT_REPORT_2026-09-24.md).
**Meta dashboard evidence:** [META_APP_CONFIGURATION_2026-09-24.md](META_APP_CONFIGURATION_2026-09-24.md).
**Status:** Phase 0–5 code paths are hardened and regression-tested, but live Meta access and signed/public delivery are still unavailable.
**Rechecked:** 2026-09-24 against the current repository and the cited Meta docs.

Agreed product boundaries remain: WhatsApp stays intact, Facebook/Instagram do not use `whatsappNumberId`, Ads Manager is not rebuilt, and inboxes remain separate by platform.

## 1. Non-WABA webhook ownership and durability

**Current decision:** Dedup only when a Channel resolves the Page to exactly one active org. Claim + complete `ProviderWebhookEvent`. Unmatched Page: verify signature, ack, log, do not invent an org.

**Resolved in code:** the HTTP object gate now admits `instagram` and routes it through signature validation and the existing non-WhatsApp dispatcher. Signed/public Meta delivery proof remains open.

## 2. Channel migration and canonical tenancy

**Phase 0 decision (done):** `Channel` is additive only. WhatsApp remains keyed by `WhatsappNumber`.

**Resolved in code:** `save-page-channel.ts` rejects an active matching Page/IG Channel in another organization with 409 and no write. Explicit transfer is not part of Phase 0–5.

## 3. Phone-less Lead Ads data model

**Phase 1 decision (done):** Do **not** make `Contact.phone` nullable. Phone-less Instant Forms create a `Lead` with `contactId = null`, `metaLeadId` set, `source = META_ADS`. If a normalizable phone exists and the org has an active WhatsApp number, upsert Contact on that number (existing unique). No fake phones.

## 4. Page-only lead routing and source filtering

**Phase 1 decision (done):** `GET /api/leads?source=META_ADS` lists without requiring `activeWhatsappNumberId`. Manual lead create still requires WhatsApp. META_ADS rows are not created via POST — Instant Form webhook only.

## 5. Meta permission, login, and API-version matrix

**Connect flow requests (24 Sep 2026):**
`pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`, `pages_messaging`, `leads_retrieval`, `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `ads_read`.

No `ads_management`. Subscribe uses the Page token. Graph version stays `config.meta.apiVersion`.

The supplied dashboard screenshots show the Page permissions and use-case cards, but
`instagram_basic` and `instagram_manage_messages` still show **Add to App**;
`instagram_manage_comments` is not visibly confirmed. Keep the existing Page connection for
Facebook testing, and configure all three Instagram permissions before reconnecting for the
Instagram test.

**Live app check (same `META_APP_ID`, Development mode, not Live):**
- Approved: `whatsapp_business_messaging`, `whatsapp_business_management`, `public_profile`, `openid`.
- Rejected, still in a submission: the Page scopes above plus `ads_read`, `ads_management`, `pages_manage_ads`, Marketing API Access Tier.
- Instagram scopes are not on the privilege list at all.
- App webhook subscription is only `whatsapp_business_account`. `page` and `instagram` are not subscribed.
- Valid OAuth redirect includes one Codespace `/settings/facebook/callback`. `https://app.samyoj.com/settings/facebook/callback` is not in the list.

Until Meta grants those use cases, Facebook’s dialog returns Invalid Scopes. Samyoj cannot approve that from code. Do not add `ads_management` to the connect string if a later Graph error asks for it — record the error here instead.

## 6. Audit-only gaps before production

- Atomic private-reply claiming prevents concurrent duplicate sends; a crash between claim and provider send remains a documented durability ceiling.
- Comment-to-DM identity/banner and persisted `live_comments` state remain out of Phase 0–5.
- Ads account selection is explicit, but live `ads_read` and Ads Manager comparison are unproven.
- Production Facebook OAuth callback is missing from the live app redirect list.
- The live app has only the WhatsApp webhook subscription; `page` and `instagram` are not subscribed.
