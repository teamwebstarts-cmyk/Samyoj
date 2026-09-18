# Samyoj Meta Ecosystem — Team Brief

**Audience:** Senior engineers / product leads  
**Status:** Planning only — no implementation until explicitly kicked off  
**Date:** 2026-09-17  

**Current consolidated plan:** [`META_ECOSYSTEM_V2_PLAN_2026-09-18.md`](META_ECOSYSTEM_V2_PLAN_2026-09-18.md)  
**Do / Don’t:** [`META_ECOSYSTEM_DOS_AND_DONTS_2026-09-18.md`](META_ECOSYSTEM_DOS_AND_DONTS_2026-09-18.md)  
**Vendors:** [`META_ECOSYSTEM_VENDOR_BENCHMARK_2026-09-18.md`](META_ECOSYSTEM_VENDOR_BENCHMARK_2026-09-18.md)

**Deep docs (optional):**
- Research: [`META_ECOSYSTEM_PHASE_2026-09-17.md`](META_ECOSYSTEM_PHASE_2026-09-17.md)
- Ticket rows: [`META_ECOSYSTEM_IMPLEMENTATION_ROADMAP_2026-09-17.md`](META_ECOSYSTEM_IMPLEMENTATION_ROADMAP_2026-09-17.md)

---

## 1. Problem

Samyoj today is a strong **WhatsApp** CRM (Cloud API, inbox, automations, campaigns, calling, billing).

Customers already live on **Meta Ads → Instagram → Facebook Messenger → WhatsApp**. Competitors (Respond.io, Wati, Interakt) sell that loop as one product. We only own WhatsApp.

**Core problem:** Inbox, Contact, and Conversation are bound to `whatsappNumberId`. Adding IG/FB on top of that without a channel model will break tenancy and history.

---

## 2. Solution (product idea)

Turn Samyoj into a **Meta business operating layer**:

| Layer | Role |
|-------|------|
| **WhatsApp** | Keep as primary messaging + campaigns + calling (existing strength) |
| **Instagram + Messenger** | Same Inbox — DMs/comments with channel filter |
| **Meta Ads** | Not Ads Manager — **leads in**, **insights out**, optional audience sync |
| **Analytics** | One dashboard: messaging + ads KPIs (three money ledgers stay separate) |

```text
Meta Ads (Lead / CTWA)
        │
        ▼
   Samyoj Contact
        │
   ┌────┴────┬────────────┐
   ▼         ▼            ▼
 WhatsApp  Instagram   Messenger
   └─────────┴────────────┘
              │
       Unified Inbox + Analytics
```

**Positioning:** We are the CRM + inbox destination. Customer still creates ads / pages in Meta UI where Meta requires it.

---

## 3. Approach

1. **Foundation first** — introduce `Channel` + platform identities before any IG/FB UI.  
2. **Smallest Ads surface first** — Lead Ads → Contact (highest CRM value, least Ads API).  
3. **Reuse WhatsApp infra** — same webhook durability, encrypted tokens, org tenancy; **new send adapters** per platform (do not overload WA `meta.service` paths).  
4. **App Review in parallel** — permissions / Business Verification start early; they are the long pole.  
5. **Honest scope** — ship what Meta APIs support; never invent WA-style blasts for IG/Messenger.

**Locked defaults**
- Connect path Day 1: **Page-linked Facebook Login** (Page token covers Lead Ads + Messenger + linked IG). Instagram Login path later if App Review confirms.
- Platform credentials stay in `server/.env` — never in Settings UI.
- Ad spend / WABA fees / Samyoj SaaS = **three ledgers**, never one SKU.

---

## 4. Work plan (phases)

