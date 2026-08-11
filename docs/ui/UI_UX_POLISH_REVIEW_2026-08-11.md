# UI/UX Polish — Review & Scope Doc (2026-08-11)

> **Status:** Research only — **no code changes** until each item is confirmed.  
> **Goal:** Small, mostly UI fixes across Login, Dashboard/Connection, Analytics, and Inbox.  
> **Reference:** User screenshots (inbox hover card, context menu, call handoff banner, search board avatars) compared to current code.

---

## How to use this doc

| Column | Meaning |
|--------|---------|
| **#** | Your point (numbered) |
| **Current** | What the code does today (file paths) |
| **Requested** | What you asked for |
| **Screenshot / UX note** | How your reference images map |
| **Open questions** | Needs your confirmation before build |
| **Effort** | S/M/L (rough) |

---

## A — Auth & branding

### A1. Login page — Samyoj logo

| | |
|---|---|
| **Current** | `LoginPage.tsx` → `AuthLayout` → `AuthBrand.tsx` shows **JPEG wordmark** (`/brand/samyoj-logo.jpeg`) with white halo blend. Card title is **"Welcome back 👋"**, not "Samyoj". Desktop left panel: `AuthShowcase.tsx` (headline + stats). |
| **Requested** | Remove current logo/label; add **new Samyoj logo**. |
| **Open questions** | 1) Do you have a **new asset file** (SVG/PNG) or should we use `samyoj-mark.png`? 2) Remove **only** login logo or also sidebar / favicon? 3) Keep "Welcome back" text or replace with product name? |
| **Effort** | **S** (asset swap + layout) |

**Files:** `client/src/components/auth/AuthBrand.tsx`, `AuthLayout.tsx`, `AuthShowcase.tsx`, `public/brand/*`

---

## B — Dashboard & connection

### B1. Connection screen — improve card UX

| | |
|---|---|
| **Current** | **Not connected:** full `PreConnectDashboard` (hero, 4 steps, feature grid, pro tip). **Connected:** compact strip `WhatsAppConnectGuide.tsx` (phone, Live badge, Manage, ⋯ menu). |
| **Requested** | Improve UX of connection **cards** on dashboard. |
| **Screenshot note** | Your dashboard connection area should feel clearer — less clutter, stronger hierarchy. |
| **Open questions** | Which screen: **pre-connect onboarding** cards, **connected** strip, or **both**? Any reference mockup for card layout? |
| **Effort** | **M** |

**Files:** `PreConnectDashboard.tsx`, `PreConnectHero.tsx`, `PreConnectSteps.tsx`, `WhatsAppConnectGuide.tsx`

---

### B2. Analytics period — “714 days” + calendar

| | |
|---|---|
| **Current** | No literal "714 days" in code. `LiveMetricsHero.tsx` shows **`vs last {7|14|30} days`** next to delta **percentages**. `PeriodPicker` = dropdown: Last 7 / 14 / 30 days (Calendar icon, **not** a date-range calendar). |
| **Requested** | Show **overall days** with a **calendar** (not only “vs last N days”). |
| **Screenshot note** | If UI looked like **"714 days"**, likely misread **`714%`** delta glued to **"vs last 7 days"** — fix ties to **B3** (remove % / round numbers). |
| **Open questions** | 1) **Custom date range** picker (from–to) or keep presets (7/14/30)? 2) Replace or supplement current period dropdown? 3) Should comparison text disappear entirely once % is removed? |
| **Effort** | **M–L** (calendar + API date params if custom range) |

**Files:** `LiveMetricsHero.tsx`, `DashboardPage.tsx`, `analyticsApi.overview(periodDays)`

---

### B3. Analytics numbers — round, no %, no decimals

| | |
|---|---|
| **Current** | Delivery/Read: `formatRateDisplay` → integer or **1 decimal + %**. Deltas shown as **% vs last N days**. Health score: rounded integer %. |
| **Requested** | **Round numbers only** — remove **percentages everywhere**, **no decimals**. |
| **Open questions** | 1) Delivery/Read as **counts** (e.g. 1,240 delivered) instead of rates? 2) Hide **delta arrows** entirely or show as **+12** (points) without %? 3) Apply to **Reports** page too (`ReportsPage.tsx`, `RingMetric.tsx`)? |
| **Effort** | **S–M** |

**Files:** `LiveMetricsHero.tsx`, `AiSuggestionCard.tsx`, `ReportsPage.tsx`, `RingMetric.tsx`

---

### B4. Message performance — same number rules

