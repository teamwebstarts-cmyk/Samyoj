# Samyoj Meta Ecosystem — V2 Plan (continue from existing product)

**Date:** 2026-09-18  
**Audience:** Seniors + implementers  
**Rule:** No hypothesis. Proven in Samyoj code, Meta docs, or vendor official pages. Else **DOUBT / unverified**.  
**Not a rewrite.** WhatsApp product stays. This extends it.

**Execution checklists (2026-09-23):** `docs/meta-ecosystem/phases/` and `ARCHITECTURE.md`. Those win on scope, permissions, and UI. This file still holds the order and the CANNOT list.

**Inputs**
- Senior: `docs/meta-ecosystem/Market_Driven_Requirements_Samyoj.pdf`
- Prior pack: Team Brief, Phase research, Implementation Roadmap (2026-09-17)
- Code: `server/prisma/schema.prisma` (Contact / Lead / Conversation)

---

## 1. Positioning (keep from senior PDF)

Samyoj is **acquisition + conversations + CRM + automation + AI + analytics across Meta channels** — not a WhatsApp-API wrapper.

Funnel to aim at (honest version):

```text
Meta Ad (Lead Form or Click-to-Message)
        → Samyoj Contact / Lead
        → WhatsApp and/or Instagram DM and/or Messenger
        → Separate platform inboxes + shared CRM stages
        → AI / automation / human
        → Won (Samyoj stores deal/revenue)
        → Analytics (ads metrics from Meta Insights + CRM outcomes from us)
```

Meta does **not** give a single “customer ID” across WhatsApp + Instagram. Customer 360 is **our merge** (phone/email/manual). That is how Wati documents linked chats too.

---

## 2. Senior PDF vs existing Samyoj vs Meta

| Senior ask | Samyoj today | Meta API | Verdict |
|------------|--------------|----------|---------|
| Shared inbox, assign, notes, tags, Open/Pending/Closed, search, media, agent availability | **Have** (WhatsApp) | WA already | Keep; extend to other channels after Channel model |
| WhatsApp templates, campaigns, opt-in, flows, AI chat/calling | **Have** | WA Cloud | Senior Phase 1 is largely **done** |
| Team, cookies auth, platform admin | **Have** | n/a | Done |
| Lead stages New→…→Won/Lost | **Have** (`LeadStage` includes PROPOSAL + NEGOTIATION) | n/a | Product already richer than PDF |
| Contact: name, phone, email, tags, notes, custom fields | **Have** | n/a | `ContactSource` is only MANUAL/IMPORT/INBOUND/OUTBOUND — **add** Ads/IG/FB sources later |
| Separate IG DM + Messenger inboxes | **Missing** | CAN (Professional IG + Page; 24h window) | Build after Channel |
| Same person IG then WA = one history | **Missing** | Meta does **not** join IGSID to WA phone | Merge by phone/email/agent; **DOUBT** auto-match rate |
| Email / SMS / Web chat | **Missing** | Not Meta | Later; out of this Meta phase |
| EVENT→CONDITION→ACTION flows | **Have** (WA automations/flows) | IG/FB triggers = new | Reuse engine; new triggers |
| Comment “PRICE” → DM | **Missing** | CAN as **private reply** (limits: first comment, 7-day private reply, then 24h only after user reply) | Same pattern ManyChat documents |
| Story mention automation | **Missing** | **CAN:** `messages` webhook can include `story_mention` + CDN URL; auto-reply only in 24h. **CANNOT** store the media. Public (or private **followers**). Not a dedicated Meta product | Phase 4 later; do not market as Stories OS |
| IG publish / Reels / Stories | **Missing** | Feed/carousel/Reels CAN; Stories CAN with **no** native stickers/caption parity | After inbox |
| FB Page posts, Messenger, comments, Lead Forms | **Missing** (WA catalog exists, not Page) | CAN (Lead Forms = `leadgen`) | Phased |
| Lead Ads → CRM → optional WA | **Missing** | CAN webhook | High ROI |
| Connect Ad Account, campaigns, spend, CPL | **Missing** | Insights CAN **read**; creating ads CAN in API but **v1 product = no Ads Manager clone** | Dashboard read + CTWA chip first |
| Attribution example (₹25k spend → 31 sales → ₹4.8L) | **Missing** — `Lead` has **no amount/revenue field**, no `ad_id` join | Insights = spend/clicks/`actions` in default **7d click + 1d view**. CPL = cost of Meta **`lead` action**, not “qualified.” CAPI Conversion Leads = we send stages; **Instant Forms only**; `lead_id` **unhashed** | Spend vs Meta lead **count** after 1+6. Named-ad ₹ revenue **CANNOT** until Samyoj stores deal value **and** a lead_id join |
| AI agent on WA | **Have** (chat + calling bots, handoff, summaries on calls) | **IG: must** offer in-chat human. WA: automation OK in 24h if **some** escalation path exists | Extend to IG after inbox **with human inbox**. Score “82” is ours, not Meta |
| AI lead qualification score | **Missing** as productized score | n/a | After CRM events exist; don’t fake precision |
| Customer 360 nav | **Missing** (contact is WA-number scoped) | n/a | `ContactPlatformIdentity` + Channel |

