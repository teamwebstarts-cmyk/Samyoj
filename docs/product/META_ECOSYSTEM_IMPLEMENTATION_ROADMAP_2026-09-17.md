# Samyoj Meta Ecosystem — Implementation Roadmap

**Date:** 2026-09-17  
**Companion research:** `docs/product/META_ECOSYSTEM_PHASE_2026-09-17.md`  
**Rule:** Points only. Order = build order. Every item = CAN / CANNOT / DOUBT + what to do in Samyoj.

**Do not start coding from this doc until the user explicitly asks.**

---

## How to read

| Mark | Meaning |
|------|---------|
| **CAN** | Meta API + Samyoj fit — implement when phase reaches it |
| **CANNOT** | Do not build / Meta blocks / wrong product |
| **DOUBT** | Confirm App Dashboard / App Review / live Graph before locking design |
| **PRE** | Must exist before later phases |

---

## Phase 0 — Hard prerequisites (PRE)

Do these **before** any IG / FB / Ads UI.

| # | Item | CAN/CANNOT | Exact work in Samyoj |
|---|------|------------|----------------------|
| 0.1 | Platform-agnostic `Channel` model | **CAN** | Prisma: `Channel` (orgId, platform enum WA\|IG\|FB\|ADS, platformAccountId, encrypted token, isActive). Backfill each `WhatsappNumber` → Channel. Keep `whatsappNumberId` until cutover. |
| 0.2 | `ContactPlatformIdentity` | **CAN** | Map Contact ↔ (platform, IGSID/PSID/WA phone). Unique per org+platform+id. |
| 0.3 | `Conversation.channelId` | **CAN** | Add nullable → backfill → require. Inbox queries by channelId, not only whatsappNumberId. |
| 0.4 | Webhook router by `object` | **CAN** | Extend dispatcher: `whatsapp_business_account` (keep), `instagram`, `page`. Same durability claim/complete pattern. |
| 0.5 | Bump Meta API version intentionally | **CAN** | Align `META_API_VERSION` toward **v26.0**; stop silent `v21.0` fallback drift. |
| 0.6 | Reuse WA number as IG/FB “fake channel” | **CANNOT** | Tenancy / disconnect / reconnect isolation breaks (see number-isolation rules). |
| 0.7 | Instagram Login **and** Facebook Login dual path Day 1 | **DOUBT** | Dashboard text conflicts for Tech Provider SaaS. Locked default: **Page-linked Facebook Login first** (same Page token covers Lead Ads + Messenger + IG DMs via `graph.facebook.com`). Instagram Login (`graph.instagram.com`) after App Review confirms. |

**Exit gate:** One Contact can have WA + IG identity rows; webhook health still WA-only counters OK; no customer-facing IG yet.

---

## Phase 1 — Lead Ads → CRM (highest Ads ROI, smallest Ads surface)

| # | Item | CAN/CANNOT | Exact work |
|---|------|------------|------------|
| 1.1 | Connect Facebook Page (token save) | **CAN** | New OAuth scopes: `pages_show_list`, `pages_manage_metadata`, `leads_retrieval` (+ BV/App Review for production). Store Page token on Channel (platform=FB). |
| 1.2 | Subscribe Page `leadgen` webhook | **CAN** | App Dashboard + Graph subscribe. Route `object=page` leadgen → worker. |
| 1.3 | Fetch lead fields → upsert Contact | **CAN** | `GET /{lead_id}?fields=…` with Page token. Map phone/email → Contact; set consent carefully. |
| 1.4 | Optional: auto-start WA conversation / template | **CAN** | Only if phone present + consent + approved template. Reuse campaign/inbox send path. |
| 1.5 | CAPI Conversion Leads (CRM stages) | **CAN** (later in phase) | Pixel events `action_source=system_generated`, `event_source=crm`, unhashed `lead_id`. Separate from Pixel browser dedup. |
| 1.6 | Full Ads Manager / create campaigns in Samyoj | **CANNOT** (this phase) | Customer creates Lead Ad in Ads Manager; Samyoj only ingests leads. |
| 1.7 | Mix ad spend into SaaS billing | **CANNOT** | Third ledger forever. |

**Exit gate:** Real lead from Meta test tool → Contact in correct org + optional WA message.

---

## Phase 2 — CTWA adjacency (no Marketing API required)

