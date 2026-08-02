# Samyoj Inbox — Content POC (for AI design)

**Scope:** First work screen after Dashboard — `/inbox` only.  
**Out of scope:** Theme, colors, fonts, brand styling, login look. Use this for **what content**, **why**, and **visual types** so you can generate a totally new Inbox design.

**Purpose:** Feed an AI design tool so the redesigned Inbox answers: *“Who needs a reply, what’s the context, and how do I respond fast (within WhatsApp rules)?”*

**Companion doc:** `docs/ui-specs/dashboard-home-content-poc.md` (home). This doc is screen #2 in the Main nav: Dashboard → **Inbox** → Calls…

---

## 1. Product context (one paragraph)

Inbox is the **daily work surface** of Samyoj — shared WhatsApp Team Inbox. Agents open chats, reply (free text or templates), assign ownership, use AI bot handoff, labels, internal notes, quick replies, tickets, snooze, and calls. It is **not** a reports screen and **not** a campaign builder. One route (`/inbox`); deep-link `?conversation={id}` then clears.

---

## 2. What we already show today (code inventory)

Sources: `InboxPage.tsx`, `client/src/components/inbox/**`, `inboxApi`, `pageMeta`.

### 2.1 Page chrome
| Item | Content |
|------|---------|
| Title | Inbox |
| Description | Reply to your customers |
| Nav label | Inbox |

### 2.2 Layout regions (current IA)

**Desktop / large:** 3 panes side-by-side  
**Mobile:** list OR chat (exclusive); details as bottom sheet  

```
┌─────────────────┬──────────────────────────┬──────────────┐
│ Conversation    │ Chat thread              │ Details rail │
│ list            │ + composer               │ / overlay    │
└─────────────────┴──────────────────────────┴──────────────┘
```

#### LEFT — Conversation list
1. Header: **Inbox** · `{n} conversation(s)` · connection status · `{n} unread`
2. Search: placeholder `Search by name or phone...`
3. Filters: status · assigned agent
4. Rows (scroll) + pagination if total > 10 (`Showing {start}–{end} of {total}`)
5. FAB: **New chat**

#### CENTER — Chat pane
**No selection:** placeholder — Select a conversation + tips  
**Selected:**
1. Header (back on mobile · avatar · name/phone · AI / Call / actions · service-window badge)
2. Status banners (handoff / active flow / bot paused) — conditional
3. Message thread (date dividers + bubbles)
4. Service-window banner when 24h closed
5. Composer: text/media **or** template **or** interactive

#### RIGHT — Details (lg+)
- Collapsed icon rail: Labels · Team notes · Quick replies · Convert to ticket · Snooze 2 hours  
- Expanded: **Chat details** panel  

### 2.3 Filters (list sub-views)
| Control | Options |
|---------|---------|
| Status | All chats · Open · Pending · Closed · Snoozed |
| Agent | All agents · Assigned to me · `{agent name}` |

### 2.4 Conversation row — fields shown
- Status dot (OPEN / PENDING / CLOSED / SNOOZED)
- Contact name or phone
- Last message preview (text / Photo / Video / Voice / Document / Template / Interactive…)
- Relative time
- Unread count (cap `99+`)
- Open-ticket badge
- Active flow step label (if any)
- Assigned agent first name (large screens)

### 2.5 Chat header — fields / actions
- Name · phone · optional “WhatsApp” · assigned agent
- AI ON / OFF · bot picker (Default bot / named bots)
- Call / Calling…
- Labels · Team notes · Ticket · Snooze 2 hours
- Service badge: `{time} left` / Can reply / Expired / Use template

### 2.6 Message thread content types
- Text, image, video, audio, document
- Template / interactive (buttons, list, URL, call, copy-code)
- Contact card · location
- Outbound status ticks: sent / delivered / read / failed
- Automation badges: Flow / Quick reply
- Date dividers: Today · Yesterday · weekday+date

### 2.7 Composer modes (sub-flows)
| Mode | When | Key copy |
|------|------|----------|
| Text + attach | 24h window open | Type a message… · Photo/Video/Document/Payment link |
| Template | Window closed | Send template · Approved template · Cancel |
| Interactive | User opens strip | Buttons · List · URL · Call · Copy code · Preview |
| Canned | Type `/shortcut` | Autocomplete quick replies |
| Closed window helper | Window closed | Reply window closed — use a template |

### 2.8 Overlays / panels
| Flow | Content |
|------|---------|
| New chat | Phone (country code, no +) · optional name · Start chat |
| Context menu | Assign to / Unassigned / Assign to me · Pause/Enable AI · Mark open/pending/closed |
| Details — Labels | List · add label |
| Details — Team notes | Internal only · Add a note · Save note |
| Details — Quick replies | Type /shortcut… · list |
| Media viewer | Photo/Video/Document · prev/next · download |
| Ticket | Prompt title → create ticket |
| Payment link | Amount INR · description → send as text |
| Snooze | Fixed **2 hours** (no picker today) |

