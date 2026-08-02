# Samyoj Dashboard Home — Content POC (for AI design)

**Scope:** First screen after login only (`/` → `DashboardPage`).  
**Out of scope:** Theme, colors, fonts, brand styling, login/auth look. Use this doc only for **what content**, **why**, and **what visual types** (card / ring / list / CTA) to place.

**Purpose of this doc:** Feed an AI design tool with exact information architecture + copy so the redesigned dashboard home answers: *“What’s going on with my WhatsApp business right now, and what should I do next?”*

---

## 1. Product context (one paragraph)

Samyoj is a **WhatsApp Automation & CRM** workspace. After login, the user lands on **Dashboard** (`/`). The rest of the product lives in sidebar pages: Inbox, Calls, Automations, AI Bots, Campaigns, Templates, Orders, Contacts, Tickets, Reports, Team, Billing, Settings. The home screen must **not** replace Inbox or Reports — it is a **status + action hub**.

---

## 2. What we already show today (code inventory)

Source of truth: `DashboardPage.tsx`, `WhatsAppConnectGuide.tsx`, `analyticsApi.overview()`, `AnalyticsOverview`, layout chrome (`AppTopbar`, `QualityRatingBanner`). Cross-checked against a full codebase inventory of `/`.

### 2.1 Page chrome (always around `/`)
| Item | Content |
|------|---------|
| Page title | Dashboard |
| Page description | See how your WhatsApp is doing |
| Live badge (topbar) | Live |
| Context line (desktop) | `{firstName} @ {workspace}` |
| First-login caveat | If workspace setup incomplete and not skipped, user may be redirected once to `/settings?tab=setup` before staying on `/` |

### 2.2 Sections top → bottom (current)

#### A. Quality rating banner (conditional, layout-level)
Only when Meta quality is **YELLOW** or **RED** (from billing usage / quality ratings).
- Title: `WhatsApp quality rating critical` (RED) or `WhatsApp quality rating warning` (YELLOW)
- Body: `{phoneNumber} ({qualityRating})` · plus guidance:
  - RED: Message throughput may be limited. Review your messaging practices immediately.
  - YELLOW: Monitor your template quality and response rates to avoid downgrade.
- CTA: View usage → `/billing`
- Visual type: alert / warning banner (urgent channel-health signal — **keep in redesign content**)

#### B. WhatsApp connection strip (`WhatsAppConnectGuide`)
**State: not connected**
- Heading: Connect WhatsApp
- Body: Sign in with Facebook and pick your business number to get started.
- Micro-steps: Connect → Sign in → Choose number
- Primary CTA: Connect WhatsApp
- Visual type: status / setup banner with phone icon

**State: connected**
- Heading: WhatsApp connected
- Subtext: `+{phoneNumber}`
- Secondary CTA: Settings → `/settings?tab=whatsapp`
- Danger CTA: Disconnect (confirm: “Disconnect WhatsApp? New messages will stop until you connect again.”)
- Visual type: success status bar

#### C. Hero metrics block
- Badge: Live metrics
- Time context: Last 30 days
- Primary number label: Total messages sent
- Primary number: `{messagesSent}`
- Supporting line: Track delivery health, engagement, and team activity from one place.
- Mini tiles: Delivery `{deliveryRate}%` · Read rate `{readRate}%` · Health `{avg(delivery, read)}%`
- Visual type: large KPI hero + 3 secondary percentage chips
- Note: hero has **no drill-down CTA** today

#### D. Key metric cards (row of 3)
| Label | Value | Hint |
|-------|-------|------|
| Active chats | `{activeConversations}` | Need attention |
| Contacts | `{totalContacts}` | Total saved |
| Failed messages | `{failedMessages}` | Review & retry |

- Visual type: icon + big number + short hint (no sparkline today)
- Note: hints are **not** links today — redesign should make them actionable

#### E. Performance panel
- Title: Performance
- Subtitle: Engagement & delivery health
- Score chip: Score `{healthScore}%`
- Three ring gauges: Delivery · Read rate · Health
- Visual type: circular progress / ring metrics (duplicates hero % in another form)

#### F. Quick actions (5 tiles)
| Label | Description | Goes to |
|-------|-------------|---------|
| Open inbox | Reply to customer chats | `/inbox` |
| New campaign | Reach your audience | `/campaigns` |
| Templates | Manage approved messages | `/templates` |
| Automations | Set up automatic replies | `/automations` |
| Voice calls | AI & agent calling | `/calls` |

- Visual type: navigation shortcut grid

#### G. Error / loading
- Loading: skeleton placeholders
- Error title: Could not load dashboard
- Error body: Something went wrong while loading your numbers. Please refresh or try again in a moment.
- Toast: Unable to load dashboard metrics. Please try again.
- Note: all-zero metrics still render numbers (no special empty marketing state)

