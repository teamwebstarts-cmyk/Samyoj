# Samyoj Meta Ecosystem — Do / Don't (2026-09-18)

**Use this before any ticket, mockup, or sales line.**  
Sources: senior PDF, Meta docs, vendor official help (not blogs as proof).  
Plan: [`META_ECOSYSTEM_V2_PLAN_2026-09-18.md`](META_ECOSYSTEM_V2_PLAN_2026-09-18.md)  
Vendors: [`META_ECOSYSTEM_VENDOR_BENCHMARK_2026-09-18.md`](META_ECOSYSTEM_VENDOR_BENCHMARK_2026-09-18.md)

Samyoj today is **WhatsApp CRM**. We extend it. We do not start a new product.

---

## Do

| Do | Why (proof) |
|----|-------------|
| Keep existing Inbox, Leads, Flows, Campaigns, AI chat/calling | Senior Phase 1 is already this repo |
| Add `Channel` + `ContactPlatformIdentity` **before** IG/FB UI | Contacts/conversations are keyed by `whatsappNumberId` |
| Route webhooks by Meta `object` (`whatsapp_business_account` / `page` / `instagram`) | Today non-WABA payloads are **dropped** |
| Ingest **Lead Ads** (`leadgen`) into Contact + Lead, then optional WA template | Native Instant Forms is the gap vs Respond.io/Wati; Interakt/Gallabox/Kommo already do it |
| Keep Lead Ads and CTWA as **two** loops | Instant Form ≠ click-to-chat. Mixing them lies about CPL |
| Show CTWA **ad source chip** on existing WA Inbox | Referral is on the WA webhook; no Ads Manager needed |
| Unified Inbox = channel badge + filter on **this** Inbox | Respond.io/Wati table stakes. Meta has no one inbox API |
| Merge Customer 360 by **phone / email / agent** | Meta: IGSID ≠ PSID ≠ wa_id. Wati: link only when phone matches |
| Comment keyword → **one private reply / 7 days**, then wait for user tap | ManyChat help + Meta Private Reply API |
| IG AI only with **human inbox** on the same thread | IG Messaging policy |
| Ads dashboard v1 = Insights **read** (spend, impressions, clicks, Meta `lead` action, CPL of that action) | Marketing API Insights. Default window **7d click / 1d view** |
| Store unhashed Meta `lead_id`; hash email/phone for CAPI | Conversion Leads spec; Instant Forms only |
| Show **three money columns**: Samyoj SaaS, WABA fees, ad spend | Never one SKU |
| App Review + Tech Provider Access Verification **in parallel** from Lead Ads | Independent processes; both needed to serve customers |
| Connect Day 1 = **Page-linked Facebook Login** | Same Page token: Lead Ads + Messenger + linked IG |
| Credentials in `server/.env` only | Product rule |
| Reuse Flow engine for new IG/FB **triggers** | Do not rebuild automation |
| Put deal **amount** on Lead before promising ₹ revenue | Schema has no amount today; Meta does not return Samyoj revenue |

---

## Don't

