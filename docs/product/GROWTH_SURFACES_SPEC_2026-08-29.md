# Growth surfaces — full product spec (prompt recheck)

**Date:** 2026-08-29  
**Audience:** founders + implementers  
**Status:** waves 1–3 implementing on existing surfaces. Instant-all-tenants / fake Meta remaining / React tab remain refused.  
**Parents:** [`GROWTH_SURFACES_PHASE_2026-08-29.md`](./GROWTH_SURFACES_PHASE_2026-08-29.md) (short decisions) · research notes `01`–`03`.

This document is the **serious pass** against the original Hindi prompt. Every ask is named. If we will not do it, the reason is here — not buried in a one-line table.

---

## Naming: “group” vs “phase” (confusion to kill)

There are **not** two product phases named “surface phase.” Three different lists got mixed:

| Name | What it is | How many |
|------|------------|----------|
| **Research groups** (already done) | Unlazy leaves that *wrote docs* | **3 notes + 1 synthesis** — Meta policy, Samyoj files, competitors, then the short decision table |
| **Product waves** (this spec) | Order to *code* when you say implement | **3 waves**, 9 surfaces |
| **GSD `/gsd/research-phase`** | External CLI + `.planning/` | **Not installed** in this Codespace. Do not wait for it. |

**Wave 1 — ops truth (dashboard + quota + inbox filter + honesty)**  
**Wave 2 — money engine (campaign retargeting + featured templates)**  
**Wave 3 — growth extras (website button + OBA checklist; click tracking stays deferred)**

---

## Prompt map — nothing skipped

### 1) Dashboard: quality rating + promo / “quality contact” messages

**You asked:** Replace delivery-rate cards with **quality rating** and **promo messages** / **quality contact messages**. Document first.

**Already in product:** `LiveMetricsHero` shows **Total sent + Delivery % + Read %** (`DashboardPage.tsx`). Phone quality is polled (`quality_rating`) but shown on connect strip + YELLOW/RED banner, **not** those two cards. Promo mix is **not** on the dashboard. `GET /analytics/meta-health` fabricates marketing % — **must not** be the source.

**What “quality contact messages” means in Samyoj (we define it):** Meta has no Graph field with that name. We show two counts from `ConversationCharge` (already filled by `pollConversationAnalytics`):

- **Promo** = `MARKETING` conversations in the selected period  
- **Service / quality** = `UTILITY` + `AUTHENTICATION` + `SERVICE` (customer-care / transactional)

**UI (not built):** Keep the big **sent** number. Replace the two `MiniMetricCard`s:

1. **Quality** — High / Medium / Low / Unknown (map GREEN/YELLOW/RED/UNKNOWN). Color chip. Link “Open WhatsApp Manager”. Unknown copy: “Waiting for Meta (first poll can take up to a day).”
2. **Promo vs service** — e.g. `12 promo · 40 service` in the period picker window. Tooltip: “Meta conversation categories. Not click-through.”

**Logic:** Read `WhatsappNumber.qualityRating` for the **active** number (`X-WhatsApp-Number-Id`). Category counts: `ConversationCharge` filtered by org + number + period. If no charges yet, show “—” not 0-pretend.

**Do:** Swap vanity delivery % (that is our DB, not Meta quality). Keep `QualityRatingBanner` for YELLOW/RED.  
**Don't:** Invent remaining Meta quota on this card. Mix template `quality_score` into the phone card. Use `meta-health` fake splits.

**Missing vs prompt:** Exact phrase “quality contact” is our label choice — product copy should say **Service messages** in UI so agents don’t invent a Meta product.

---

### 2) Quota: today’s used / remaining, YouTube-ads style, also on campaigns

**You asked:** Different users, live remaining, like YouTube ads budget; also on campaigns where the template send happens.

**Already:** Org daily **campaign** cap default 5000 (`campaigns/quota.ts`). `GET /campaigns/quota` returns `sentToday` — **UI never calls it**. Plan entitlements do **not** count messages. Meta unique-user limit is **not stored**. Graph gives **tier name** (`TIER_250`…), **not** “187 left.”

**UI — Campaigns page (primary, matches prompt “also campaigns”):** Toolbar pill: `Broadcasts today 1,204 / 5,000` + thin progress bar (YouTube-like). At ≥80% amber, at 100% block new send with existing quota error. Wizard review step repeats the same numbers before Send.

**UI — Dashboard (secondary):** Optional third small line under hero: same Samyoj bar, labeled **Samyoj daily send cap** (never “WhatsApp remaining”).

**UI — Meta tier (honest):** Separate chip `Meta limit: 10,000 unique users / 24h (outside chat window)` after we add Graph field `whatsapp_business_manager_messaging_limit`. Subtext: “Exact remaining is in WhatsApp Manager → Messaging limits. We cannot copy that number from the API.”