### 2.3 Data fields available for home (API)
From `GET /api/analytics/overview` (UI labels period as last 30 days; scoped to org + active WhatsApp number):

- `messagesSent` — OUTBOUND messages created in window
- `deliveryRate` — string %, from OUTBOUND `DELIVERED` / sent
- `readRate` — string %, from OUTBOUND `READ` / sent
- `failedMessages` — OUTBOUND `FAILED` count
- `activeConversations` — conversations with status `OPEN` (**not** time-windowed)
- `totalContacts` — contact count for number scope (**not** time-windowed)
- Derived client-side: `healthScore = round((delivery + read) / 2)`

**Also on home chrome (not overview API):**
- WhatsApp numbers / connect URL / disconnect
- Quality ratings via billing usage (`YELLOW` / `RED` banner)

**Not on home today (exist elsewhere):** open tickets, campaign status, agent presence, pipeline stages, call volume, SLA / first-response time, unread inbox count, scheduled broadcasts, AI bot status, conversation cost (enhancement-plan notes).

---

## 3. Competitor first-screen patterns (research summary)

| Product | What first / overview surfaces | Content takeaway for Samyoj |
|---------|--------------------------------|-----------------------------|
| **respond.io** | Open contacts needing attention, team members + status + load, opened/closed conversations (time range), merge suggestions, upcoming broadcasts | Mix of **work queue** + **ops snapshot** + **scheduled outbound** — not only vanity totals |
| **Wati** (Team Inbox analytics) | Ticket status counts, operator performance, sent vs received, delivery status | **Workload + message health**; delivery/failure is first-class |
| **Interakt** | Conversation volume, responded %, resolved, wait / resolution times; sales funnel / agent reports in CRM | Separate **support health** vs **sales funnel**; home should not dump full reports |
| **SaaS UX research** (generic) | Actionable-first, 5–7 primary elements, top-left = north-star question, progressive disclosure, empty states with CTAs | Home = **decide + act**, not a data warehouse |

**Common competitor content buckets on “day one” screen:**
1. **Attention queue** — who/what needs me now (open chats, oldest waiting, assigned to me).
2. **Channel / system health** — connected?, delivery failures, quality.
3. **Volume snapshot** — messages / conversations over a clear time range.
4. **Team pulse** (owners/managers) — who is online / overloaded.
5. **Outbound upcoming** — next campaign / broadcast.
6. **Shortcuts** to deepest daily tools (Inbox first).

---

## 4. User psychology — what they need in ≤5 seconds

### Primary user questions (priority order)
1. **Is WhatsApp working?** (connected / number / can I send & receive)
2. **Who needs me now?** (active / unread / waiting chats)
3. **Are my messages healthy?** (delivered / read / failed)
4. **Is outreach working?** (volume + optional campaign signal)
5. **What should I click next?** (Inbox first; then Campaign / Automation)

### Mental models by role
| Role | Cares most on home | Less important on home |
|------|--------------------|------------------------|
| Owner / Admin | Connection, failures, volume, health, shortcuts to setup | Per-agent deep tables |
| Supervisor | Active chats, failures, team load (if shown) | Billing |
| Agent | *My* open chats / go to Inbox | Org-wide totals, billing |

### Cognitive rules for redesign content
- **One north-star insight** first (recommend: “needs attention” OR “messages healthy”, not both equally loud).
- **5–7 primary content blocks max** on the first viewport.
- Every number needs **label + time range + meaning** (e.g. “Last 30 days”, “Need attention”).
- Prefer **action next to insight** (e.g. Failed messages → “Review failures” / open Reports or Inbox filter).
- Duplicate metrics (hero % + same rings) waste trust — show each insight **once**.
- Empty / zero states must explain **what to do**, not just “0”.

---

## 5. Recommended content architecture (redesign POC)

Use this as the AI design brief. Still **no theme** — only content + visual *type*.

### Screen goal
**“Situation awareness + next action for WhatsApp ops.”**

### Layout content map (top → bottom)

#### Block 0 — Context header (content only)
- Greeting or page title: **Dashboard** (or “Good morning, {name}” optional)
- Subline: **Here’s your WhatsApp workspace at a glance**
- Time-range control label: **Last 7 days** (default) / Last 30 days / Today  
  *(Psychology: 30 days is slow for daily ops; competitors use Today / 7 / 14 / 30.)*

#### Block 1 — Channel status (must stay)
**Visual type:** horizontal status banner + optional quality alert above it

| Connected | Disconnected |
|-----------|--------------|
| Title: WhatsApp connected | Title: Connect WhatsApp to go live |
| Detail: Business number `+…` | Detail: Sign in with Facebook and choose your business number |
| Actions: Manage connection · Disconnect | Primary: Connect WhatsApp · Secondary: How it works |