### 2.9 Empty / loading / error (content)
| State | Copy |
|-------|------|
| List filtered empty | No chats match · Try different search or clear filters |
| List empty + WA connected | No conversations yet · Start a chat or wait… · Start new chat |
| List empty + WA not connected | Connect WhatsApp to start receiving… · Connect WhatsApp |
| No chat selected | Select a conversation · Choose a chat from the list… |
| No templates | No approved templates |
| List load fail | Silent today (redesign should show error) |

### 2.10 Keyboard (current)
| Key | Action |
|-----|--------|
| `R` | Focus search |
| `Esc` | Deselect / close |
| `D` | Open details |
| Media Esc / ← / → | Close / prev / next |

*(Placeholder still says “Press /” — mismatch with `R`; fix in redesign copy.)*

---

## 3. Competitor / UX patterns (research summary)

| Pattern | What good Team Inboxes show | Takeaway for Samyoj |
|---------|----------------------------|---------------------|
| **respond.io / Wati** | Shared list, assignment, notes, tags, status, customer profile side panel | Keep 3-pane: **list → thread → context** |
| **Chat list** | Sorted by latest; filters: open/closed, assignee, unreplied, labels | Unreplied / needs reply is a high-value filter if you add it |
| **Details panel** | Contact + CRM context + labels + notes without leaving chat | Details must stay one click away |
| **WhatsApp 24h rule** | Clear “window closed → template” messaging | Keep service-window as first-class content |
| **Psychology** | Agents ask: Who’s waiting? Who owns this? What can I send now? | Priority = **urgency + ownership + reply capability** |

---

## 4. User psychology — ≤5 seconds

### Questions agents ask
1. **Which chat needs me first?** (unread / open / assigned to me)
2. **Who is this customer?** (name, phone, labels, ticket)
3. **Can I type freely or must I use a template?** (24h window)
4. **Is a bot / flow / teammate already handling this?**
5. **What’s the fastest reply?** (canned / template / interactive)

### By role
| Role | Cares most | Less on this screen |
|------|------------|---------------------|
| Agent | My chats, reply, shortcuts | Org analytics |
| Supervisor | Unassigned / overloaded, handoffs | Billing |
| Owner | Connection health (badge), that team can reply | Deep reports |

---

## 5. Recommended content architecture (redesign POC)

Still **no theme** — content + visual *types* only.

### Screen goal
**“Triage → understand → reply correctly (WhatsApp-safe).”**

### Block map

#### A. List pane — Triage
**Visual type:** searchable filterable list + FAB

**Must show per row:**
- Customer display name (fallback phone)
- Last message preview (1 line)
- Time
- Unread indicator
- Status (Open / Pending / Closed / Snoozed)
- Optional chips: Assigned agent · Ticket · Bot/Flow active

**List header content:**
- Title: Inbox  
- Counts: `{n} chats` · `{n} unread`  
- Connection: Connected / Disconnected  

**Filters (recommended):**
- Status (keep current set)
- Assignee (All / Me / Agent)
- *Nice-to-add:* Unreplied · Has ticket · Bot active  

**Empty states:** keep the three variants (filtered / connected empty / not connected).

**Primary list CTA:** New chat  

#### B. Thread pane — Conversation
**Visual type:** header + banners + message stream + composer  

**Header must show:**
- Identity (name + phone)
- Owner (assigned agent or Unassigned)
- AI status (On / Paused)
- Window status (Can reply / Use template + time left)
- Actions: Call · Ticket · Snooze · More  

**Banners (only when true):**
- Handed off to team (+ reason)
- Automation waiting (+ step)
- AI paused → Turn on  

**Thread:** chronological messages + date dividers + delivery ticks  

**Composer (one visible mode at a time):**
1. Free text + attach + `/` quick replies — when window open  
2. Template picker — when window closed  
3. Interactive builder — opt-in strip  

Always show clear **why** free text is blocked when closed.

#### C. Context pane — Customer / team
**Visual type:** side panel sections (tabs or accordion)

Recommended sections (in order):
1. **Contact** — name, phone, link to Contacts record (if available later)
2. **Labels** — chips + add  
3. **Team notes** — internal only (say so explicitly)  
4. **Quick replies** — shortcuts list  
5. **Shortcuts** — Convert to ticket · Snooze (with duration choice in redesign: 1h / 2h / tomorrow)

#### D. Overlay flows (separate frames for AI)
Design these as distinct frames/modals:
1. New chat  
2. Send template  
3. Interactive message (5 modes)  
4. Media viewer  
5. Assign / status menu  
6. Create ticket (proper form, not browser prompt)  
7. Payment link (proper form)  

---

## 6. Copy bank (friendly)

### Headers
- Inbox  
- Reply to your customers  
- Chat details  
- New chat  
- Send template  
- Interactive message  

### Filters
- All chats · Open · Pending · Closed · Snoozed  
- All agents · Assigned to me  

### Empty / calm
- Select a conversation  
- No chats match your filters  
- No conversations yet  
- Connect WhatsApp to receive messages  
- You’re all caught up — no unread chats  

