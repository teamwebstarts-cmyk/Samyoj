# Growth surfaces phase — product decisions

**Date:** 2026-08-29  
**Status:** implementing waves 1–3 on existing surfaces (`growth-surfaces-impl-2026-08-29`)  
**Full UI/logic spec (prompt recheck):** [`GROWTH_SURFACES_SPEC_2026-08-29.md`](./GROWTH_SURFACES_SPEC_2026-08-29.md) — waves, every original ask, do/don't, what we refused (instant multi-tenant approve, fake Meta remaining, React tab).  
**Sources:** `docs/product/research-notes/01-meta-policy.md`, `02-samyoj-surfaces.md`, `03-competitors-catalog.md`  
**Not claimed:** customer production-ready. Internal test-deploy remains `bash start.sh`.

This is the phase contract. Build in the **Build order** below. Do not start SAMYOJ-35 TARGET billing, Phase C drips, or live WebRTC transfer as part of this work.

---

## DECISION table

| Ask | Call | Where it lives | Why |
|-----|------|----------------|-----|
| **Quality rating** on dashboard (replace delivery % cards) | **GO** | `LiveMetricsHero` on `DashboardPage.tsx`; keep `QualityRatingBanner` for YELLOW/RED | Phone `quality_rating` already polled. Delivery % is local Message math, not Meta quality. Users asked for quality + promo mix **instead of** vanity delivery cards. |
| Promo / **quality-contact** mix | **GO-lite** | Same hero: MARKETING vs UTILITY/AUTH/SERVICE from `ConversationCharge` only | No Graph object named “quality-contact.” Honest split = conversation_analytics categories we already poll. **Do not** use `GET /analytics/meta-health` (hardcoded 10000 + fake 52% marketing). |
| **Quota** remaining (today’s broadcasts) | **GO (honest labels)** | Campaigns toolbar + optional third hero card | Show **Samyoj** `sentToday` vs org daily send cap (`GET /campaigns/quota`, unused in UI). Show Meta **tier enum** (`TIER_250`…) when we fetch it — **never** invent “187 left” from Graph. |
| **Green tick** / OBA help | **GO checklist UI; NO-GO selling the badge** | Settings → WhatsApp → Profile / verification strip | Meta grants OBA (docs: **blue** check; India slang “green tick”). Tech Provider cannot guarantee approval. Charge for **prep labor**, not the tick. |
| First-party **Template catalog** (not Meta library dump) | **GO starter pack** | `TemplateLibraryPage` — featured row above Meta/account tabs | Keep Meta library as advanced. Ship **3** UTILITY/AUTH starters (`en_US` + `hi_IN`) via official `library_template_name` clone. |
| Instant-approve all tenants from one WABA | **NO-GO** | — | Meta reviews **each WABA**. Copying JSON across orgs does not skip review. Ban risk if we claim otherwise. |
| Category + language on create | **NO BUILD** | `TemplateCreateForm.tsx` already has both | Gap is **more locales** + library browse language picker — DEFER unless users hit the 8-locale list. |
| **Click tracking** | **DEFER** (v1) | — | Cloud API does **not** send URL-click webhooks. Reports “Est. CTR” is `readRate * 0.4` — **noise**. Real clicks = our redirect + consent. Worth it later for agencies, not SMB v1. |
| **Inbox active** / inactive (24h window) | **GO** | Conversation list filter chip — **not** CRM Open/Pending | Window already on the thread (`cs24hWindowOpensAt`, `isWithin24HourWindow`). List still filters CRM status. One toggle: window open vs closed. |
| **WhatsApp button** for websites | **GO v1** | Settings → Integrations (or WhatsApp tab): `wa.me` snippet | Official click-to-chat. Lock to `whatsappNumberId`. No App ID in snippet. |
| **Retargeting** campaigns | **GO core** | Campaign detail tabs next to Summary/Failed | AiSensy-style cohorts from `CampaignRecipient`. Template outside CSW; session message only if window open. Consent fail-closed. |

---

## Quality rating (dashboard)

**GO.** Swap `LiveMetricsHero` delivery % / read % cards for:

1. **Quality** — GREEN / YELLOW / RED / UNKNOWN from `WhatsappNumber.qualityRating` (already: `getPhoneNumberQuality`, `pollQualityRatings`, `phone_number_quality_update`).
2. **Category mix** — last period MARKETING vs rest from `ConversationCharge`, labeled “Offers & updates” not “quality-contact” unless we invent a Samyoj definition.

Keep sent-count. Keep global `QualityRatingBanner` for YELLOW/RED. Do not rebuild WhatsApp Manager — deep-link it.

**Do not:** show discontinued Flagged/Restricted statuses; mix template `quality_score` into the phone card.

---

## Quota (remaining messages)

**GO with three labeled layers — never one fake bar.**