**Logic:** `getDailySendUsage` already. IST vs UTC: use the **same timezone the quota ledger already uses** (do not invent a second calendar). Remaining = `limit - sentToday` for **Samyoj only**.

**Do:** Show used + remaining for **our** cap on Campaigns + wizard.  
**Don't:** Fake Meta remaining as `tier − our_sends`. Count Inbox session replies against Meta unique-user cap in the UI (they don’t consume it). Call it “broadcast quota from Meta.”

**Missing vs prompt:** True Meta “ads remaining” integer **cannot** be built until Meta documents it. Closest honest UX is tier + Manager link.

---

### 3) Green tick / business profile / earning / Meta 2026

**You asked:** Deep 2026 policy; help customers get the tick; profile fields; small earning; CPC; prospecting; provide tick from Meta’s side.

**Research (2026 docs):** Official Business Account = Meta-reviewed **blue** check on the **phone** (India still says green tick). Separate from **Meta Verified** (paid Meta SKU) and **Business Verification** (legal entity, **no chat badge**). Tech Provider **cannot grant** the badge. Rejection → 30-day wait. Test / Business App numbers not eligible.

**UI:** Settings → WhatsApp → **Official check** card (not Dashboard). Checklist: 30 days on Platform, display name approved, 2FA PIN, Business Verification, policy-clean templates. Buttons: “Open WhatsApp Manager to apply”, “Copy document list”. Status: Not started / Pending / Approved / Rejected (from Graph `official_business_account` if present).

**Earning (allowed):** Paid **onboarding hours** or SaaS add-on “Verification prep” = checklist + file vault + reminders. Invoice text: **consulting**, not “purchase of green tick.”  
**Earning (forbidden):** CPC, selling Meta Verified, “we provide the tick from Meta,” guarantee, cloning another brand’s check.

**Do:** Help apply. Poll status. Honest copy.  
**Don't:** Promise color, timeline, or approval. Mix this with click-tracking CPC.

**Missing vs prompt:** We will **not** become Meta’s issuer. That is a hard NO-GO, not a later maybe.

---

### 4) Meta library vs our 3 official templates + “verify once, instant for all users”

**You asked:** Meta library doesn’t make sense as the home; we create 3 popular templates; verify on **one** account; put in every user’s DB so submit = verified in a second.

**Already:** `TemplateLibraryPage` tabs **Meta** vs **Account**. Clone via `library_template_name` (SAMYOJ-11). Create form **already has category + language**.

**What Meta actually does:** Every WABA must **submit** templates. APPROVED on Samyoj’s test WABA **does not** copy approval to customer WABAs. Cross-tenant JSON copy as skip-review is a **ban path**. Official faster path: clone **unmodified Template Library** UTILITY/AUTH rows (still PENDING until that WABA is approved — often minutes, not “instant skip”).

**UI:** Library home = **Samyoj starters** (3 cards), then “Meta catalog (advanced)”, then “This number’s templates.”

**The three (locked for v1 — UTILITY/AUTH only, last-years’ workhorses, Hindi+English):**

1. **Order / booking update** (UTILITY) — `{{1}}` order id, `{{2}}` status  
2. **Appointment reminder** (UTILITY) — time + location vars  
3. **OTP / login code** (AUTHENTICATION) — Meta auth format only  

Each card: Hindi + English. CTA: **Use on this number** → existing clone API → status chip PENDING/APPROVED/REJECTED. Copy: “Meta still reviews this number. Usually fast for these categories. Not skipped.”

**Logic:** Store **starter definitions** in Samyoj (name, language, library_template_name or our body). On use: `POST /{customerWaba}/message_templates`. Persist the customer’s Meta template id on **their** org+number — not a global APPROVED flag.

**Do:** Featured 3; keep Meta tab secondary.  
**Don't:** Say “already verified for everyone.” Marketing festival packs as UTILITY. Skip-review.

**Missing vs prompt:** Instant-all-tenants **will not ship**. Closest: pre-picked library clones that *usually* approve quickly per WABA.

---

### 5) Category + language missing on create

**You asked:** Add category and language on template create.

**Repo check:** `TemplateCreateForm.tsx` already has required Language + Category selects. Wizard passes `form.category` / `form.language`.

**Real gaps (if the screen you used hid them):** library **browse** language is hardcoded `en_US`; locale list is only **8** languages.

**Do:** If a specific wizard step still hides the selects, that’s a **bugfix** on that step — not a new feature.  
**Don't:** Rebuild the whole form.

**Action:** On implement, screenshot every create path (library clone vs blank vs studio). If any path lacks the two selects, add them there only.

---

### 6) Click tracking

**You asked:** What is it; useful or noise; CPC UI?

**What it is:** Knowing which recipient **tapped** a URL / quick-reply. Cloud API **does not** webhook URL taps. Read/delivered are **not** clicks. Reports “Est. CTR” = `readRate * 0.4` — **fake**.