**Also design:** Meta quality warning/critical banner when rating is YELLOW/RED (copy from §2.2 A) with CTA to billing/usage — this is already live and is high-urgency content.

#### Block 2 — Needs attention (north-star for daily users)
**Visual type:** priority strip / 2–3 alert chips or a short list (max 3–5 rows)

Recommended content items (show only if count > 0; else hide or show calm empty):
1. **Open chats waiting** — `{activeConversations}` — CTA: Open inbox
2. **Failed messages** — `{failedMessages}` — CTA: View failures / Reports
3. **Unread / unassigned** *(if product can supply later)* — CTA: Open inbox

Empty (all zero):  
- Title: You’re caught up  
- Body: No chats waiting and no failed messages in this period.  
- CTA: Open inbox · Start a campaign

#### Block 3 — Health snapshot (3–5 KPI cards max)
**Visual type:** metric cards (number + label + one-line context). Optional tiny trend arrow later — not required for v1 design.

| Priority | Label | Value source | Context line | Click → |
|----------|-------|--------------|--------------|---------|
| 1 | Messages sent | `messagesSent` | In selected period | Reports |
| 2 | Delivery rate | `deliveryRate`% | Reached customers’ phones | Reports |
| 3 | Read rate | `readRate`% | Opened by customers | Reports |
| 4 | Active chats | `activeConversations` | Open conversations | Inbox |
| 5 | Contacts | `totalContacts` | In your CRM | Contacts |

**Drop from primary row if crowded:** Contacts (move to secondary).  
**Do not** also show a second “Performance rings” block with the same three % — pick **either** cards **or** rings, not both.

#### Block 4 — Optional single visual insight
**Visual type:** one simple chart OR three rings — choose **one**

Recommended for AI mock:
- **Option A:** Sent vs delivered vs read (simple bar or stacked, period-scoped)  
- **Option B:** Three rings only (Delivery / Read / Health) *instead of* duplicating % in hero

Caption: **Message performance · {time range}**

#### Block 5 — Upcoming / outbound (competitor-aligned; soft if no data)
**Visual type:** list card (0–3 rows)

- Title: Upcoming campaigns  
- Row: Campaign name · Scheduled time · Status  
- Empty: No campaigns scheduled · CTA: Create campaign  

*(If campaigns API not wired on home yet, design the empty state — content still belongs on home.)*

#### Block 6 — Work shortcuts
**Visual type:** 4 primary action tiles (keep focused; 5 is OK, 6 is too many)

Recommended set (ordered by daily use):
1. **Inbox** — Reply to customers → `/inbox`
2. **Campaigns** — Message many contacts → `/campaigns`
3. **Contacts** — Customers & pipeline → `/contacts`
4. **Automations** — Auto-replies & flows → `/automations`

Secondary (overflow / “More”): Templates, Calls, Tickets, Reports, AI Bots.

#### Block 7 — Setup checklist (only if incomplete)
**Visual type:** checklist card (3–5 items, checkmarks)

Suggested items:
- [ ] WhatsApp connected  
- [ ] First template approved  
- [ ] Invite a teammate  
- [ ] Send first campaign or open Inbox  

Hide entire block when complete.

---

## 6. Exact copy bank (friendly + clear)

### Headers
- Dashboard  
- Here’s your WhatsApp workspace at a glance  
- Needs attention  
- Message health  
- Quick actions  
- Upcoming campaigns  
- Getting started  

### KPI labels (prefer these)
- Messages sent  
- Delivery rate  
- Read rate  
- Active chats  
- Failed messages  
- Contacts  

### Hints / microcopy
- Need a reply  
- Review & retry  
- Last 7 days  
- Across your connected number  
- Jump into your day  

### CTAs
- Connect WhatsApp  
- Open inbox  
- Create campaign  
- View reports  
- Manage connection  
- Disconnect  

### Empty / calm states
- You’re caught up — nothing urgent right now.  
- Connect WhatsApp to see live metrics here.  
- No campaigns scheduled yet.  

### Error
- Couldn’t load your dashboard numbers. Try again.  

---

## 7. Visual *types* to ask the AI for (not styling)

Ask the design AI to generate layouts using these content vessels only:

1. **Status banner** (connected / not connected)  
2. **Attention list or alert chips** (actionable)  
3. **KPI metric cards** (5 max in first row)  
4. **One** performance visual (rings **or** simple chart — not both)  
5. **Short list** (upcoming campaigns / recent activity)  
6. **Action tiles** (4 shortcuts)  
7. **Optional checklist** (onboarding)  
8. **Empty / error / loading** variants for each major block  