| Phase | Outcome | Exit gate |
|-------|---------|-----------|
| **0 — Foundation** | `Channel`, `ContactPlatformIdentity`, `Conversation.channelId`, webhook router by Meta `object` | WA still works; schema ready for multi-channel |
| **1 — Lead Ads → CRM** | Page connect + `leadgen` webhook → Contact (+ optional WA template) | Test lead lands in correct org |
| **2 — CTWA context** | Ad referral chip + 72h window guidance in Inbox | Agent sees ad source on WA chat |
| **3 — Messenger Inbox** | Send/receive on Page within 24h | Channel filter = Facebook |
| **4 — Instagram Inbox** | DMs + comment moderate / private reply | Channel filter = Instagram |
| **5 — Publish** | IG feed/Reels/Stories + Page posts | Schedule/publish from Samyoj |
| **6 — Ads read / audiences** | Insights tiles + Custom Audience upload | No Ads Manager clone |
| **7 — Analytics** | Single dashboard, channel filters | Messaging + ads KPIs together |
| **8 — Portfolio UX** | Linked assets view; ES v4 multi-asset where ready | Clear “what’s connected” |

**Suggested sequence:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.  
**Parallel:** App Review + Embedded Signup v4 (ES v2 sunset ~**8 Oct 2026** — plan migration early).

---

## 5. What we are building vs not

### Building

- Unified Inbox (WA + Messenger + IG) with channel badge/filter  
- Lead Ads → Contact (+ optional WhatsApp follow-up)  
- CTWA source context on WhatsApp threads  
- Comment tools + private reply (IG)  
- Content publish (IG + Page), including Stories (limited vs native app)  
- Ads **performance** dashboard + CRM → Custom / Lookalike audiences  
- Cross-channel analytics (display only; no fake unified Meta invoice)

### Not building (v1 / never)

| Item | Why |
|------|-----|
| Full Meta Ads Manager in Samyoj | Wrong product; use Ads Manager |
| Create Business Manager / ad accounts in-app (v1) | Meta UI; keep simple |
| WA ↔ Page link via public API | Manual in Business Manager |
| IG/Messenger campaign blasts like WA templates | Different Meta products / windows |
| Personal FB / personal IG automation | Professional / Page assets only |
| Mix ad spend into Samyoj plan price | Ledger rule |
| Shops Order Management API | Blocked on current Graph surface |
| Fake “one Meta bill” | Show three costs; don’t merge pricing |

---

## 6. Engineering notes (short)

| Topic | Decision |
|-------|----------|
| Tenancy | New `Channel` per asset; **do not** reuse `whatsappNumberId` for IG/FB |
| Tokens | Encrypted on `Channel` (same pattern as WA number tokens) |
| Webhooks | Extend existing durable claim/complete; route `whatsapp_business_account` / `page` / `instagram` |
| Messaging windows | IG/Messenger ≈ 24h for free replies; outside window ≠ WA templates |
| API version | Target Graph/Marketing **v26.0** intentionally (stop silent old fallback drift) |
| Codebase today | WhatsApp-only Graph calls; no `leadgen` / Ads / IG messaging modules yet |

---

## 7. Open risks (resolve before UX lock)

1. Instagram Login vs Facebook Login wording for Tech Provider SaaS (confirm App Dashboard).  
2. Exact ES v4 multi-asset picker payload (Page / IG / Ad Account).  
3. Live publish quota (read limit endpoint; don’t hardcode 50 vs 100).  
4. Outside-24h Messenger options after tag deprecations.  
5. Contact merge rules when same person appears on WA + IG + Messenger.

---

## 8. How to use this pack

| Need | Read |
|------|------|
| Share with leadership / seniors | **This brief** |
| Capability truth / Meta limits | Phase research doc |
| Ticket-level build order | Implementation roadmap |

**Next step when product says go:** kick off **Phase 0** only (schema + webhook router). Do not start IG/Ads UI before Phase 0 exit gate.

---

*Keep WhatsApp excellent. Add Meta channels without cloning Ads Manager. Ship the CRM loop competitors sell — with Samyoj’s existing automation depth underneath.*
