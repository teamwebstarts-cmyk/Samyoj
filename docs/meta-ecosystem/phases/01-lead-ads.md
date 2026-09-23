# Phase 1 — Lead Ads (connect phase)

**Target:** Connect a Facebook Page. An Instant Form lead becomes a Contact + Lead in **this** org after the lead-only data-model decision; phone-less representation is not yet promised.  
**Menu:** `Facebook → Leads` only. Settings holds **Connect Page**.  
**Official:** [Lead Ads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads), [leadgen webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/), subscribe example on Graph **v26.0** [`/{page-id}/subscribed_apps`](https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/).

## Do

- Facebook Login. User picks an **existing** Page. Save Page token on `Channel` (`platform=FB`).
- Subscribe that Page to `leadgen`.
- On webhook: read `leadgen_id`, `GET /{leadgen_id}` with the Page token, map name / phone / email.
- Upsert Contact + Lead. `Lead.source = META_ADS`. Store `metaLeadId` (unique per org).
- Optional WhatsApp template **only** if phone + existing consent + an approved template. Reuse the current send path.
- App Review in parallel. The official Lead Ads and leadgen webhook pages do not list the same permissions, and the Page subscription reference has its own requirements. The exact least-privilege matrix is **unresolved**; confirm it in the live App Dashboard before the review screencast. Still **no ads editor**.

## Don't

- Do not build the form, the ad, the budget, or Ads Manager.
- Do not count this lead as a Click-to-WhatsApp chat.
- Do not send a template when phone or consent is missing. Save the lead anyway.
- Do not require `pages_manage_ads` to mean we manage ads. It is a review permission, not a feature.
- Do not show Instagram.
- Do not put App ID / secret in Settings.

**Permission mismatch:** the official pages do not list the same scopes. Do not submit their union as an assumed design or invent a third list. Record the operation-by-operation scopes, Page task requirements, App Review/Business Verification status, and test-mode access before implementation.

**Version note:** Meta’s current Graph documentation is v26.0, while Samyoj’s current production default remains `v21.0` (`server/src/config/index.ts:54`). Choose the Phase 1 target deliberately; do not silently change the existing WhatsApp default as part of the Page proof.

## How it works

```text
Admin → Settings → Facebook Page → Connect Page
  → Facebook Login → Page token → Channel
  → POST /{page-id}/subscribed_apps?subscribed_fields=leadgen

Person submits Instant Form in Ads Manager (or Meta lead test tool)
  → webhook object=page field=leadgen
  → fetch lead → Contact + Lead (source Meta Ads)
  → Facebook → Leads  (pipeline filter)
```

Lead with email only, or with neither phone nor email, is **pending the Phase 1 lead-only data-model decision**. Do not promise a phone-less `Contact` row until the schema and all phone consumers have been audited. The eventual record must retain `metaLeadId`, form name, and no WhatsApp button when phone or consent is absent.

`leads/routes.ts` today throws without a WhatsApp number, scopes reads to the active number, and does not apply the documented `source=META_ADS` filter. The client pipeline does not send that filter either. Phase 1 adds a server path that creates and lists `META_ADS` leads **without** `activeWhatsappNumberId`; the manual “new lead” button can keep requiring WhatsApp.

## UI (match WhatsApp numbers)

Copy `WhatsAppChannelsPanel`: one card, icon, name, status, footer button.

| Element | Spec |
|---------|------|
| Settings tab | **Facebook Page**, under WhatsApp. Hint: Instant Forms → CRM |
| Card | Page name, “Connected”. No token, no app id |
| Button | **Connect Page** (same weight as **Add number**) |
| Empty | “Connect a Page to receive Instant Form leads.” + the button |
| Pipeline | Existing table. Source line **Meta Ads**. Stage select unchanged |
| No phone | Muted line: “No WhatsApp message — no phone or no consent.” |
| Sidebar | `Facebook` group with one child: **Leads** → `/contacts?tab=pipeline&source=META_ADS` |

Colors: Facebook blue 3px on the group only. Pipeline stays the current amber/emerald stage UI.

## Test

- [ ] Meta Lead Ads testing tool → one Contact + one Lead in the org that connected the Page. Not in another org.
- [ ] Repeat the same `leadgen_id` → still one lead.
- [ ] **Blocked until the schema decision:** a form without phone must be stored through the approved lead-only representation, with zero WhatsApp sends.
- [ ] Form with phone but no consent → lead exists, zero template sends.
- [ ] Page-only organization can list/filter `META_ADS` leads without an active WhatsApp number.
- [ ] WhatsApp inbound on the same org still lands in WhatsApp Inbox.
- [ ] Settings shows no App ID / App Secret.
- [ ] Agent without a connected Page sees the empty card, not a fake lead.

## Competitors

Native form → CRM is the gap versus Respond.io (still a roadmap item) and Wati (Google Sheets). Interakt, Gallabox, Kommo, SleekFlow, AiSensy already ingest. We copy **ingest**, not their ad builders.