| Layer | Show | Do not show |
|-------|------|-------------|
| Samyoj daily campaign cap | `sentToday` / org limit (default 5000) on **Campaigns** page + wizard confirm | Calling it “Meta quota” |
| Meta messaging limit | Tier name after we **add** Graph `whatsapp_business_manager_messaging_limit` | `tier − our_sends` as remaining unique users |
| Plan entitlements | Locked / campaigns feature flag | Message-count SKU (not shipped) |

Meta cap = **unique users outside CSW**, moving 24h, **portfolio-wide**. Inbox session replies do not consume it. `meta-health`’s 10000 is a lie — delete or hide before any customer sees it.

---

## Green tick (Official Business Account)

**GO:** Settings checklist + `oba_status` if Graph returns it + WhatsApp Manager link.  
**NO-GO:** “Buy green tick,” guarantee, Meta Verified resale, cloning another brand’s badge.

Honest India copy: “Official check from Meta (often called green tick). We help you apply. Meta decides.”

Paid SKU allowed only as **onboarding/docs help**, never as purchasing Meta’s badge.

---

## Template catalog

**GO:** Featured 3 templates (order update, appointment reminder, OTP/auth) — UTILITY/AUTHENTICATION, `hi_IN` + `en_US`, clone via existing SAMYOJ-11 library API, then **that customer’s** WABA still waits for Meta APPROVED.

**DEFER:** marketing festival packs, AI generator, “100 ready to send.”  
**NO-GO:** skip-review by copying templates across tenant WABAs.

Keep Meta library tab; do not delete it — just stop treating it as the home screen.

**Category/language:** already on create. Only add locales if support tickets show missing languages.

---

## Click tracking

**DEFER** for this phase.

Need: our HTTPS redirect, campaign+recipient ids, privacy policy, no silent tracking of personal URLs. Meta will not tell us who tapped Visit website.

Until then: **remove or relabel** Reports “Est. CTR” so we stop lying. That is a one-line honesty fix (can ship with dashboard).

Agencies who pay for ads/CTWA are a later surface (`ctwa_clid`) — not the website widget.

---

## Inbox active / inactive

**GO.** One filter on the conversation list:

- **Active** = 24h customer-service window **open** (free-form allowed).
- **Inactive** = window **closed** (template only).

Do **not** overload CRM Open / Pending / Snoozed. Those stay. Copy: “Can reply now” vs “Needs template.”

---

## WhatsApp button

**GO v1** in Settings → Integrations (or WhatsApp numbers panel): preview, prefilled text, copy `<a href="https://wa.me/91…">` snippet, optional float CSS. Number = active `whatsappNumberId`.

**DEFER:** Shopify plugin, open-on-load bubble, per-page product URL.  
**NO-GO:** fake in-page WhatsApp chat; widget as broadcast opt-in; App ID/Secret in JS.

---

## Retargeting

**GO core** on campaign detail (extend `CampaignsPage` slideover + `CampaignAnalyticsPanel`):

| Tab | Cohort | Next action |
|-----|--------|-------------|
| Overview | counts | no send |
| Read | READ | new template campaign (typical “they saw it”) |
| Delivered unread | DELIVERED and not READ | template follow-up |
| Replied | match campaign phones to inbound after `sentAt` | **do not** re-blast; open Inbox |
| Active window | intersection with open CSW | session **or** template |
| Failed | FAILED + `errorMessage` | retry same template **only** FAILED (already exists). Never AMBIGUOUS. Drop “not on WhatsApp.” |

Always: `optedIn` + consent fields + `whatsappNumberId`. Free-form only inside CSW.

**DEFER:** drip sequences, stop-on-reply automation, CTA-click retarget (needs click tracking).

---

## Build order (when asked to implement)

1. Honesty: hide fake `meta-health` / Est. CTR.  
2. Dashboard quality + category mix.  
3. Campaigns remaining (Samyoj cap) + Meta tier (after Graph field).  
4. Inbox window filter.  
5. Campaign retarget tabs + “create campaign from cohort.”  
6. Featured template pack.  
7. `wa.me` widget.  
8. OBA checklist (no badge sales copy).  
9. Click redirect (only if we revisit DEFER).

---

## Problems to expect

- Quality UNKNOWN until first poll/webhook.  
- Meta remaining unique-users **not in Graph** — support will ask; answer with Manager link.  
- OBA apply button missing for many SMBs — eligibility opaque.  
- Starter templates still PENDING on new WABAs — UI must say “submitted, not live.”  
- Retargeting MARKETING follow-ups can tank quality_rating — default UTILITY where policy allows; warn on MARKETING.

## Explicitly will not do in this phase

Live transfer, TARGET subscriptions, Phase C drips, selling Meta verification, cross-tenant skip-review templates, fake daily Meta remaining, App ID in user Settings.