| # | Item | CAN/CANNOT | Exact work |
|---|------|------------|------------|
| 2.1 | Inbox “ad referral” context on first message | **CAN** | Parse WA webhook referral / CTWA metadata; show ad/source chip in Inbox. |
| 2.2 | Agent SLA hints for 72h FEP window | **CAN** | Product copy + timer from first user message after click. Uses existing WA messaging. |
| 2.3 | Build CTWA ads inside Samyoj | **CANNOT** (need) | Ads created in Meta Ads Manager; Samyoj is destination CRM. |
| 2.4 | `ads_management` for CTWA alone | **CANNOT** (required) | Not needed for adjacency path. |

**Exit gate:** Agent sees CTWA source on inbound chat; reply within policy window documented.

---

## Phase 3 — Unified Inbox: Messenger (Page)

| # | Item | CAN/CANNOT | Exact work |
|---|------|------------|------------|
| 3.1 | Page messaging scopes + webhook `messages` | **CAN** | `pages_messaging`, subscribe Page fields. Channel platform=FB. |
| 3.2 | Inbound PSID → Conversation | **CAN** | Identity map + channel-scoped rooms (mirror WA org+channel socket rules). |
| 3.3 | Outbound text within 24h | **CAN** | New send adapter (not `meta.service` WA paths). |
| 3.4 | Outside 24h = WA templates copied to Messenger | **CANNOT** | Different product (tags / OTN / Marketing Messages). Separate UX. |
| 3.5 | Conversation Routing (ex-Handover) | **CAN** (optional) | Only if multi-app on same Page. |
| 3.6 | Link WA number ↔ Page via public API | **CANNOT** | BM / UI only (no public create-link found). Document manual link. |

**Exit gate:** Send/receive Messenger in same Inbox UI with channel filter.

---

## Phase 4 — Unified Inbox: Instagram DMs + comments

| # | Item | CAN/CANNOT | Exact work |
|---|------|------------|------------|
| 4.1 | Page-linked IG Professional connect | **CAN** | Scopes: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, pages_*. Channel platform=IG. |
| 4.2 | Webhook object `instagram` | **CAN** | Router + processor; IGSID identity. |
| 4.3 | DM within 24h | **CAN** | Send adapter for IG. |
| 4.4 | Outside 24h automation / templates | **CANNOT** | Only **`HUMAN_AGENT`** tag (humans, App Review + BV). No WA-style blast. |
| 4.5 | Deprecated IG tags (`CONFIRMED_EVENT_*`, etc.) | **CANNOT** | Error 100 since 27 Apr 2026. Do not code. |
| 4.6 | Comment reply / hide / private reply | **CAN** | Separate Inbox “Comments” or thread type. Private reply = 1 DM / 7d then wait. |
| 4.7 | Ice breakers | **CAN** | Config UI later. |
| 4.8 | Group IG chats | **CANNOT** | Unsupported. |
| 4.9 | Personal IG accounts | **CANNOT** | Professional only. |

**Exit gate:** IG DM + comment moderation in unified Inbox; filter by channel.

---

## Phase 5 — Content publish (IG / Page) — after inbox

| # | Item | CAN/CANNOT | Exact work |
|---|------|------------|------------|
| 5.1 | IG feed / carousel / Reels publish | **CAN** | Container → publish; poll limit endpoint live. |
| 5.2 | IG Stories publish | **CAN** | `media_type=STORIES`; no caption/stickers. (Phase doc said ❌ — corrected per Content Publishing docs.) |
| 5.3 | Page post schedule | **CAN** | `pages_manage_posts` (dead `publish_pages` removed — never request it). |
| 5.4 | Product tags on IG media | **DOUBT** / Partial | Facebook Login + Shop only; Instagram Login path often missing. |
| 5.5 | Hashtag search / account insights / resumable upload | **DOUBT** | Mostly Facebook Login path — confirm before promising in Instagram-Login-only design. |
| 5.6 | Order Management (Shops checkout API) | **CANNOT** | v26 blocked 47 endpoints. Catalog sync for WA commerce can stay. |

**Exit gate:** Schedule/publish from Samyoj without touching Ads.

---

## Phase 6 — Ads Insights + Audiences (read / sync, not full manager)