**Who needs it:** Agencies / ads (CTWA). SMB broadcast: **read + reply** is enough (Wave 2 retargeting).

**Call:** **DEFER** full tracker. **GO** honesty: relabel or remove Est. CTR in Wave 1.

**Don't:** Sell CPC from WhatsApp button clicks we don’t have.

---

### 7) Inbox Active / Inactive (24h service window)

**You asked:** One extra filter. Active = window open (recent, can message). Inactive = window closed (message went, service stopped).

**Already:** Thread banner + composer lock (`isWithin24HourWindow`, `cs24hWindowOpensAt`). List chips: All, Unread, Unreplied, **Open**, Favorites, Pending, Tickets, AI Bot. **Open = CRM status**, not the 24h window.

**UI:** Add chips **Can reply** / **Needs template** (or Active / Inactive) on `InboxListHeader` `FILTER_CHIPS`. Active sorts window-open **first**. Inactive = `now > opensAt + 24h` (same helper as composer).

**Logic:** Server list query must filter by `cs24hWindowOpensAt` (don’t only filter in the browser — pagination would lie). Missing `cs24hWindowOpensAt` = treat as inactive (fail closed for free-form).

**Do:** New chips; keep CRM Open/Pending.  
**Don't:** Rename Open to mean window.

---

### 8) WhatsApp website button

**You asked:** User creates a button so site visitors chat easily; where to show; how much custom.

**UI:** Settings → **Integrations** (developer webhooks stay below) or WhatsApp tab: live preview, prefilled first message, accent color, copy snippet + optional float CSS. Number = **active** WhatsApp number only.

**v1 custom:** text, color, position (br/bl).  
**v2 later:** Shopify, per-page `?text=`.

**Logic:** `https://wa.me/<digits>?text=<encodeURIComponent>` — official. No Meta App ID in snippet.

**Don't:** Fake in-page WhatsApp chat; use widget as campaign opt-in; one snippet for all numbers.

---

### 9) Retargeting campaigns (secret key — full wizard)

**You asked:** After a campaign is sent, wizard with tabs: overview, who read, who replied, deliver, react, active window, failed + reasons; list people; open chat; retarget readers; message active-window; drop/fix failed numbers; re-message no-reply.

**Already:** Campaign slideover tabs **Summary** and **Failed** only. Recipients: PENDING / SENT / DELIVERED / READ / FAILED / AMBIGUOUS. Retry failed exists. No replied tab. No “create campaign from this list.”

**UI — replace “two tabs” with a retarget wizard on a completed/running campaign:**

| Tab | Who is in the list | Primary button |
|-----|--------------------|----------------|
| Overview | Counts only | — |
| Read | `READ` | New campaign (template) to these phones |
| Delivered, not read | `DELIVERED` and not READ | Template follow-up |
| Replied | Inbound from that phone after `sentAt` on this number | **Open Inbox** (do not blast) |
| Active window | Cohort ∩ open CSW | Session message **or** template (user picks; session disabled if closed) |
| Failed | `FAILED` + Meta/error text | Retry same template **or** export/drop from audience |
| React | **Not in Cloud API** as a campaign field | **Don't ship** a fake React tab. If we add it later: message reactions on last outbound, not campaign-wide |

Row click → Inbox conversation for that contact+number. Bulk: “New campaign from this tab” pre-fills audience = those recipient ids, **same** `whatsappNumberId`, consent fail-closed.

**Logic:** New endpoint `GET /campaigns/:id/cohorts/:kind` + `POST /campaigns` from recipient ids. Never include AMBIGUOUS in retry. Default follow-up category **UTILITY** with warning if user picks MARKETING (quality risk).

**Do:** Tabs + list + new campaign / retry / open chat.  
**Don't:** Drips, 7-day spam retry, retry AMBIGUOUS, free-form outside CSW, react tab without data.

**Missing vs prompt:** “React” has no campaign metric today — called out so it isn’t silently dropped. Replied needs a **new join** (messages inbound after send) — not a recipient status.

---

## Do / Don’t (global)

**Do:** Number isolation; consent fail-closed; honest Meta vs Samyoj labels; document-first then Wave 1→3.  
**Don't:** App ID in Settings; TARGET billing; Phase C drips; live transfer; fake Graph numbers; sell Meta badges; skip template review.

---

## Wave plan (when you say implement)

| Wave | Ships | Est. size |
|------|-------|-----------|
| **1** | Hide fake CTR/meta-health; dashboard quality + promo/service; Campaigns quota bar; Inbox window chips | 1 product slice |
| **2** | Campaign retarget wizard + featured 3 templates | 1 product slice |
| **3** | `wa.me` builder; OBA checklist | 1 product slice |
| **Later** | Click redirect; more locales; Shopify widget | not this pack |

---

## GSD

`/gsd/research-phase` still cannot run: no `gsd-tools.cjs`, no `.planning/`. This spec **is** the phase research + plan.