| Don't | What goes wrong |
|-------|-----------------|
| Rebuild WhatsApp inbox/CRM/team as “Phase 1” | Already shipped. Senior PDF assumed greenfield |
| Fake a Channel by stuffing IG/FB onto `whatsappNumberId` | Tenancy / disconnect / unique contacts break |
| Clone Meta Ads Manager (campaign/adset/ad editor) in v1 | Interakt/AiSensy still go through Meta review; wrong product |
| Mix Instant Form leads with CTWA chats in one CPL number | Wati FAQ: Meta clicks include people who **never message** |
| Promise “one Meta customer ID” / auto 360 | Impossible via documented APIs |
| WA-style template blasts on IG or Messenger | Different products; 24h windows; only `HUMAN_AGENT` left on IG tags |
| Design on Recurring Notifications | Messenger RN deprecated **10 Feb 2026** |
| Dead tags (`CONFIRMED_EVENT_*` etc.) | Error 100 since **27 Apr 2026** |
| Comment automation on Ads Manager **dark posts** | ManyChat: those posts cannot be selected |
| Say comment DM opens 24h chat | It does **not**, until the user replies/taps |
| Store Instagram story-mention media | Meta: must not store the CDN media |
| Publish Stories with link/poll/location stickers | `media_type=STORIES` cannot |
| Build IG/FB **content studio** to catch competitors | **None of 11** inboxes ship it. Use Meta Business Suite |
| Show ₹4.8L “from Ad Video 03” as a Meta metric | Insights ≠ CRM Won. Need our deal value + lead_id join |
| Ship AI lead score “82” as product truth | No `leadScore` field; not a Meta API |
| IG bot with no human chat | Policy fail |
| Put App ID / App Secret in Settings | Never |
| Sell / guarantee green tick | Meta owns approval |
| Rename CRM Open = 24h window | Different concepts |
| Fold ad spend or WABA fees into SaaS plan price | Three ledgers |
| Link WABA ↔ Page via Graph | Business Manager UI only |
| Personal IG/FB accounts | Professional / Page only |
| Dual Instagram Login + Facebook Login Day 1 | Confirm App Review first |
| Treat `ConversationCharge` as Ads Insights | WhatsApp conversation cost widget only |
| Claim chat AI summaries | Call summaries exist; thread summaries do not |
| Email/SMS in this Meta wave | Not Meta APIs; senior PDF already said later |

---

## Steal from vendors (documented) / skip

| Steal | Skip |
|-------|------|
| Wati: IG↔WA **linked chat when phone exists** | Wati: Growth = 1 channel sold as omnichannel |
| Respond.io: save **click ID** on conversation open + CAPI workflow on Lifecycle | Respond.io: Lead Ads via Zapier |
| ManyChat: comment + story mention **limits written in help** | ManyChat: Instant Forms via iPaaS; not a WA CRM |
| Kommo: pipeline stages **are** the CRM; UTM on CTWA | Kommo: not a BSP broadcast engine — don't copy that gap |
| Gallabox: contact Source = CTWA, Source ID = **Ad ID** | Gallabox: CAPI gated on expensive plan as if it were “analytics” |
| Interakt/AiSensy: **native** Lead Form ingest | Their in-app ad **create** UI (v1 we ingest only) |
| Chatwoot: honest “no comments / no revenue” | Chatwoot: promising a “social inbox” that is DMs only |
| Trengo: publishing stays in Meta Suite | Trengo: conversation metering surprises |

---

## Senior PDF — keep vs strip

**Keep (vision):** Samyoj = ads + conversations + CRM + automation + AI + analytics. One Inbox. Lead → chat → Won. Comment “PRICE” → DM (with Meta limits). Proposal stage (already in schema). Email/SMS **later**.

**Strip (order / hype):** Greenfield Phase 1. IG+FB inbox before Channel. Lead Ads after inbox. AI as a new platform wave. ₹ revenue as if Meta computed it. Score 82. Story stickers. IG campaigns = WA broadcasts.

---

## If someone asks in a meeting

| They say | We say |
|----------|--------|
| “When is unified inbox?” | After Channel (Phase 0). Then Messenger, then IG. WhatsApp inbox already works. |
| “Can we show ROI like the Diwali slide?” | Spend and Meta leads: yes after Insights. ₹ sales: only after we store deal value and join `lead_id`. |
| “Same as Ads Manager?” | No. Customer creates ads in Meta. We ingest leads and show performance. |
| “One profile if they IG then WhatsApp?” | Only if we get phone/email or an agent merges. Meta will not. |
| “Comment PRICE and we blast DMs?” | One private reply in 7 days. Then they must reply. Then 24h. |
| “Publish Reels from Samyoj?” | Later. Competitors didn’t. Suite already does. |
