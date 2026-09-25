# Instagram → Comments — content & feature spec (for UI generation)

**Purpose:** Describe what the **Instagram Comments** screen is for, what content appears, how features behave, and how that maps to **code that exists today** — so a designer or UI generator can lay out screens without inventing product scope.

**Route:** `/instagram/comments`  
**Nav label:** Instagram section → **Comments**  
**Primary code:** `client/src/pages/InstagramCommentsPage.tsx`  
**API:** `GET/POST /api/instagram/comments/*` (`server/src/modules/instagram/comments.routes.ts`, `comment-ingest.ts`)

**Not in scope for this page (do not show as if shipped):** public reply on the post thread, likes, post/Reel preview gallery, assignment to agents, internal notes on comments, sentiment/tags, bulk actions, second private reply, WhatsApp-style chat thread on this screen.

---

## 1. Product story (one paragraph)

Businesses get **Instagram comments on posts and Reels** (and live comments via the same webhook path) into a single list inside Samyoj. Agents can **hide** spam on Instagram, send **one private reply** that lands in the commenter’s **DMs** (Meta “private reply”), and rely on **keyword automations** to send that private reply automatically. A real **ongoing chat** only starts after the customer **replies in Instagram DMs** — then the thread lives under **Instagram → Inbox**, with the normal **24-hour messaging window**, not on the Comments page.

---

## 2. Who sees what (access & roles)

| Topic | Behavior in code |
|--------|------------------|
| **Who can open Comments** | Any signed-in user in the organization (`authenticate` + `requireOrg` on API). UI copy on the page states: “Anyone signed in to this organization.” |
| **Who can connect Instagram** | **OWNER** or **ADMIN** only (`useMetaChannelConnect` → `canConnect`). Agents see **“Ask an admin”** on empty/connect CTA when not connected. |
| **Connect path** | Instagram is **Page-linked**: Facebook Page connect first, then `POST /instagram/connect` from Settings or empty-state CTA. Settings copy: “Instagram uses the Facebook Page already connected.” |
| **WhatsApp number** | Comments are **org-scoped**, not scoped by `whatsappNumberId`. No number switcher on this page. |

---

## 3. Connection states (what the page “means”)

The list API always returns `connected: boolean` plus optional `account`.

| State | User-facing meaning | Content to show |
|--------|---------------------|-----------------|
| **Not connected** | No active `Channel` with `platform: IG` | Title area still “Comments”. Subtitle fallback: “Professional account linked to your Facebook Page”. Empty card: **“Connect Instagram”** + explanation that comments on the linked professional account appear here. Primary CTA: **Connect Instagram** (or **Ask an admin**). |
| **Connected, zero comments** | Webhooks may not have fired yet, or no one has commented | **“No comments yet”** + “When someone comments, you can hide it or send one private reply.” Show linked account: **`@username`** when `account.name` is set (API uses channel `name`; UI prefixes `@`). |
| **Connected, has comments** | Normal working list | Search + filter chips + comment cards. Optional footer: **“Showing N of total”** when `total > comments.length` (server returns max **40** per request by default, up to **100**; UI does not paginate — search narrows). |
| **Load error** | API failure | Toast: “Could not load comments”; treated like disconnected in state (`connected` false). |

**Account subtitle (header):**  
- Connected: `@accountName`  
- Not connected / no name: “Professional account linked to your Facebook Page”

---

## 4. Page information architecture (content blocks)

Use these as **sections** in generated UI (labels can be styled; meaning must stay).

### 4.1 Page header

- **Product name line:** “Comments” (with Instagram channel connotation — pink accent in current UI).
- **Context line:** Linked Instagram handle or generic Page-linked explanation (see §3).

### 4.2 Education strip (three fact cards — currently on page)

These explain Meta rules so agents do not treat Comments like Inbox chat.

| Card title | Body copy (product truth) |
|------------|---------------------------|
| **Who can open this** | Anyone signed in to this organization. |
| **What Hide and Reply use** | The Facebook Page linked to this Instagram account. |
| **Private reply** | One message, within 7 days. A chat starts after they reply in DMs. |

### 4.3 Toolbar

| Control | Behavior |
|---------|----------|
| **Search** | Placeholder: “Search name or text”. Debounced server search on `fromUsername` and comment `text` (case-insensitive). Label (a11y): “Search comments”. |
| **Filter chips** | Client-side filters on the loaded batch (see §6). Labels: **All**, **Need reply**, **Replied**, **Hidden**. |

### 4.4 Comment list

Each row is **one Instagram comment record**, not a conversation.

### 4.5 Empty / filter-empty

| Case | Copy |
|------|------|
| No comments (not connected) | See §3 |
| No comments (connected) | See §3 |
| Filter has no matches | “Nothing in this filter.” |
| Partial list | “Showing {loaded} of {total}. Search to narrow the list.” |