| | |
|---|---|
| **Current** | `MessagePerformanceDonut.tsx` — legend always **`XX.X%`** + counts; center total integer. |
| **Requested** | Same as B3: **exact integers**, no decimals, no %. |
| **Open questions** | Show **counts only** in legend (e.g. `Delivered 1,204`) and drop % from donut legend? |
| **Effort** | **S** |

**Files:** `MessagePerformanceDonut.tsx`

---

### B5. Alerts & popups (logout, etc.)

| | |
|---|---|
| **Current** | **Logout:** immediate — no confirm (`AppTopbar` → `Layout.handleLogout`). **WhatsApp disconnect:** `window.confirm` on dashboard; `ConfirmDialog` on Settings. Mixed patterns elsewhere (`confirm()` vs `ConfirmDialog`). |
| **Requested** | **Better alerts/popups** — consistent, on-brand (e.g. logout confirm). |
| **Open questions** | 1) Logout → **ConfirmDialog** like Settings disconnect? 2) Standardize **all** `window.confirm` to `ConfirmDialog`? 3) Visual style: match green WhatsApp theme or neutral modal? |
| **Effort** | **M** (if global pass) |

**Files:** `ConfirmDialog.tsx`, `AppTopbar.tsx`, `Layout.tsx`, `WhatsAppConnectGuide.tsx`

---

### B6. Connection settings — show Disconnect only

| | |
|---|---|
| **Current** | Connected strip: **Manage** → `/settings?tab=whatsapp`; overflow **Connection settings** (same link) + **Disconnect**. Full settings live on Settings tab. |
| **Requested** | **Remove “Connection settings”** from menu — **Manage** already exists; only need **Disconnect** (or Manage + Disconnect). |
| **Open questions** | Keep **Manage** button visible, or only **Disconnect** in ⋯ menu? Remove **Enable incoming** from strip too? |
| **Effort** | **S** |

**Files:** `WhatsAppConnectGuide.tsx` (~lines 505–560)

---

## C — Inbox list (left panel)

### C1. Default tooltip — last message without opening profile

| | |
|---|---|
| **Current** | Row shows **one truncated line** of last message. **Hover card** (`ConversationPreviewHover` in `ConversationItem.tsx`) shows name, phone, **3-line** preview, status + timestamp — desktop only. |
| **Requested** | **Simple tooltip** to see last message; **remove hover block** (see C2). |
| **Screenshot** | Your image 1: large floating card on hover — that is **`ConversationPreviewHover`** (`w-[280px]`, blur header). |
| **Open questions** | Native `title=` one-liner vs small glass tooltip? Show **full message** or same truncate with more chars? |
| **Effort** | **S** |

**Files:** `ConversationItem.tsx`, `index.css` (`.inbox-row-preview`)

---

### C2. Remove hover block on chat history

| | |
|---|---|
| **Current** | `ConversationPreviewHover` on `group-hover` / `group-focus-within`. |
| **Requested** | **Remove** this hover block completely. |
| **Effort** | **S** (delete component usage; keep C1 tooltip instead) |

---

### C3. Inbox filters — simplify / remove

| | |
|---|---|
| **Current** | **Two filter systems:** 1) Status tabs: **All | Open | Pending | Closed** (`STATUS_CHIPS`). 2) **Filter popover** (agent, Favourites, Unreplied, Open ticket, Bot active). Separate **Unread** square toggle (`CircleDot`). Summary: `"N conversations · M unread"`. |
| **Requested** | **Remove filters completely**; add **Unread** into a simple tab row like **All | Favorites | Unread | Open** (you also mentioned **“changes”** — **not in code today**). |
| **Screenshot** | Image 1: All / Open / Pending / Closed pills + hover card. |
| **Open questions** | 1) Final tab set: **All, Favorites, Unread, Open** only? 2) Drop **Pending / Closed** entirely or move elsewhere? 3) **“Changes”** tab = what? (new messages since last visit? assignment changes?) 4) Remove **agent filter** popover too? |
| **Effort** | **M** (API `ListChip` + `statusFilter` refactor) |

**Files:** `InboxListHeader.tsx`, `inboxListParams.ts`, `InboxPage.tsx`

---

## D — Inbox thread & composer

### D1. Send button — WhatsApp icon only

| | |
|---|---|
| **Current** | `ChatComposer.tsx`: green button with **`SendHorizontal` + label "Send"**; chevron for Send options. `WhatsAppLogo.tsx` exists but **unused**. |
| **Requested** | Remove **"Send"** text; show **WhatsApp-style icon** only. |
| **Open questions** | Use **WhatsApp green send** (custom SVG) or Meta-style paper plane? Keep **split chevron** for Send & mark done? |
| **Effort** | **S** |