Do **not** ask for: purple/cream themes, glassmorphism specs, font names, or auth-page matching — those are separate.

---

## 8. What must *not* clutter the first screen

- Full agent performance tables  
- Full sales funnel report  
- Ticket SLA deep analytics  
- Billing details  
- Template editor  
- Flow builder  
- Duplicate Delivery/Read/Health shown 2–3 times  
- More than ~7 primary content modules above the fold  

Deep detail → **Reports**, **Inbox**, **Team**.

---

## 9. Mapping current → recommended (change intent)

| Current | Keep / Change | Reason |
|---------|---------------|--------|
| Connect / Connected strip | **Keep** | Answers “is WhatsApp working?” |
| Giant “messages sent” hero + same % chips | **Simplify** | Vanity-first; move attention queue above or equal |
| Active / Contacts / Failed cards | **Keep Failed + Active**; Contacts optional | Actionable first |
| Performance rings + hero % | **Pick one** | Removes cognitive duplicate |
| 5 quick actions | **Keep 4 core**; demote Templates/Calls | Inbox-first psychology |
| No “needs attention” list | **Add** | Competitor + daily-ops pattern |
| No upcoming campaigns | **Add empty-capable block** | Outbound awareness |
| Fixed “Last 30 days” badge | **Make selectable / default 7d** | Daily decision cadence |

---

## 10. AI design prompt seed (paste-ready)

```
Design the FIRST screen of a WhatsApp CRM / automation product dashboard (post-login home).

CONTENT ONLY — ignore brand colors from any login page.

Must include:
1) WhatsApp connected OR connect banner with number / CTA
2) “Needs attention” with Active chats + Failed messages + Open inbox CTA
3) Up to 5 KPI cards: Messages sent, Delivery rate, Read rate, Active chats, Contacts — with time range “Last 7 days”
4) ONE performance visual (either 3 rings OR one simple chart — not both)
5) Upcoming campaigns list (with empty state)
6) Four shortcuts: Inbox, Campaigns, Contacts, Automations
7) Optional getting-started checklist when incomplete

Psychology: in 5 seconds user knows (a) WhatsApp works, (b) who needs them, (c) message health, (d) next click.
No full reports tables. Max ~7 primary modules. Provide desktop + mobile stacked variants.
Show connected + disconnected + empty-metrics states as separate frames.
```

---

## 11. Success criteria for the redesign content

A user can answer without leaving home:
1. Is my number connected?  
2. How many chats need attention?  
3. Are messages delivering / being read?  
4. Did anything fail?  
5. Where do I go next (Inbox / Campaign)?  

If the mock cannot answer these five, the content IA is incomplete.

---

## 12. Related product screens (context only)

Do not redesign these in this pass; home may **link** into them:

| Route | Label | Role vs home |
|-------|-------|--------------|
| `/inbox` | Inbox | Primary work surface |
| `/calls` | Calls | Secondary |
| `/automations` | Automations | Setup / growth |
| `/ai-bot` | AI Bots | Setup |
| `/campaigns` | Campaigns | Outbound |
| `/templates` | Templates | Outbound support |
| `/commerce` | Orders | Commerce |
| `/contacts` | Contacts | CRM |
| `/tickets` | Tickets | Support |
| `/reports` | Reports | Deep analytics |
| `/team` | Team | Admin |
| `/billing` | Billing | Admin |
| `/settings` | Settings | Connection & workspace |

---

## 13. Implementation status (Aug 2026 redesign)

Shipped on `/` against design mock + this POC (page body only; Layout chrome unchanged).

### Implemented
- Connection strip with Connected badge + real quality label (GREEN/YELLOW/RED) + Manage / Disconnect
- Needs attention (open chats → Inbox, failed → Reports; calm empty state)
- KPI grid (5 cards) with **Last 7/14/30 days** + period-over-period `%` deltas
- Single Message performance donut (replaces duplicate rings)
- Upcoming campaigns from `campaignApi.list`
- Quick actions: Inbox, Campaigns, Contacts, Automations, More menu
- Getting started checklist from `onboardingApi.status` (hidden when complete)
- `GET /analytics/overview?days=` extended with absolute counts + deltas

### Deferred (no API / out of scope)
- Recent activity feed
- AI suggestion / Create Follow-up marketing card
- Fake Cloud API “99%” health
- Decorative sparklines (deltas only in v1)
- Sidebar help card / Inbox nav badge / topbar chrome redesign

---

*Generated from Samyoj codebase (`DashboardPage`, `WhatsAppConnectGuide`, `AnalyticsOverview`, navigation) + competitor/UX research (respond.io, Wati, Interakt, SaaS dashboard IA patterns). No visual theme prescribed.*