---

## 5. One comment row — fields & display rules

Data shape (API + UI): `CommentRow`

| Field | Shown to user as | Notes |
|-------|------------------|-------|
| `fromUsername` | `@username` | If missing: `@unknown` |
| `text` | Comment body, preserves line breaks | Empty text shown as “—” |
| `commentedAt` | Locale date/time string | |
| `hidden` | Metadata suffix: “· Hidden on Instagram” | Row may appear visually de-emphasized (e.g. reduced opacity) |
| `privateReplyOpen` | Computed server-side: within **7 days** of `commentedAt` and no reply sent yet | Metadata: “· Reply open N day(s)” |
| `privateReplySentAt` | Status line (see §7) | Hides composer |

**Not shown in UI today (stored in DB but no surface):** `igMediaId` (which post/Reel), `fromId`, `igCommentId`, post thumbnail, permalink, like count, public reply thread, live vs feed indicator.

---

## 6. Filters (client-side)

Applied **after** fetch; they do not change the API query except search `q`.

| Chip | Includes comments where… |
|------|----------------------------|
| **All** | Everything in the loaded list |
| **Need reply** | `privateReplyOpen === true` AND `hidden === false` |
| **Replied** | `privateReplySentAt` is set |
| **Hidden** | `hidden === true` |

**“Need reply”** = still inside 7-day window, no private reply sent yet, not hidden.  
Does **not** mean “customer replied in DMs” — that is tracked only in **Instagram Inbox**.

---

## 7. Actions per comment

### 7.1 Hide / Unhide

- **Control label:** “Hide” or “Unhide” (with hide icon).
- **Effect:** Calls Meta Graph API to hide/unhide the comment on Instagram; updates local `hidden` flag.
- **Requirement:** Facebook Page token for the Page linked to the IG channel. Error if Page not linked: connect Page first (server message).
- **A11y:** “Hide comment from @username” / “Unhide comment from @username”.

### 7.2 Private reply (manual)

- **When composer shows:** `privateReplyOpen` and no `privateReplySentAt`.
- **Composer placeholder:** “Private reply in their DMs”.
- **Limit:** **1000** characters (`maxLength` on client; server validates 1–1000).
- **Submit:** Sends one message via Meta private reply API (`recipient: { comment_id }` pattern through Page).
- **Success toast:** “Private reply sent. Waiting for them.”
- **Success inline status:** “Reply sent. Waiting for them in DMs.” (pink emphasis in current UI).
- **After send:** Composer removed; row treated as **Replied** filter.

### 7.3 Private reply window closed

- When 7 days passed since `commentedAt` and no reply was sent:  
  **“The 7-day private reply window is closed.”**  
- No composer; hide may still work if Meta allows.

### 7.4 Cannot send twice

- Server enforces **one** `privateReplySentAt` per comment (atomic claim before Graph call).
- Second attempt error message (user-facing): **“Reply sent. Waiting for them.”** or **“Private replies are only available for 7 days.”**

---

## 8. Realtime & freshness

| Mechanism | Behavior |
|-----------|----------|
| **Socket event** | `instagram:comment` → page refetches list (`useSocket`). |
| **Source of new rows** | Meta webhook `instagram` object, fields `comments` or `live_comments` → `ingestInstagramComment` → DB insert → socket emit. |
| **Duplicates** | Same `igCommentId` per org is ignored on ingest. |

**UI implication:** New comments can appear without refresh; no “live” badge required unless you add one cosmetically.

---

## 9. Automations (related product, mostly Automations page)

Comments page does **not** configure rules; behavior still affects what agents see.

| Rule type | Applies to IG comments? |
|-----------|------------------------|
| **KEYWORD** with `config.platform: IG` | **Yes** — on ingest, if comment text matches keyword, system sends **same private reply** once (same 7-day / one-shot rules). |
| **WELCOME / AWAY / LEAD_CAPTURE** on IG | **No** for comments — keyword-only path in `comment-ingest.ts`. |
| **WhatsApp KEYWORD** | **No** — `whatsappNumberId: null` channel automations; platform must be `IG`. |

**Automations UI copy (when channel = Instagram):**

- Channel hint: **“Comment keyword”**
- Keyword field label: **“Word in a comment”**
- Hint: **“One private reply when this word appears. A 24h chat starts only after they reply in DMs.”**
- No quick-reply **buttons** on IG automations (buttons cleared when platform is IG).

**Agent expectation on Comments page:** A comment may already show **Replied** without manual action if automation fired first.

---

## 10. End-to-end journey (content for tooltips / onboarding)