**Files:** `ChatComposer.tsx`, `WhatsAppLogo.tsx`

---

### D2. Right-click menu — make it like WhatsApp

| | |
|---|---|
| **Current** | Heavy `ChatContextMenu.tsx`: selection mode, assign submenu, snooze submenu, export, pause bot, status changes, delete. Wired from list + thread (`InboxPage.tsx`). |
| **Requested** | Remove current right-click UX; **WhatsApp-like** minimal menu. |
| **Screenshot** | Image 2: Assign, Snooze, Export, Enable AI bot — you want **simpler** than this. |
| **Open questions** | WhatsApp Web context menu is very small (Reply, Forward, Copy, etc.). For **conversation list**, which actions stay? Suggested minimal: **Mark unread, Archive/Close, Delete**? Remove **Assign/Snooze/Export/Bot** from right-click entirely? |
| **Effort** | **M–L** |

**Files:** `ChatContextMenu.tsx`, `ContextMenu.tsx`, `InboxPage.tsx`

---

### D3. Remove payment URL from interaction

| | |
|---|---|
| **Current** | **Two flows:** 1) Attach menu → **Payment link** → `PaymentLinkModal` (Razorpay URL in plain text). 2) **Interactive** composer mode → **URL / cta_url** (`InteractiveComposer.tsx`). |
| **Requested** | Remove **payment URL** from interaction. |
| **Open questions** | Remove **only** attach-menu Payment link, or also **Interactive → URL** mode? Keep Razorpay elsewhere (Billing)? |
| **Effort** | **S** (scope-dependent) |

**Files:** `ChatComposer.tsx`, `PaymentLinkModal.tsx`, `InteractiveComposer.tsx`, `InteractiveComposerParts.tsx`

---

### D4. Remove “Text” and Campaigns from inbox

| | |
|---|---|
| **Current** | Composer tabs: **Reply | Template | Interactive** (`ComposerModeHeader.tsx` — no tab named "Text"). Details panel quick action: **Create campaign** (`BarChart3`) → `/campaigns?contacts=`. |
| **Requested** | Remove **text** and **campaigns** from inbox interaction. |
| **Open questions** | 1) **"Text"** = **Reply** tab? Remove free-text reply entirely (templates only)? 2) Remove **campaign** icon from details panel only, or block campaign navigation from inbox completely? |
| **Effort** | **S–M** |

**Files:** `ComposerModeHeader.tsx`, `InboxDetailsPanel.tsx`, `InboxPage.tsx`

---

### D5. Remove Snooze

| | |
|---|---|
| **Current** | Snooze in: **context menu** (presets), **chat header** bell (`SnoozePopover` + custom datetime), **bulk bar**. API: `inboxApi.snooze`. |
| **Requested** | **"Remove snooze and replac…"** (message truncated). |
| **Open questions** | **Replace with what?** (Archive? Close? Remind me later elsewhere?) Remove from **all** surfaces including header bell? |
| **Effort** | **M** (if replace + migrate UX) |

**Files:** `ChatContextMenu.tsx`, `SnoozePopover.tsx`, `ChatHeader.tsx`, `BulkSelectionBar.tsx`

---

## E — Inbox details panel (right)

### E1. Remove Customer details & Customer analytics

| | |
|---|---|
| **Current** | `InboxDetailsPanel.tsx` dock: tabs **Overview | Notes | Activity**. Overview = `ProfileCard` (contact). Activity = `StatsRow` (Total chats, Open tickets, Avg first response) + `ConversationActivity`. Collapsed rail icons: Customer, Activity, Labels, Notes, Tags. |
| **Requested** | Remove **customer details** and **customer analytics**. |
| **Open questions** | 1) Remove **entire right panel** or only **Activity/stats**? 2) Keep **Notes, Labels, Tags, Assign**? 3) Keep **Overview** contact name/phone only? |
| **Effort** | **M–L** (depends on how much panel remains) |

**Files:** `InboxDetailsPanel.tsx`, `details/ProfileCard.tsx`, `details/StatsRow.tsx`, `details/ConversationActivity.tsx`

---

## F — Inbox header (chat open)

### F1. AI bot icon + 3-dot menu → single bot dropdown