### Window / composer
- Can reply freely · Nh Nm left  
- Reply window closed — send an approved template  
- Type a message…  
- Template · Send template · Cancel  
- Send interactive message  

### Collaboration
- Assign to · Assign to me · Unassigned  
- Pause AI bot · Enable AI bot  
- Only your team can see these notes  
- Convert to ticket · Snooze  

### Errors (user-facing)
- Couldn’t load conversations. Try again.  
- Couldn’t send message. Try again.  
- Couldn’t start chat. Check the phone number.  

---

## 7. Visual *types* for the AI (not styling)

Ask design AI for:
1. **3-pane desktop shell** (list / thread / details)  
2. **Mobile stacked:** list → full-screen chat → sheet for details  
3. **Conversation row** component  
4. **Message bubbles** (in + out + media + template + interactive)  
5. **Composer states:** open window / closed window / template / interactive  
6. **Service-window banner**  
7. **Details panel** sections  
8. **New chat** slide-over  
9. **Empty / loading / error / disconnected** frames  
10. **Assign & status** menu  

Do **not** specify login theme, purple gradients, or auth fonts.

---

## 8. What not to dump on Inbox first view

- Full analytics / reports  
- Campaign builder  
- Flow builder canvas  
- Billing  
- Long CRM edit forms (link out to Contacts)  
- More than one composer mode visible at once  

---

## 9. Current → recommended (change intent)

| Current | Keep / Change | Why |
|---------|---------------|-----|
| 3-pane IA | **Keep** | Industry standard Team Inbox |
| Status + assignee filters | **Keep** | Core triage |
| Add unreplied filter | **Add** | Psychology: who waits |
| Service window UX | **Keep + clarify** | WhatsApp rule is critical |
| Duplicate AI controls (header + menu + banner) | **Simplify** | One clear AI control |
| Snooze fixed 2h | **Improve** | Offer duration choices |
| Ticket/payment via `prompt()` | **Replace** | Real forms in redesign |
| Shortcut copy `/` vs key `R` | **Align** | Trust |
| Silent list load errors | **Fix** | User-facing error state |
| Details rail | **Keep** | Context without leaving chat |

---

## 10. AI design prompt seed (paste-ready)

```
Design a WhatsApp Team Inbox for a CRM/automation product (post-login work screen).

CONTENT ONLY — ignore login-page brand theme.

Desktop: 3 panes —
1) LEFT conversation list: title Inbox, chat count, unread count, connection status, search, filters (All/Open/Pending/Closed/Snoozed + Assigned to me), conversation rows (name, preview, time, unread, status, optional agent/ticket/flow chips), New chat button, empty states.
2) CENTER chat: header (name, phone, assignee, AI on/off, Call, window status), optional banners (handoff, automation waiting, AI paused), message thread with date dividers and delivery ticks, composer that switches between free text+attach, template mode (when 24h window closed), and interactive message mode.
3) RIGHT details: Contact summary, Labels, Team notes (internal only), Quick replies, Ticket + Snooze actions.

Also provide frames for: mobile list/chat, New chat form, Send template, Interactive message builder, media viewer, disconnected WhatsApp empty state, no-selection placeholder.

Psychology: in 5 seconds agent knows who needs reply, whether free text is allowed, who owns the chat, and how to respond fast.
No analytics tables. No campaign builder on this screen.
```

---

## 11. Success criteria

A user can answer without leaving Inbox:
1. Which chats need attention?  
2. Who owns this chat?  
3. Can I type freely or need a template?  
4. What’s the last customer message?  
5. How do I assign, note, label, ticket, or call next?  

If a mock can’t answer these five, the Inbox content IA is incomplete.

---

## 12. Sub-screens / flows checklist (for multi-frame design)

| # | Frame | Required? |
|---|-------|-----------|
| 1 | Desktop Inbox — chat selected | Yes |
| 2 | Desktop — no selection | Yes |
| 3 | Mobile — list | Yes |
| 4 | Mobile — chat open | Yes |
| 5 | Details expanded (labels/notes) | Yes |
| 6 | New chat | Yes |
| 7 | Template composer (window closed) | Yes |
| 8 | Interactive composer | Yes |
| 9 | Context menu / assign | Nice |
| 10 | Media viewer | Nice |
| 11 | Empty: no WA connected | Yes |
| 12 | Empty: no chats | Yes |
| 13 | Create ticket form | Nice (replace prompt) |
| 14 | Snooze duration picker | Nice |

---

## 13. Related screens (link out, don’t redesign here)

| Route | Why Inbox links there |
|-------|------------------------|
| `/contacts` | Full contact / pipeline |
| `/tickets` | Ticket queue after convert |
| `/calls` | After Call back |
| `/templates` | Approve templates |
| `/ai-bot` | Configure bots |
| `/campaigns` | Outbound when window closed |
| `/settings` | Connect WhatsApp |

---

*Built from Samyoj Inbox codebase inventory + Team Inbox UX patterns (shared list, assignment, notes, tags, 24h window). No visual theme prescribed.*
