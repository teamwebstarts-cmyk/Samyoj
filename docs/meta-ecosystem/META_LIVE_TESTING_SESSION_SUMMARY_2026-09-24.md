# Meta live testing session summary — 24 Sep 2026

**Audience:** senior stakeholder / handoff  
**Scope:** work done in the Meta ecosystem live-testing chat (Facebook Page, Messenger, Instagram, Ads read-only). Samyoj Phase 0–5 code was already hardened before this session; this doc is **testing and Meta configuration only**.

**Related docs (saved in repo):**

- [META_APP_CONFIGURATION_2026-09-24.md](META_APP_CONFIGURATION_2026-09-24.md) — dashboard permission evidence
- [META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md](META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md) — App Review, publish, and test order
- [PHASE_0_5_FINAL_HANDOFF_2026-09-24.md](PHASE_0_5_FINAL_HANDOFF_2026-09-24.md) — product scope and pass criteria

---

## One-line summary for senior

We connected **Facebook Page “Samyoj”** and **Instagram `@teamsamyoj`** in Samyoj, fixed **Invalid Scopes** via Meta use cases/permissions, documented **App Review + publish** requirements, and restarted local stack with a healthy webhook. **Real Messenger and Instagram Inbox proof in Samyoj is still blocked** by Meta (unpublished app + webhook delivery rules) and by **test mistakes / Business asset linking** (Page vs personal profile, Page ↔ ad account not linked). **Ads read in Samyoj** is blocked until the **ad account is assigned to the Page** in Business Settings.

---

## What we completed today

### Meta Developer app (configuration)

- Added/configured use cases including **Manage messaging & content on Instagram** and **API setup with Facebook login**.
- Resolved **Invalid Scopes** on Page reconnect (Instagram permissions were **Add to App**; configured through use case → permissions).
- Confirmed Webhooks for **Instagram** object: callback URL set, **`messages`**, **`comments`**, **`live_comments`** subscribed.
- Noted Meta warning: **unpublished app** → only dashboard **Test** webhooks reliably; real production-style delivery requires **Live/Published** app after review where applicable.
- Saved permission/use-case evidence in [META_APP_CONFIGURATION_2026-09-24.md](META_APP_CONFIGURATION_2026-09-24.md).

### Meta Business / assets

- Created/used **Professional Instagram** `@teamsamyoj` and linked it to Facebook Page **Samyoj** (Page settings + Meta Inbox access ON).
- Added Facebook Page **Samyoj** (ID `1332179919982819`) to Business portfolio **Samyoj** (`teamsamyoj owns this`).
- **Connected assets** on Page: **Instagram `teamsamyoj`** shows as connected (1 asset).
- Identified **correct** ad account: **Samyoj** ID **`947824925057304`** (not restricted **Samyoj Ai** `1046453654444544`).
- Ads Manager: account exists but **no campaigns yet** (empty metrics are OK once linked).

### Samyoj product (UI / connect)

- **WhatsApp:** already connected; inbound sync active (from earlier setup).
- **Facebook Page:** connected in Settings as **Samyoj**.
- **Instagram:** connected in Settings as **`@teamsamyoj`**.
- **Facebook Inbox UI:** loads; **0 conversations** (no successful Page-originated webhook ingest yet).
- **Instagram Inbox UI:** loads; **0 conversations** (no webhook POST observed for real DMs).
- **Ads performance UI:** correctly shows **“No ad account is shared with this Page”** (fail-closed; not fake ₹0).

### Engineering / environment

- Wrote [META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md](META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md).
- Updated meta-ecosystem README and blocker/status docs with dashboard evidence.
- **Local restart:** `bash start.sh` after Docker recovery; API/Client/Admin healthy; tunnel **`https://collision-modified-spur.ngrok-free.dev/api/whatsapp/webhook`**; webhook registration ready.
- Webhook health counters unchanged for **new** Meta events (`totalReceived: 8`, last event **2026-09-23**) — confirms **no new Page/Instagram POSTs** reached Samyoj during today’s DM tests.

### Codespace URLs (reference)

- Client (HTTPS preview): `https://reimagined-fortnight-4j5p7x95xqqgc6p5-3000.app.github.dev`
- Facebook Inbox: `…/facebook/inbox`
- Ads: `…/facebook/ads`

---

## Problems hit and how we addressed them

| Problem | Cause | What we did | Status |
|--------|--------|-------------|--------|
| **Invalid Scopes** (Instagram then Page OAuth) | App requested scopes not added on use case | Instagram API use case → permissions → **Add to App**; green checklist on required permissions | **Fixed** for OAuth flow |
| OAuth asked for Instagram but none listed | No Professional IG linked to Page | Created `@teamsamyoj`, Professional account, linked to Page | **Fixed** |
| **Invalid Instagram username/password** when adding Page to portfolio | Meta requires IG login when Page+IG added together; wrong password or FB password used | Reset IG password; eventually Page added to portfolio | **Fixed** (Page in portfolio) |
| Messenger tests: no Samyoj Inbox | Messages sent to **personal profile “Samyoj Ai”** (Add friend), not **Facebook Page “Samyoj”** | Explained Page **Message** button / Page URL / second account | **Not retested correctly yet** |
| Instagram DM in Meta Inbox but not Samyoj | First DM in **Message requests**; unpublished app webhook rule; no POST to ngrok | Accept request; send **new** DM after accept; App Review/publish for real delivery | **Blocked** for Samyoj proof |
| **Connect assets** only offered Instagram | IG already linked; Meta UI flow confusion | Use **Connected assets** tab; seek **Ad account** link separately | **In progress** |
| Ads: “No ad account shared with this Page” | Graph `assigned_ad_accounts` empty: **ad account not connected to Page** | Use ad account `947824925057304`; avoid restricted account; link Page ↔ ad account in Business Settings | **Open** |
| Add Page + Instagram to portfolio failed repeatedly | Meta asset ownership / credential verification | Page eventually added; IG on Page **Connected assets** | **Partially fixed** |