| | |
|---|---|
| **Current** | `ChatHeader.tsx`: separate **Pause/Play** (bot on/off), **Bot** icon → `BotPickerPopover`, **MoreVertical** overflow (assign, mark unread, select messages, clear, status). |
| **Requested** | **Remove AI bot icon**; merge bot **select + toggle** into **one dropdown**; **remove 3-dot menu** (or reduce items). |
| **Open questions** | 1) Dropdown lists bots + on/off in one control? 2) Where do **assign / mark unread / clear** go after ⋯ removed — header icons or only context menu? |
| **Effort** | **M** |

**Files:** `ChatHeader.tsx`, `BotPickerPopover.tsx`

---

## G — Notifications

### G1. Reduce notification popup size

| | |
|---|---|
| **Current** | **Bell dropdown:** `w-80` × `max-h-80` (`NotificationCenter.tsx`). **Inbox toasts:** `max-w-[360px]`. **In-thread notices:** `ChatNoticeStack` full-width cards. |
| **Requested** | **Smaller** notification popups. |
| **Open questions** | Which surface: **topbar bell**, **toast**, or **in-chat notice stack** (image 3 handoff banner)? Target width (e.g. 280px)? |
| **Effort** | **S** |

**Files:** `NotificationCenter.tsx`, `toast.tsx`, `ChatNoticeStack.tsx`

---

## H — Screenshot ↔ issue map

| Your screenshot | Likely code | Related items |
|-----------------|-------------|---------------|
| Inbox list + hover card on Aarti | `ConversationPreviewHover` | **C1, C2** |
| Context menu (Assign, Snooze, Export, AI bot) | `ChatContextMenu.tsx` | **D2, D5, F1** |
| Orange “With your team · Bot was not sure” + call pill | `MessageBubble` / call event messages / handoff | Not in your list — keep or simplify? |
| Search board + avatars | Possibly **Flows** or another module — **not inbox** | Confirm if in scope |

---

## I — Suggested implementation order (after approval)

1. **Quick wins (S):** C2 hover removal, C1 tooltip, D1 send icon, B6 connection menu, G1 notification size, B4 message performance format  
2. **Number/format pass:** B3 + B4 together  
3. **Inbox simplification:** C3 filters/tabs, D2 context menu, F1 bot dropdown  
4. **Panel trim:** E1 details/analytics, D4 campaigns, D3 payment  
5. **Dashboard:** B1 cards, B2 calendar (needs API clarity)  
6. **Global dialogs:** B5  
7. **Auth:** A1 (needs asset)  
8. **Snooze:** D5 (blocked on “replace with”)  

---

## J — Confirmation checklist (please reply)

Before any code, confirm each line:

- [ ] **A1** — New logo file path / design ready?  
- [ ] **B2** — Preset days vs custom calendar range?  
- [ ] **B3** — Counts only vs hide all rate metrics?  
- [ ] **C3** — Exact tabs: All | Favorites | Unread | Open | Changes?  
- [ ] **D2** — Minimal right-click item list?  
- [ ] **D3** — Payment link only or all URL interactive mode?  
- [ ] **D4** — Remove Reply tab or rename? Remove campaign button?  
- [ ] **D5** — Snooze replacement behavior?  
- [ ] **E1** — Kill whole right panel or only analytics/stats?  
- [ ] **F1** — Bot dropdown spec + where overflow actions go?  
- [ ] **G1** — Which notification UI to shrink?  
- [ ] Handoff banner / call pills in thread — change or keep?  

---

## K — Code index (primary files)

```
Login:        client/src/pages/LoginPage.tsx
              client/src/components/auth/AuthBrand.tsx

Dashboard:    client/src/pages/DashboardPage.tsx
              client/src/components/dashboard/LiveMetricsHero.tsx
              client/src/components/dashboard/MessagePerformanceDonut.tsx
              client/src/components/dashboard/WhatsAppConnectGuide.tsx
              client/src/components/dashboard/PreConnect*.tsx

Inbox:        client/src/pages/InboxPage.tsx
              client/src/components/inbox/InboxListHeader.tsx
              client/src/components/inbox/ConversationItem.tsx
              client/src/components/inbox/ChatContextMenu.tsx
              client/src/components/inbox/ChatComposer.tsx
              client/src/components/inbox/ChatHeader.tsx
              client/src/components/inbox/InboxDetailsPanel.tsx
              client/src/components/inbox/ComposerModeHeader.tsx

Dialogs:      client/src/components/ui/ConfirmDialog.tsx
              client/src/components/layout/AppTopbar.tsx

Notifications client/src/components/layout/NotificationCenter.tsx
              client/src/utils/toast.tsx
```

---

*Document created from codebase review — no implementation until sign-off on section J.*