**Senior Phase 1 (WA + Inbox + CRM + Team) = current Samyoj.** Do not rebuild it. Next work is Channel + other Meta surfaces.

---

## 3. Vendors (sourced 2026-09-18)

Full cards + URLs: [`META_ECOSYSTEM_VENDOR_BENCHMARK_2026-09-18.md`](META_ECOSYSTEM_VENDOR_BENCHMARK_2026-09-18.md)

| Stake | Who documented it | Samyoj take |
|-------|-------------------|-------------|
| WA + IG DM inbox | Respond.io, Wati, Interakt, SleekFlow, ManyChat, Gallabox, Kommo, Chatwoot, … | Table stakes after Channel |
| Comment → DM | ManyChat (deepest limits), Wati, Respond.io, SleekFlow, Interakt Growth+, Gallabox, Kommo | Phase 4. Dark/unpublished-post behavior is vendor-specific/unverified |
| Native Instant Forms | Interakt, AiSensy, SleekFlow, Gallabox, Kommo | **Respond.io/Wati do not.** Our Phase 1 is the gap |
| Ads spend/CPL in-app | AiSensy, Interakt CTWA, Wati CTWA Business | v1 = Insights **read**, not a launcher |
| Ad→sale documented | Respond.io (click ID + Lifecycle + CAPI); Kommo (UTM + stages + CAPI); Wati template CAPI **with click inflation admitted** | Join Insights + our Won; need deal value on `Lead` |
| Identity merge | Respond.io merge; Wati **phone match**; Chatwoot merge | Same: phone/email/agent. Not a Meta ID |
| IG/FB publishing | **None of 11** (Trengo points to Meta Business Suite) | **Defer.** Not table stakes |

**Hype (vendor copy vs their own help)**
- Wati Growth = **one channel**. IG automation is Pro.
- Respond.io Lead Ads = roadmap + Zapier, not native.
- AiSensy “Instagram” = ads **on** IG + WA inbox; no official IG DM product page.
- Chatwoot: DMs yes, **comments no**, **revenue no**.
- ManyChat: private reply does **not** open 24h until the user taps.
- Interakt in-app ads still Meta-reviewed; their-created ad accounts may be **invisible in Ads Manager**.
- Email/SMS and AI score “82” — not vendor-proven Meta features for v1.

---

## 4. Global CANNOT / never schedule (unchanged + PDF-stripped)

1. Rebuild WhatsApp inbox/CRM from zero  
2. Ads Manager parity / create BM in-app (v1)  
3. Mix ad spend or WABA fees into Samyoj plan price  
4. WA-style template blasts on IG/Messenger  
5. Personal IG/FB accounts  
6. Promise Meta-perfect cross-channel identity  
7. Promise Story stickers / native Stories UX via API  
8. Shops Order Management API (blocked on current Graph)  
9. Use `whatsappNumberId` as the only tenancy key for IG/FB  
10. Dual Instagram Login + Facebook Login on Day 1 without App Review confirmation  
11. Dead IG/Messenger tags (`CONFIRMED_EVENT_*`) or invented `AGENT_PAUSED`  
12. Rename CRM **Open** to mean the 24h messaging window  
13. Sell or guarantee Meta green tick / Official Business Account  
14. Fake Insights (hardcoded remaining quota, estimated CTR from `readRate`)  
15. Recurring Notifications as a 2026 Messenger/IG marketing path (Messenger RN deprecated **10 Feb 2026**)  
16. IG AI bot **without** a human chat path  
17. Story stickers (link/poll/location) via `media_type=STORIES`  

---

## 5. Merged phase order (last plan — start from existing)

Senior order assumed greenfield WA. **Skip their Phase 1 as a build.** Keep their vision.