---

## What is still broken or open

1. **Page ↔ ad account assignment** — Ad account `947824925057304` **Connected assets** = empty; Page **Connected assets** = Instagram only. Samyoj Ads will stay on setup message until Meta links Page and ad account.
2. **Real Facebook Messenger → Samyoj Inbox** — Not proven. Needs message to **Page** (not profile) + webhook delivery (publish/review as applicable).
3. **Real Instagram DM → Samyoj Inbox** — Not proven. Meta native Inbox works; Samyoj received **no** new webhook POST. Unpublished-app restriction + need fresh message after request accept.
4. **Instagram comments / keyword / private reply** — Not tested live (same webhook/publish gate).
5. **Lead Ads → Contacts pipeline** — Not tested this session.
6. **App Live/Published** — Required for confident **real** cross-channel webhook proof per Meta dashboard copy; documented in runbook.
7. **Restricted ad account `Samyoj Ai`** — Do not use; separate from main **Samyoj** ad account.

---

## Testing matrix — done, not done, why, when

| Test | Done? | Result | Why not fully tested / blocked | When we can test |
|------|--------|--------|--------------------------------|------------------|
| WhatsApp connect + outbound | Yes (prior) | Connected | — | Now |
| WhatsApp inbound (`totalReceived`) | Partial | Last increment 2026-09-23 | No new phone reply this session | Send **new** reply anytime (tunnel up) |
| Meta OAuth Page + IG in Samyoj | Yes | Both Connected in Settings | — | Now |
| Facebook Inbox UI | Yes | Shell OK, 0 chats | No valid Page Messenger webhook ingest | After Page message + delivery |
| Messenger real message | No | — | Wrong target (profile); webhook not proven | After correct Page message + Meta delivery |
| Instagram native DM | Yes | Seen in Meta Inbox | — | Now |
| Instagram → Samyoj Inbox | No | 0 conversations | No webhook POST; request/publish factors | Dashboard **Test** now (transport); real DM after **publish** + new message |
| Instagram comment + automation | No | — | Same webhook gate | After publish + test comment |
| Ads read in Samyoj | No | Setup message | Page–ad account not linked | After **Connected assets** link + refresh (maybe reconnect Page) |
| Ads vs Ads Manager | No | — | Depends on link + optional spend data | After link; zeros OK if no campaigns |
| Lead Ads pipeline | No | — | Out of time / focus today | After Page webhook + form test |
| Webhook dashboard **Test** (IG messages/comments) | Recommended | Not recorded in chat | User focused on real DMs | **Now** (proves callback only) |

---

## Why we did not call Phase 0–5 “live proven”

- Samyoj **code** for separate inboxes, Ads read-only, and webhooks was already verified locally in prior work.
- Today’s session proved **configuration progress** and found **Meta-side and test-method gaps**, not new application bugs for empty Inbox/Ads messages.
- **Honest gate:** real event → public POST → DB conversation → UI → reply. That chain did **not** complete for Messenger or Instagram in Samyoj today.

---

## Recommended next actions (ordered)

1. **Ads (Meta Business only):** Page **Samyoj** → **Connect assets** or **Connected assets** → attach ad account **`947824925057304`**. Confirm on ad account **Connected assets** that Page appears. Refresh Samyoj **Ads**; reconnect Page if needed.
2. **Messenger:** Second Facebook account → open **Page Samyoj** → **Message** → unique text. Refresh **Facebook Inbox**. Reply test.
3. **Instagram transport:** Developer → Instagram Webhooks → **Test** on `messages` (and `comments`). Confirm API logs / health timestamp (optional).
4. **Instagram real DM:** After App **publish** (and permissions approved), accept requests, send **new** DM, retest Samyoj Inbox.
5. **App Review:** Follow [META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md](META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md) — screencasts, no `ads_management`, then Live.
6. **Lead Ads:** One Instant Form submit → Contacts pipeline `META_ADS` (after Page `leadgen` delivery works).

---

## Simple talking points for senior (copy-paste)

- Configured Meta app use cases and permissions; fixed OAuth **Invalid Scopes**; Page and Instagram show **Connected** in Samyoj.
- Linked `@teamsamyoj` to Page **Samyoj**; added Page to Business portfolio; Instagram appears under Page connected assets.
- Documented full **App Review / publish / test** runbook and saved dashboard permission evidence in repo.
- Restarted dev environment; webhook URL and registration OK; **no new Meta Page/IG webhook events** hit the server during DM tests.
- **Blockers:** (1) link ad account to Page for Ads screen, (2) Messenger test must target **Page not personal profile**, (3) real IG/Messenger webhook delivery needs published app / Meta rules — dashboard Test webhooks available meanwhile.
- **Not done today:** end-to-end Messenger in Samyoj, IG in Samyoj, comments/automation, Lead Ads, Ads tiles vs Ads Manager.

---

## Customer production

Unchanged: internal test deploy yes; **customer production / live Meta proof complete: no** (see workspace rules and [STATUS_SIMPLE.md](STATUS_SIMPLE.md)).