```text
Customer comments on post/Reel (or live comment event)
        ↓
Samyoj stores comment → appears on Comments page (socket refresh)
        ↓
Optional: IG keyword automation → one private DM
   OR agent: Hide and/or manual private reply
        ↓
Customer sees message in Instagram DMs (not as public reply)
        ↓
If customer replies in DMs → thread in Instagram → Inbox (24h window, human/agent/bot as configured)
        ↓
Comments page does NOT become the chat UI for that thread
```

**Instagram Inbox composer note (elsewhere in product):** For threads that started from a comment, product docs specify reminding: one private reply per comment; 24h chat only after they reply in DMs.

---

## 11. Meta / industry context (for realistic UI copy, not extra features)

Use this to sound like global products (ManyChat, Meta Business Suite, respond.io patterns) while **only promising what Samyoj ships**:

| Industry pattern | Samyoj today | Safe UI wording |
|------------------|--------------|-----------------|
| “Reply in DM” / “Private reply” | Shipped | “Reply in their DMs” / “Private reply” |
| Keyword → auto DM on comment | Shipped via Automations | “Auto-reply when a comment contains your keyword” |
| Hide spam / offensive | Shipped | “Hide on Instagram” |
| Public reply under post | **Not shipped** | Do not show |
| Post preview + jump to post | **Not shipped** | Optional future: “On a post” without thumbnail |
| Assign comment to agent | **Not shipped** | Do not show |
| SLA / sentiment | **Not shipped** | Do not show |
| Live video-only reply window | Webhook ingests `live_comments`; **no UI distinction**; Meta may reject private reply outside broadcast | Optional footnote: “Live comments follow Instagram’s rules.” |

---

## 12. Errors & edge cases (user-visible messages)

| Situation | Message / behavior |
|-----------|-------------------|
| IG not connected | 404-style flows: “Connect Instagram in Settings first” (API); empty state CTA on page |
| Page not linked for hide/reply | “Connect the Facebook Page linked to Instagram first” / “Connect a Facebook Page first” (connect flow may redirect to Facebook OAuth) |
| Private reply Graph failure | Toast: “Could not send private reply” + server error text when present |
| Hide failure | “Could not hide comment” |
| Automation competes with manual | First successful send wins; second shows “Reply sent. Waiting for them.” |

---

## 13. Suggested UI generation brief (copy deck)

**Screen title:** Comments  
**Channel:** Instagram (Page-linked professional account)

**Hero / empty connected:**  
“When someone comments on your posts, you can hide it on Instagram or send one private reply to their DMs.”

**Hero / empty not connected:**  
“Connect the Instagram professional account linked to your Facebook Page to see comments here.”

**Row states (status lines):**

1. Open: “Reply open · N days left” (optional; code already shows “Reply open N day(s)” in metadata line)  
2. Replied: “Reply sent. Waiting for them in DMs.”  
3. Window closed: “The 7-day private reply window is closed.”  
4. Hidden: “Hidden on Instagram”

**Primary actions:** Hide · Send private reply  
**Secondary:** Search · Filter: All | Need reply | Replied | Hidden

**Cross-links (navigation content only):**

- Settings → Instagram connect  
- Instagram → Inbox (for DM conversations after they reply)  
- Automations → Instagram → Comment keyword (setup auto private reply)

---

## 14. Code reference map (for implementers)

| Concern | Location |
|---------|----------|
| Page UI | `client/src/pages/InstagramCommentsPage.tsx` |
| API client | `client/src/services/api.ts` → `instagramApi.comments` |
| List / hide / reply routes | `server/src/modules/instagram/comments.routes.ts` |
| Ingest + automation + send | `server/src/modules/instagram/comment-ingest.ts` |
| Webhook entry | `server/src/modules/whatsapp/webhook-dispatcher.ts` (`comments`, `live_comments`) |
| Graph hide / private reply | `server/src/modules/facebook/page-client.ts` |
| DB model | `InstagramComment` in `server/prisma/schema.prisma` |
| Phase product rules | `docs/meta-ecosystem/phases/04-instagram.md` |
| Website truth table | `docs/product/WEBSITE_FEATURE_CATALOG_2026-09-24.md` § Instagram Comments |

---

## 15. Honest limits (state in FAQ or footer, not as broken UI)

- **Live delivery** depends on Meta app permissions (`instagram_manage_comments`), webhook subscription (`comments`, `live_comments`), and production webhook path — same infra as WhatsApp inbound.  
- **No post context** in list: agents see comment text only, not which Reel/post (data exists as `igMediaId` for future UI).  
- **No pagination UI:** only first page + search; high volume needs future “Load more” or server paging.  
- **Single active IG channel** per org in API (`activeIgChannel` latest by `updatedAt`).

---

*Document version: aligned to codebase as of 2026-09-25. For UI mockups and AI layout generation; not a commitment to add features listed only in §11 as “not shipped”.*