| # | Item | CAN/CANNOT | Exact work |
|---|------|------------|------------|
| 6.1 | Marketing API Access Tier + `ads_read` | **CAN** (after review) | Separate from WA Connect. Full Access for production scale. |
| 6.2 | Dashboard tiles: spend, CPL, impressions, leads | **CAN** | Poll Insights; ETL into analytics store; filters = date, ad account, campaign. |
| 6.3 | Custom Audience upload from CRM | **CAN** | Hash PII; consent gate; `ads_management`. |
| 6.4 | Lookalike from seed audience | **CAN** | After Custom Audience exists (≥100). |
| 6.5 | Saved Audience create via API | **CANNOT** | Read-only. |
| 6.6 | Create BM / ad accounts in product | **CANNOT v1** | BM create = no API (Meta UI only). Ad-account create exists but capped ~5 — skip v1, use Meta UI. Document only. |
| 6.7 | Full campaign/adset/ad CRUD UI | **CAN** (API) / **product CANNOT v1** | Do not clone Ads Manager. |
| 6.8 | Automated rules / ad preview | **CAN** | Phase 6.5 optional. |

**Exit gate:** Read-only Ads performance next to WA/IG/FB messaging KPIs; optional audience sync.

---

## Phase 7 — Single analytics dashboard (cross-channel)

| # | Item | CAN/CANNOT | Exact work |
|---|------|------------|------------|
| 7.1 | Filters: date, channel, asset, agent, campaign | **CAN** | One UI; multiple backends. |
| 7.2 | WA tiles from local DB | **CAN** | Existing reports / SAMYOJ-56 patterns. |
| 7.3 | IG/FB messaging tiles from stored webhook events | **CAN** | After Phases 3–4. |
| 7.4 | Ads tiles from Insights poll | **CAN** | After 6.2. |
| 7.5 | Funnel: Lead → Contact → Chat → Close | **CAN** | Lead Ads + Inbox events (+ optional CAPI). |
| 7.6 | One “Meta bill” merging SaaS + WABA + ads | **CANNOT** | Three ledgers. Charts may **show** all three but never price them as one SKU. |
| 7.7 | Real-time Ads Insights webhook for all metrics | **CANNOT** | Poll Insights. Messaging = webhooks. |

**Exit gate:** One dashboard page; channel filter works; no fake unified Meta invoice.

---

## Phase 8 — Business Portfolio / Embedded Signup multi-asset

| # | Item | CAN/CANNOT | Exact work |
|---|------|------------|------------|
| 8.1 | ES **v4** multi-product onboarding | **CAN** / **time-critical** | ES v2 dead **Oct 8, 2026** per docs (blog says Oct 15 — plan before the 8th). Migrate `META_CONNECT_FLOW` before relying on legacy dialog UX. |
| 8.2 | Single “Connect Meta” that returns WABA + Page + IG + Ad Account | **DOUBT** | Depends on ES v4 feature set + App products enabled. May still be stepwise pickers. |
| 8.3 | Expose META_APP_ID / App Secret in Settings UI | **CANNOT** | Product rule: platform credentials stay in `server/.env`. |
| 8.4 | Portfolio diagram in Settings (read-only linked assets) | **CAN** | List Channels for org. |

---

## Global CANNOT list (never schedule)

1. Personal Facebook / personal Instagram automation  
2. IG/Messenger template blast like WA campaigns  
3. Shops Order Management API  
4. Mixing ad spend or WABA fees into Samyoj plan price  
5. Using `whatsappNumberId` as the only tenancy key for IG/FB  
6. Deprecated IG message tags / invented `AGENT_PAUSED`  
7. Promising Ads Manager parity in v1  
8. Dual Instagram Login + Facebook Login without App Review confirmation  

---

## Global DOUBT list (resolve before locking UX)

1. Instagram Login vs Facebook Login for Tech Provider SaaS (dashboard conflict text)  
2. Exact ES v4 asset picker payload for Pages/IG/Ad Accounts  
3. Publishing rate 50 vs 100 — always read live limit endpoint  
4. Whether Page↔WhatsApp business link can ever be Graph-automated (today: no public path)  
5. Marketing Messages / OTN timeline for Messenger outside-window (tag deprecations)  

---

## Capability matrix — Meta API ↔ Samyoj ecosystem