| Our phase | Outcome | Maps to senior | Exit gate |
|-----------|---------|----------------|-----------|
| **0 Foundation** | `Channel`, `ContactPlatformIdentity`, `Conversation.channelId`, webhook `object` router | Hidden behind the separate platform inboxes | WA still works; one contact can hold WA+IG ids |
| **A CRM sources** | Contact/Lead `source` includes ADS / IG / FB. Identity **rows** only (no 360 UI yet) | PDF CRM | Manual leads still work |
| **1 Lead Ads** | Page `leadgen` → Contact+Lead → optional WA template | Their Phase 4 (pull earlier — highest Ads ROI) | Meta test lead in correct org |
| **2 CTWA chip** | Referral on WA inbound | Their ads funnel, WA-only | Agent sees ad source |
| **3 Messenger inbox** | Send/receive 24h | Their Phase 2 | Separate Facebook inbox |
| **4 IG DM + comments + private reply** | Inbox + comment keyword → private reply | Their Phase 2+3 | Separate Instagram inbox; PRICE→DM within Meta limits; dark/unpublished-post behavior deferred until verified |  
| **5 Ads **read** + audiences** | Insights spend/CPL/leads; Custom Audience upload | Their Phase 6 minus fake revenue | Tiles match Ads Manager ballpark; **separate** from Lead Ads |  
| **6 Analytics join** | Lead → chat → Won; ads metrics **and** CRM revenue as two columns | Their Phase 6–7 | No fake single Meta ROI; need deal value on `Lead` |  
| **7 ES v4 / portfolio** | Linked assets UI | Settings | ES v2 sunset ~**8 Oct 2026** — App Review **in parallel from phase 1** |  
| **Later** | Customer 360 merge UI, IG/FB **publish** (none of 11 inboxes ship it), AI score, Email/SMS, in-app ad create, story-mention | Their marketing + 360 | Publish only if product insists; else Meta Business Suite |

**AI:** do **not** a new “Phase 5 AI platform.” WA AI already exists. After IG inbox: same bots + handoff + thread summary. Numeric lead score = later, once stages are used.

---

## 6. Engineering (ponytail)

- Reuse: webhook durability, encrypted tokens, automation engine, Inbox UI, Lead model, `Flow` nodes, `AiBot` (CHAT vs CALL — WhatsApp, not IG).  
- New: Channel row, identity table, send adapters per platform (do not overload WA `meta.service`). IG + Messenger can share Messenger **Conversations API** (`platform=instagram` or `messenger`); WhatsApp stays Cloud API — Meta does not ship one inbox.  
- Connect Day 1: **Page-linked Facebook Login** (Lead Ads + Messenger + linked IG). Instagram Login later if App Review confirms.  
- Credentials stay in `server/.env`.

**Code blockers (gap map of this repo, not Meta):**

| Fact | Why it matters |
|------|----------------|
| Webhook ignores `payload.object !== 'whatsapp_business_account'` | `leadgen` / `instagram` / Page messages are **dropped today**. Phase 0 = router, not a new server. |
| `Lead` create requires `whatsappNumberId` | Lead Ads ingest cannot land until Channel (or nullable number + channelId). |
| `ConversationCharge` / `conversation_analytics` | WhatsApp cost widget, **not** Ads Insights. Phase 6 is a new poll, not a rename. |
| Client `/reports` redirects to Billing; `ReportsPage.tsx` unused | Phase 7 analytics is a real page, not “turn reports back on.” |
| Call summaries exist; thread summaries do not | PDF “AI summary of chat” is not shipped. Do not claim it. |
| Pipeline lives under Contacts, not `/leads` nav | Optional later; not a Meta phase. |

---

## 7. Open DOUBTs (resolve before marketing copy)

1. Tech Provider Instagram Login vs Facebook Login dashboard text.  
2. ES v4 single picker for WABA+Page+IG+Ad Account.  
3. Publish quota live (`content_publishing_limit`).  
4. Story-mention auto-reply on **our** Page-linked webhook (Meta documents the field; we have not received one).  
5. Auto-merge accuracy (phone on Instant Forms vs IGSID-only DMs).  
6. In-app CTWA **creation** (Interakt-style) vs Ads Manager + our ingest — **v1 = ingest**.  
7. Tech Provider **Access Verification** vs App Review (independent; both needed to serve customers).

---

## 8. How to use this pack

| Need | Doc |
|------|-----|
| Share with seniors | **This V2 plan** |
| Design / slides (diagrams only) | `META_LOOP_PRESENTATION_2026-09-18.md` |
| **Existing UI + per-phase mock map** | [`META_ECOSYSTEM_UI_BY_PHASE_2026-09-22.md`](META_ECOSYSTEM_UI_BY_PHASE_2026-09-22.md) |
| Vendor facts | `META_ECOSYSTEM_VENDOR_BENCHMARK_2026-09-18.md` |
| Do / Don’t (daily) | `META_ECOSYSTEM_DOS_AND_DONTS_2026-09-18.md` |
| Meta CAN/CANNOT depth | `META_ECOSYSTEM_PHASE_2026-09-17.md` |
| Ticket rows | `META_ECOSYSTEM_IMPLEMENTATION_ROADMAP_2026-09-17.md` (order superseded by §5 here) |
| One-pager old | Team Brief — still valid except Lead Ads-before-inbox vs senior; **this file wins on order** |

**Next when product says go:** Phase **0** only.

---

*Vendors prove the market wants the senior vision. Meta + Wati/ManyChat docs prove the limits. Samyoj already owns senior Phase 1. Build Channel, then Lead Ads, then Messenger/IG, then ads read + joined analytics — not a new company in a box.*