| Meta capability | Fits Samyoj? | Phase | Depends on |
|-----------------|--------------|-------|------------|
| WA Cloud messaging / templates / flows / calling | Already | — | Current stack |
| WA Catalog sync | Already | — | Keep; no Order API |
| Lead Ads → Contact | Yes | 1 | Page + Channel |
| CTWA Inbox context | Yes | 2 | WA webhooks only |
| Messenger Inbox | Yes | 3 | Channel + Page |
| IG DM Inbox | Yes | 4 | Channel + IG |
| IG/Page comments | Yes | 4–5 | Same |
| IG/Page publish + Stories | Yes | 5 | Publish scopes |
| Ads Insights dashboard | Yes | 6–7 | ads_read + tier |
| Custom / Lookalike audiences | Yes | 6 | ads_management + consent |
| CAPI Conversion Leads | Yes | 1→6 | Pixel + CRM stages |
| Full Ads Manager | Weak fit | Never v1 | — |
| Shops orders | No | — | API dead |
| Unified analytics | Yes | 7 | Phases 1–6 data |

---

## Suggested calendar (points, not dates)

1. **Phase 0** schema + webhook router (blocks everything)  
2. **Phase 1** Lead Ads (revenue + CRM proof)
3. **Phase 2** CTWA polish (cheap, WA-only)
4. **Phase 3** Messenger Inbox
5. **Phase 4** Instagram Inbox
6. **Phase 5** Publish (incl. Stories — corrected CAN)
7. **Phase 6** Ads read + audiences (never Explore/poll/delivery-estimate — v26 dead)
8. **Phase 7** Cross-channel dashboard
9. **Phase 8** ES v4 / portfolio UX (start App Review / ES work **in parallel** early — clock on **Oct 8, 2026**)

App Review + Business Verification run **in parallel** from Phase 1 onward — they are the longest wall.

---

## Self-assessment (doc quality score)

**Score: 8.5/10.** Deductions: IG-vs-FB login dashboard text needs live App Dashboard check (−0.5); ES v2 death date docs-vs-blog conflict, planned before earlier date (−0.5); publish limit 50-vs-100 needs live endpoint read (−0.5).

| Lens | Read |
|------|------|
| Code reviewer | Endpoint tables re-verified against `meta.service.ts` + `meta-calling.service.ts` + `catalog/service.ts`. Grep: zero `graph.instagram.com` / `leadgen` / `ads_management` in `server/src` — WhatsApp-only confirmed. |
| Architect | §6 blockers confirmed: no `Channel`, no `ContactPlatformIdentity`, `whatsappNumberId` + composite uniques + `Restrict` FKs across 10+ models, `Message.metaMessageId @unique` collision domain. Migration blast radius now stated. |
| UX | Inbox assumes `X-WhatsApp-Number-Id` everywhere; channel badge + filter + `channelId` rooms listed as Phase 0 work, not assumed. |
| Product | Order = Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Competitor pattern (AiSensy cohorts, Wati session-vs-template, Interakt failure taxonomy) mapped to cohorts → next-campaign with CSW + consent gate. |
| Security | Secrets stay `server/.env`, never UI. Tokens encrypted AES-256-GCM. `OAuthAccount` rejected for IG/FB (user-scoped) — `Channel` is the store. |
| Meta dev | v26 (both APIs, Jul 29, 2026) + Oct 27 all-version enforcement + ES v2 Oct 8 + tag deaths Apr 27 + Stories CAN + Shops CANNOT — all pinned with dates. |

**Gaps closed this pass:** 12 (see phase doc § Recheck log). **Open DOUBTs:** 5 (Global DOUBT list) — each needs live Graph / App Dashboard read before UX lock. No false CANs remain.

---

## Recheck vs original prompt

| Original ask | Roadmap answer |
|--------------|----------------|
| Ads — kya bana / nahi / system mein kaise | Phases 1–2, 6; CANNOT full manager |
| Instagram via existing connect | **Not via current WA scopes**; Phase 0+4 + new scopes / ES v4 |
| Facebook connect + automate | Phases 1 + 3 + 5 |
| Teen channels ek system | Phase 0 model + 3–4 Inbox + 7 dashboard |
| Business Portfolio | § Phase 8 + research §1.2 |
| Single analytics | Phase 7 |
| Exact order | This file top → bottom |
| Jo implement nahi hoga | Global CANNOT + per-row CANNOT |

---

*Ordered for implementation. Research truth lives in the companion phase doc. Code only when asked.*
