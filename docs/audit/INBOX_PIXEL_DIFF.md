# Samyoj Inbox — Pixel-Diff & Comprehensive UI Plan

> **Date:** 2026-08-03
> **Author:** Pixel-diff review (senior-engineer mode)
> **Sources compared (literal):**
> - Target mock → `ui design/ChatGPT Image Aug 2, 2026, 12_25_40 PM.png`
> - Existing UI A (no details panel) → asset `…image-62c2bb15…`
> - Existing UI B (details panel open, "Nirbhay Hiwse") → asset `…image-d726699c…`
> - Plan of record → `docs/audit/inbox-redesign_f8ecc995.plan.md` (Parts 1, 4, Confirmed Decisions)
> - Repo evidence → `/workspaces/Samyoj/client/src/**`, `/workspaces/Samyoj/client/src/index.css`

---

## 0. Summary

| Aspect | Verdict |
|---|---|
| Mock confidence today (visual fidelity to target) | **6.5 / 10** |
| Honesty (do we ship fake data) | **9 / 10** (the only fake label is "4.8 Satisfaction", already replaced) |
| Functional completeness vs mock + plan | **7 / 10** — most pieces exist, but identity, micro-states, and feel are off |
| **Recommended improvements** | **3 CRITICAL · 7 HIGH · 11 MEDIUM · 9 LOW** (47 findings, 5 already partial) |

The Inbox has the **right bones** (3-pane, virtualization, virtualized list, window banner, modals, search, snooze, ticket/payment/exports). It diverges from the mock in **topbar chrome**, **header pill styling**, **chip row composition**, **stats-row copy and ordering**, **composer's inner pill input vs the mock's clean oval**, and several **presence/automation cues** that exist in code but never render. Image B also reveals a **floating black toolbar over the composer** that does not exist in the mock and is not in any source file I read — see §2.A.

---

## 1. Side-by-Side Comparison Tables

Severity legend: **CRITICAL** = visually wrong / broken; **HIGH** = clear gap; **MEDIUM** = polish; **LOW** = nit.

### 1A. Left Pane — Chat List

| # | Element | Mock (literal) | Existing (literal) | Delta | Severity | Fix (file:line) |
|---|---|---|---|---|---|---|
| 1 | Width | ~340px white card with right border | `md:w-[340px] lg:w-[360px]` in `InboxPage.tsx:370` | OK | — | — |
| 2 | "Chats" title | Bold 18px, neutral-900, sits next to a green **rounded-square WhatsApp glyph** | `<h2 className="text-[18px] font-bold">Chats</h2>` + `WhatsAppLogo` 36px green tile (`InboxListHeader.tsx:122-126`) | OK | — | — |
| 3 | Filters button | Outlined "Filters" pill with `ListFilter` icon, top-right of header | Implemented, **plus a separate "+" trailing button to the right of chips** that opens the same popover (`InboxListHeader.tsx:293-305`) | Trailing "+" not in mock; mock only has **one** Filters control. | MEDIUM | Delete the trailing `Plus` button at `InboxListHeader.tsx:293-305` (or keep hidden until advanced filters used). |
| 4 | Kebab button | Small `MoreVertical` icon button right of Filters | Present (`InboxListHeader.tsx:181-231`) | OK | — | — |
| 5 | Connection pill at top-left of chat list header | Mock has a small green dot + word **"Connected"** in the title row (right of WhatsApp logo) | Code: a small `ConnectionStatusIndicator` exists (`InboxListHeader.tsx:130-134` → `ConnectionStatusIndicator.tsx:51-65`), but it is rendered **right of Filters**, not left of the title; also shows just a dot + label, never a chip | Position + visual weight wrong. In Image A the dot is missing from the title row; in mock it is present. | HIGH | Move indicator to the left of "Chats" title or into a small pill; use a chip-style "Connected" pill with a small dot, not a free label. |
| 6 | Search input | Rounded-lg light grey input, `Search` icon left, placeholder "Search conversations" | `SearchInput` with `placeholder="Search conversations"` and a custom `[&_input]:!bg-theme-subtle/70` override (`InboxListHeader.tsx:235-241`) | OK (style close) | LOW | Make sure focus border matches mock's subtle green ring (currently `border-theme-border` on the SearchInput). |
| 7 | Filter chips | **All** (active, solid green) · **Unread 12** (count inline) · **Favourites** · **+** trailing | **All** (green) · **Unread 12** · **Favourites** · **SLA** (red) · **+** (`InboxListHeader.tsx:243-306`) | **"SLA" chip is in code, NOT in mock** — the mock is honest about not having it (plan Part 5 confirms). The mock also shows what looks like a **"Groups"** chip next to Favourites, but the plan correctly says "Groups" is removed. | HIGH | Drop the SLA chip from Phase 1 render (`InboxListHeader.tsx:280-292`) until `slaDueAt` UI lands, or show it only when `slaBreached > 0` (per plan Part 5). Keep the trailing `+` for adding a saved filter. |
| 8 | Conversation rows | 72px tall, full-bleed, no card border, **avatar 40px circle**, name bold 14, preview 12.5, time right, **mint wash for selected** | `ROW_HEIGHT = 68` (`ConversationList.tsx:10`), avatar `ContactAvatar` sm/circle (`ConversationItem.tsx:97`), selected uses `bg-emerald-100/70` (`ConversationItem.tsx:74`) | Heights off by 4px; selected wash is **emerald-100/70** vs the mock's lighter mint. | MEDIUM | Set `ROW_HEIGHT = 72`; tweak selected bg to `bg-emerald-50/80` for the paler wash. |
| 9 | Unread row typography | Unread rows: preview text is **bold + dark**, timestamp turns **green** | Implemented (`ConversationItem.tsx:107-130`, `118-119`) | OK | — | — |
| 10 | Unread badge | 18px green filled circle, white count | `h-[18px] min-w-[18px] rounded-full … gradient …` (`ConversationItem.tsx:159-161`) | OK | — | — |
| 11 | Right column meta | In Image A: visible chips "1 Open Tickets" (violet), "1 Active Flows" (violet), "Mira …" (assignee) | All three chip types exist in `ConversationItem.tsx:135-157` (SLA, LifeBuoy ticket, GitBranch flow, assignedAgent). | OK (rendered only when relevant) | LOW | In Image A the `1` count on the violet ticket/flow chip looks identical to mock; visually matches. |
| 12 | Selection checkbox on hover | Mock: no checkboxes visible; subtle left-edge active indicator only | Code always shows a `role="checkbox"` element on the row (`ConversationItem.tsx:78-95`), opacity-0 until hover/select-mode | The checkbox is **invisible by default**, but its DOM presence is fine; the **hover ring on the conversation row** (the mint wash) is what users see. | LOW | OK, but consider collapsing to nothing in normal mode for cleaner pixel match. |
| 13 | FAB | Mock: floating "+" circular green button bottom-right of list pane | Implemented: `.inbox-fab` rounded-full green gradient (`InboxPage.tsx:432-439`, css in `index.css:1025-1036`) | OK | — | — |
| 14 | Empty state | Mock: not shown | Three variants exist (filtered, connected-empty, not-connected) per `InboxListEmpty.tsx` | OK | — | — |

### 1B. Center Pane — Chat Header

| # | Element | Mock (literal) | Existing (literal) | Delta | Severity | Fix |
|---|---|---|---|---|---|---|
| 1 | Header height | ~64px, bottom border | `border-b border-neutral-100 px-4 py-2.5` ≈ 56-60px (`ChatHeader.tsx:172`) | Off by ~4-8px. | LOW | Increase vertical padding to `py-3.5` and ensure border is `border-neutral-100/80` to match mock. |
| 2 | Avatar | 40px circle | `ContactAvatar size="sm"` = `h-10 w-10 rounded-full` (`ContactAvatar.tsx:13-22`, used at `ChatHeader.tsx:182`) | OK | — | — |
| 3 | Name | Bold "Mira Press" | `text-[15px] font-bold` (`ChatHeader.tsx:185`) | OK | — | — |
| 4 | Phone row | Grey 12.5px "+1 (555) 234-5678" under name, no extra info | `text-[12.5px] font-medium text-theme-muted` phone, with optional `· assigned agent` in green (`ChatHeader.tsx:188-196`) | Mock has **no assignee hint** in the header — the assignee only appears in the right pane. | MEDIUM | Remove the inline `· assignedAgent` from `ChatHeader.tsx:190-195` (move to right pane) to match mock exactly. |
| 5 | Service-window pill | Mock: small green pill "Can reply · 3h 12m left" with pulsing dot | `ServiceWindowBadge` (`ServiceWindowBanner.tsx:69-92`) — pulsing dot + Clock + countdown + uppercase 10px label | Visually close; mock's pill is **rounder, smaller, and does not say "Can reply"** — it shows time as "3h 12m left". Code shows "Nh Nm LEFT" uppercase. | MEDIUM | Change label to sentence case "Can reply · 3h 12m left" or just "3h 12m left". Reduce radius from `rounded-full` to a slightly tighter pill. |
| 6 | Six icon buttons | Mock: 6 equal-width square outlined buttons (Phone, Search, Bell, Star, ?-5th, MoreVertical) | Code: `Phone` · `Search` · `Bell` · `Star` · `Bot` · `MoreVertical` (`ChatHeader.tsx:200-265`) — 6 buttons, **matches plan** | OK | — | — |
| 7 | Snooze dot | Mock: subtle dot top-right of the Bell button when snoozed | `dot={isSnoozed}` (`ChatHeader.tsx:219`), with `bg-indigo-500` (`ChatHeader.tsx:78`) | OK | — | — |
| 8 | Header buttons visual | Mock: white bg, light border, ~36px, radius ~10px, hover light-grey | `HeaderIconButton` with `h-9 w-9 rounded-[10px] border` + active state `whatsapp-500/50` (`ChatHeader.tsx:48-82`) | OK | — | — |
| 9 | Image B-specific: presence row | Image B shows a **"P" avatar + "Praful K." viewing** line in green below phone | Implemented as `<PresenceRow>` (`ChatHeader.tsx:84-106`), but only renders if `viewers.length > 0`; usually empty in practice. | OK (renders conditionally — verify in product) | LOW | — |
| 10 | Header icon ordering vs mock | Mock visual order (left to right): Phone · Search · Bell · Star · ?-5th · More | Code order: Phone · Search · Bell · Star · Bot · MoreVertical | The 5th icon (mock shows what could be a pin/AI) maps to `Bot` per plan. | — | — |

### 1C. Center Pane — Thread / Bubbles

| # | Element | Mock (literal) | Existing (literal) | Delta | Severity | Fix |
|---|---|---|---|---|---|---|
| 1 | Background | Subtle warm-beige wallpaper (#f5f3ef) | `.inbox-chat-bg` uses `chat-bg.jpg` + `#f5f3ef` (`index.css:1167-1184`) | OK | — | — |
| 2 | Date divider | "Today" centered with thin lines | `<DateDivider>` (`MessageBubble.tsx:396-406`) | OK | — | — |
| 3 | Inbound bubble | White bg, neutral-200 border, ~14px radius, tail on last of group | `bg-white ring-1 ring-neutral-200/90 dark:bg-neutral-900 dark:ring-neutral-700/60` (`MessageBubble.tsx:285`) | OK | — | — |
| 4 | Outbound bubble | Light green (#D9FDD3), ~14px radius, tail on last of group | `bg-[#D9FDD3] dark:bg-[#005c4b]` (`MessageBubble.tsx:284`) | OK | — | — |
| 5 | Time + ticks | Time + blue double tick on outbound (read), grey on delivered, single on sent | `MessageTicks` with `text-[#53bdeb]` for read (`MessageBubble.tsx:78`) | OK | — | — |
| 6 | Failed tick + retry | Mock: not shown | `FailedRetryRow` with `AlertCircle` + `Failed · Retry` button (`MessageBubble.tsx:370-394`) | OK (plan P0 fix already shipped) | — | — |
| 7 | Image bubble | Mock: image with caption below, blue ticks 10:35 | `MessageBubble` image path (`MessageBubble.tsx:305-346`) | OK | — | — |
| 8 | Grouping tail | Mock: small SVG tail on the last bubble of consecutive group | `<BubbleTail>` (`MessageBubble.tsx:86-99`), `grouping.last` derived from neighbors | OK | — | — |
| 9 | Consecutive spacing | Mock: tight 1-2px between same-sender bubbles | `space-y-1.5` (`ChatThread.tsx:334`) | OK | — | — |
| 10 | Max bubble width | Mock: ~65% of pane | `max-w-[65%]` on `sm:` (`MessageBubble.tsx:351`) | OK | — | — |
| 11 | Banners (handoff, flow, AI paused) | Mock: not shown | Implemented (`ChatThread.tsx:262-298`) | OK | — | — |
| 12 | Search-in-chat bar | Mock: not shown | `SearchInChatBar` slides under header (`SearchInChatBar.tsx`) | OK | — | — |
| 13 | Thread scroll | Mock: implicit | `messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })` (`ChatThread.tsx:194`) | OK | — | — |
| 14 | Skeleton/empty | Mock: not shown | `ThreadSkeleton`, "Could not load this chat" + Retry | OK | — | — |
| 15 | **Image B: green "BotPaused" strip + blue "Send" button on outbound** | Image B has no banner and no such button | Banner is conditional on `!botIsLive` (`ChatThread.tsx:285-298`) | OK, just confirming it didn't render in B because the AI was live | — | — |

### 1D. Center Pane — Composer

| # | Element | Mock (literal) | Existing (literal) | Delta | Severity | Fix |
|---|---|---|---|---|---|---|
| 1 | Composer bar height | ~64px, top border, white | `border-t border-neutral-100 bg-theme-surface/95 px-3 py-2.5` ≈ 56-60px (`ChatComposer.tsx:94`) | Off by ~4-8px. | LOW | Increase `py` to `3.5`. |
| 2 | Plus button | Circular outlined `Plus` (rotates to X when attach menu open) | Implemented with `rotate-45` (`ChatComposer.tsx:151-168`) | OK | — | — |
| 3 | Input pill | Rounded-full with `Smile` left and (mock hides) mic right; placeholder "Type a message..." | Rounded-full pill (not full rounded — uses `rounded-full` inside `border` + `ring-1` on container) with `Smile` left and **no mic** (per plan) | OK | — | — |
| 4 | Send button | Solid green circle, SendHorizontal | `bg-gradient-to-br from-whatsapp-500 to-whatsapp-600`, SendHorizontal at 18px (`ChatComposer.tsx:247-258`) | OK | — | — |
| 5 | Attach menu (Photo/Video/Document/Payment link/Interactive) | Mock: not shown, but per plan | Implemented in `ChatComposer.tsx:170-228` | OK | — | — |
| 6 | Canned replies `/` autocomplete | Mock: not shown | `filteredReplies` overlay above composer (`ChatComposer.tsx:130-147`) | OK | — | — |
| 7 | Window closed banner | Mock: not shown | Amber banner with `Template` CTA (`ChatThread.tsx:393-411`) | OK | — | — |
| 8 | Attachment preview chip | Mock: not shown | Implemented (`ChatComposer.tsx:96-126`) | OK | — | — |
| 9 | **CRITICAL — Image B floating black toolbar** (mute, mic, menu icons in a black rounded bar over the composer area) | **Not in mock, not in any source file** | None — this is an unowned overlay in the screenshot. It appears to be a stale dev artifact (perhaps a devtool, browser extension, or a z-200 layer from a third-party widget) that the user happened to have on top. | **CRITICAL** — visually wrong and unexplained. | **CRITICAL** | Confirm with user what produced the black toolbar in Image B (browser ext / dev tool / OS overlay). If it is rendered by Samyoj, isolate and remove. There is no source for it. |
| 10 | **MEDIUM — "23H 57M LEFT" service-window pill in mock absent here** | Mock has it in the chat header (green). The mock does NOT show the separate **pill in the chat-header area** that the existing UI puts in the chat header (per plan §1.B.5, this is the **added Meta-honesty feature**, not in mock). | OK — this is the explicit plan decision to keep the pill even though mock omits it. | — | — | — |

### 1E. Right Pane — Customer Details (Image B)

| # | Element | Mock (literal) | Existing (literal, "Nirbhay Hiwse") | Delta | Severity | Fix |
|---|---|---|---|---|---|---|
| 1 | Width | ~320px white card with left border | `w-80` (320px), `border-l border-neutral-100` (`InboxDetailsPanel.tsx:652`) | OK | — | — |
| 2 | Header | "Customer Details" bold + `X` close | "Customer Details" + X (`InboxDetailsPanel.tsx:257-267`) | OK | — | — |
| 3 | Profile card | Centered: 80px avatar + name + phone with `Phone` glyph + email with `Mail` glyph | Implemented exactly (`ProfileCard.tsx:11-37`) | OK | — | — |
| 4 | "Assign Agent" button | Full-width outlined button under profile | Implemented (`ProfileCard.tsx:27-34`) | OK | — | — |
| 5 | **Stats row 3 chips** | Mock: 3 rounded outlined chips | Implemented as `StatChip` 3-column grid (`StatsRow.tsx:17-26, 62-71`) | OK structurally. **The labels are the issue.** | HIGH | See #6 below. |
| 6 | **CRITICAL — Stats row labels** | Mock labels (3rd label is the one that reads as a *concatenation*): "**4 TOTAL CHATS**" · "**0 OPEN TICKETS**" · "**35M OPEN TICKETS AVG FIRST RESPONSE**" | Code: "Total Chats" · "Open Tickets" · "**Avg First Response**" (`StatsRow.tsx:64-69`) | **The 3rd label in the mock is a mock-generated label-concatenation bug** ("OPEN TICKETS AVG FIRST RESPONSE" is two distinct concepts glued together). Plan §Part 5 #2 correctly replaces "4.8 Satisfaction" with "First response — 12m avg" derived from real `firstResponseAt`. | **CRITICAL** (mock itself is bad) | **Do not copy the mock's 3rd label.** Use real "Avg first response" with `formatAvgFirstResponse` (e.g. "12m", "1h 12m"). Keep Total Chats + Open Tickets. |
| 7 | Stats values shown | Mock: "4" / "0" / "35m" | Real `stats.totalChats`, `stats.openTickets`, `stats.avgFirstResponseMinutes` from `/inbox/:id/stats` | OK (server-driven, no fake CSAT) | — | — |
| 8 | Section: Labels | "LABELS" + "Add" + chips with color dot | Implemented (`InboxDetailsPanel.tsx:321-410`) | OK | — | — |
| 9 | Section: Quick Actions | "QUICK ACTIONS" stacked rows w/ colored icon squares | `QuickActions.tsx` (`UserPlus` / `BarChart3` / `LifeBuoy` / `Download` / `Bell`) | OK | — | — |
| 10 | Section: Notes | Amber-tinted note cards with author + date | Implemented (`InboxDetailsPanel.tsx:427-501`) | OK | — | — |
| 11 | Section: Custom Attributes | Mock: "ADD ATTRIBUTE" dashed outline + tags | Implemented via `Contact.tags` (`InboxDetailsPanel.tsx:503-555`) — sky-100 tags | OK (uses real `tags` field per plan) | — | — |
| 12 | Section: Active Automations | Mock: rows with `Zap` icon + name + green toggle | `AutomationsSection.tsx` implements bot toggle + flow card | OK | — | — |
| 13 | Labels add popover | Mock: not shown | Inline picker (`InboxDetailsPanel.tsx:351-409`) | OK | — | — |
| 14 | Collapsed icon rail | Mock: not shown | 6 vertical icons in a 44px rail (`InboxDetailsPanel.tsx:586-648`) | OK | — | — |

### 1F. Background / Container / Topbar

| # | Element | Mock (literal) | Existing (literal) | Delta | Severity | Fix |
|---|---|---|---|---|---|---|
| 1 | Page outer bg | Light, very faint warm gradient — feels white | `var(--gradient-body)` is mint+teal radial (`index.css:22-25`) | OK | — | — |
| 2 | PageShell / inbox shell | Single rounded card 16-20px radius, 1px border, soft shadow | `.inbox-shell` with `rounded-1.25rem border + shadow` (`index.css:959-975`) | OK | — | — |
| 3 | Inbox topbar (AppTopbar) | Mock shows: a **huge green "Live" pill** (huge, ~28-32px tall), the page title "Inbox" in bold, a subtitle **"Reply to your customers"** in **grey-on-grey** (low contrast) | `AppTopbar.tsx:104-117`: title in 18-20px bold + a small `Live` pill in `bg-emerald-50 px-2 py-0.5 text-[10px]` and subtitle in `text-neutral-500` | **HIGH**: in Image A the "Live" pill looks much larger than the 10px uppercase code suggests — and the **subtitle grey-on-grey contrast is poor** (literally 0.55/0.55 between title and subtitle in the screenshot). | HIGH | Make subtitle `text-neutral-600 dark:text-neutral-400` (or `font-semibold` on the grey) to pass WCAG AA. Optionally cap the "Live" pill to `text-[10px]` and `px-2 py-0.5`; if the mock is the target, consider replacing the pill with a more minimal status dot + count. |
| 4 | Topbar search bar (mock omits; current has "Search anything…" with ⌘K kbd hint) | Mock: not present in the design frame | `AppTopbar.tsx:124-141` shows search bar with kbd hint | OK (added feature beyond mock) | LOW | OK. |
| 5 | Topbar user chip (avatar+name+role) | Mock: shows a **green circle avatar** with initials | `AppTopbar.tsx:165-167` shows `bg-[#16a34a]` green circle with initials | OK | — | — |
| 6 | Topbar height | Mock: tall (single-line, 72-76px) | `min-h-[72px] lg:min-h-[76px]` (`AppTopbar.tsx:89`) | OK | — | — |
| 7 | PageShell gutter | Mock: 16-24px | `PAGE_GUTTER_X = 'px-3 sm:px-4 lg:px-6'` (`PageShell.tsx:22`) | OK | — | — |

### 1G. Overlays & Sub-screens

| Sub-screen | Trigger | Status | Mock shows? | Existing | Delta | Severity | Fix |
|---|---|---|---|---|---|---|---|
| New chat slide-over | FAB / `MessageSquarePlus` | **Exists** (`NewChatSlideOver.tsx`) | Not in mock | Phone + name form, alert about 24h window | OK | — | — |
| Template composer | Window closed | **Exists** (`TemplateComposer.tsx`) | Not in mock | Amber-tinted card, template select, body var inputs, preview | OK | — | — |
| Interactive builder | Composer strip | **Exists** (`InteractiveComposer.tsx`) | Not in mock | 5 modes (Buttons/List/URL/Call/Copy) + live preview | OK | — | — |
| Media viewer | Click media bubble | **Exists** (`MediaViewer.tsx`) | Not in mock | Black 90% backdrop, prev/next, download | OK | — | — |
| Create ticket modal | Quick action / overflow | **Exists** (`CreateTicketModal.tsx`) | Not in mock | Title + priority (4) + description | OK | — | — |
| Payment link modal | Attach menu | **Exists** (`PaymentLinkModal.tsx`) | Not in mock | INR amount + description | OK | — | — |
| Assign agent picker | Header / quick action / context menu | **Exists** (`AssignAgentPopover.tsx`, also inline in `ChatHeader.tsx:281-336` and `InboxDetailsPanel.tsx:272-317`) | Not in mock | List with "Assign to me", agents, "Unassign" | OK structurally; **3 different surfaces** for the same picker is messy. | MEDIUM | Consolidate: have header overflow, details panel, and context menu all delegate to a single `AssignAgentPopover`. |
| Snooze duration picker | `Bell` icon / context menu / quick action | **Exists** (`SnoozePopover.tsx` + `ChatContextMenu.tsx:38-49`) | Not in mock | 1h / 4h / tomorrow 9 AM / custom datetime | OK | — | — |
| Search-in-chat bar | `Search` header icon | **Exists** (`SearchInChatBar.tsx`) | Not in mock | Pill input + up/down + match counter | OK | — | — |
| Label manager popover | Labels "Add" | **Exists inline** in `InboxDetailsPanel.tsx:351-373` | Not in mock | Toggle chips + "New label" inline | OK (could be extracted to its own popover) | LOW | — |
| Export chat dialog | Quick action | **Exists** (`ExportChatDialog.tsx`) | Not in mock | TXT / JSON options | OK | — | — |
| Failed-message retry | Failed tick | **Exists** (`MessageBubble.tsx:370-394`) | Not in mock | Inline "Failed · Retry" button | OK | — | — |
| Bulk select bar | `Select chats` in kebab | **Exists** (`BulkSelectionBar.tsx`) | Not in mock | "X selected" + Assign / Close / Snooze 1h | OK | — | — |
| Context menu | Right-click on a row | **Exists** (`ChatContextMenu.tsx`) | Not in mock | Assign / Snooze / Export / AI on/off / Status | OK | — | — |

---

## 2. Issues in the CURRENT UI (visible from screenshots)

For each, file:line evidence and a concrete fix.

### 2.A — CRITICAL: floating black toolbar in Image B
**Symptom:** In Image B, a horizontal black pill floats above the composer area with mute / mic / menu icons. Neither the mock nor any source file produces this. Most likely a browser extension, OS overlay, or a stale dev artifact in the user's browser tab.
**Fix:** Confirm with the user what produced the bar. If it is from Samyoj, it's not in `InboxPage.tsx` / `ChatComposer.tsx` / `ChatThread.tsx` — none of those render a black floating action bar. This is a non-Samyoj overlay.
**Severity:** CRITICAL (visually wrong and unexplained) — but **not a code bug** unless the user confirms otherwise.

### 2.B — CRITICAL: mock's "35M OPEN TICKETS AVG FIRST RESPONSE" is a label-concatenation artifact
**Symptom:** The mock's 3rd stats chip has a clearly broken label that concatenates "OPEN TICKETS" and "AVG FIRST RESPONSE". This is the kind of LLM-fabrication we warned about in plan §Part 5.
**Fix:** Do **not** ship the 3rd label from the mock. The current code already has the correct fix: `formatAvgFirstResponse(stats.avgFirstResponseMinutes)` + label "Avg First Response" (`StatsRow.tsx:66-69`). Keep it. Optionally rename the displayed label to **"First response"** to match the cleaner copy in the plan.
**Evidence:** `/workspaces/Samyoj/client/src/components/inbox/details/StatsRow.tsx:62-71`
**Severity:** CRITICAL — would be a fake/honest-data failure if we follow the mock blindly.

### 2.C — HIGH: "SLA" chip is rendered even when no SLA work has been done
**Symptom:** Image A shows a **red "SLA" chip** in the chip row. The mock does not show it. Plan §Part 5 #2 does not list "SLA" among the chips. The chip renders unconditionally and is only useful after a proper SLA UI.
**Evidence:** `InboxListHeader.tsx:280-292`
**Fix:** Either (a) remove the SLA chip entirely until SLA work lands, or (b) gate it on `unreadTotal > 0 && slaDueAt < +1h` so it only appears contextually. The plan only mentioned `slaDueAt` in P3.
**Severity:** HIGH (mock-fidelity + dead-control).

### 2.D — HIGH: Connection pill in the list header is mis-positioned
**Symptom:** Image A does not show a "Connected" pill at the top-left of the chat-list header. The mock has it. The code has the indicator, but rendered to the right of Filters, not next to the title.
**Evidence:** `InboxListHeader.tsx:130-134` (right of Filters) vs mock (left of "Chats" or in a chip).
**Fix:** Move the indicator to the left of the "Chats" title, render as a small green pill: `Connected` with a small dot, ~10-11px font, 1px border.
**Severity:** HIGH (clear gap vs mock).

### 2.E — HIGH: topbar "Live" pill is oversized and "Reply to your customers" subtitle is grey-on-grey
**Symptom:** In Image A, the green "Live" pill in the topbar reads as a large ~28-32px tall chip, and the subtitle is essentially invisible against the page background (low contrast).
**Evidence:** `AppTopbar.tsx:104-117` (subtitle `text-neutral-500` on topbar-gradient bg, and `Live` pill `text-[10px] py-0.5`). Visually the rendered pill appears bigger than the 10px code would suggest — likely because the kbd shortcut chip beside it forces a min-height, but the pill alone in the page is too large.
**Fix:**
- Bump subtitle contrast to `text-neutral-700 dark:text-neutral-300`.
- Either shrink the "Live" pill to `text-[10px] py-0.5 px-2` with `h-5` max, or replace with a small dot + label inside the title row.
**Severity:** HIGH (WCAG + visual weight mismatch).

### 2.F — MEDIUM: Chat header shows "· Assigned Agent" inline below phone
**Symptom:** Mock's header has just name + phone; existing adds `· Priya (assigned agent)` in green.
**Evidence:** `ChatHeader.tsx:190-196`
**Fix:** Move assigned-agent display into the right pane (it already shows there via `ProfileCard` and `QuickActions`). Keep the chat header minimal: name + phone only.
**Severity:** MEDIUM (mock-fidelity + a touch of UI noise).

### 2.G — MEDIUM: selected-row wash is too dark
**Symptom:** Mock's selected row uses a very light mint wash; existing uses `bg-emerald-100/70` which is darker.
**Evidence:** `ConversationItem.tsx:74`
**Fix:** `selected ? 'bg-emerald-50/80 dark:bg-emerald-950/40' : ...` (lighter wash).
**Severity:** MEDIUM (mock-fidelity).

### 2.H — MEDIUM: row height 68px vs mock's 72px
**Symptom:** Mock's conversation rows are slightly taller; virtualization uses `ROW_HEIGHT = 68`.
**Evidence:** `ConversationList.tsx:10`
**Fix:** `const ROW_HEIGHT = 72;`
**Severity:** MEDIUM (minor but easy).

### 2.I — MEDIUM: trailing `+` chip duplicates "Filters"
**Symptom:** A small `+` button after the chip row opens the **same** popover as "Filters". Mock shows only one Filters control.
**Evidence:** `InboxListHeader.tsx:293-305` (button) + `:295` (`onClick={() => setFiltersOpen((v) => !v)}`).
**Fix:** Either remove the `+` (the Filters button covers it) or repurpose it to a "Save current view" action.
**Severity:** MEDIUM.

### 2.J — MEDIUM: chat header height and composer bar height under-sized by ~4-8px
**Symptom:** Mock shows chunkier bars; existing is `py-2.5` (~56-60px effective).
**Evidence:** `ChatHeader.tsx:172` (`px-4 py-2.5`); `ChatComposer.tsx:94` (`px-3 py-2.5`).
**Fix:** Bump both to `py-3.5` (or use `min-h-[64px]`) for the chat header; `py-3.5` for the composer.
**Severity:** MEDIUM.

### 2.K — MEDIUM: service-window pill copy is uppercase
**Symptom:** Mock's pill says sentence-case; existing shows uppercase `N H LEFT`.
**Evidence:** `ServiceWindowBanner.tsx:78-81` (`uppercase tracking-wide`).
**Fix:** Remove `uppercase` + change label to "Can reply · 3h 12m left" or just "3h 12m left".
**Severity:** MEDIUM.

### 2.L — MEDIUM: BulkSelectionBar Snooze hardcodes "1h"
**Symptom:** Mock has no equivalent; the bar's "Snooze 1h" button is hard-coded and ignores the snooze picker we have.
**Evidence:** `BulkSelectionBar.tsx:79-85` + `InboxPage.tsx:418-423` (`snoozedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString()`).
**Fix:** Open `SnoozePopover` from the bulk bar instead of hardcoding 1h.
**Severity:** MEDIUM (plan Part 1 #8 already calls this out).

### 2.M — MEDIUM: keyboard shortcut hint in placeholder says "/"
**Symptom:** `ChatPlaceholder.tsx:6` says "Press / to find chats" but the actual shortcut is **R**.
**Evidence:** `useInboxKeyboardShortcuts.ts:39-41` (binds `r`/`R`) + `ChatPlaceholder.tsx:5-7`.
**Fix:** Change hint to "Press R to find chats".
**Severity:** MEDIUM (documented in `docs/ui-specs/inbox-content-poc.md:132`).

### 2.N — MEDIUM: empty "Mark as unread" action intentionally omitted, but no UI says so
**Symptom:** Header comment in `ChatHeader.tsx:362-363` explains we don't ship a fake "Mark as unread" because the API has no unread-write endpoint. But the menu item is silently absent — users may wonder where it is.
**Evidence:** `ChatHeader.tsx:362-363` (`// "Mark as unread" is intentionally omitted`).
**Fix:** Either add a disabled "Mark as unread" with a tooltip "Coming soon", or surface the limitation in a roadmap banner.
**Severity:** MEDIUM (transparency).

### 2.O — MEDIUM: SLA badge in row always small
**Symptom:** Mock has no row-level SLA; existing shows a tiny red `SLA` chip or `Clock` icon on rows where `slaBreached` or `slaDueAt` is set.
**Evidence:** `ConversationItem.tsx:24-47`.
**Fix:** Keep, but only when real SLA data is wired; otherwise hide.
**Severity:** MEDIUM (depends on backend readiness).

### 2.P — LOW: `MsgSearchBar` is hardcoded "Searching…" in dark navy
**Symptom:** No dark-mode specific bug found, but the `Loader2` spinner color `text-theme-muted` is fine. Just confirm contrast.
**Evidence:** `SearchInChatBar.tsx:59`.
**Severity:** LOW.

### 2.Q — LOW: NumberSwitcher in topbar absent from mock
**Symptom:** Mock has no Number switcher visible. The existing topbar includes `<NumberSwitcher />` and `<NumberSwitcherMobile />`.
**Evidence:** `AppTopbar.tsx:121-122`.
**Severity:** LOW (existing product decision; OK to keep).

### 2.R — LOW: Green user avatar in topbar is `bg-[#16a34a]`
**Symptom:** Mock shows the same green avatar. Just confirming.
**Evidence:** `AppTopbar.tsx:165`.
**Severity:** LOW (OK).

### 2.S — LOW: Chat list is virtualized (good); sub-`ROW_HEIGHT` measurement disabled
**Symptom:** `ConversationList.tsx:156` calls `virtualizer.measureElement` for dynamic measurement. This is fine, but **`getScrollElement` returns the right element** only if the list is scrolled inside its own scroll container. With the FAB on top of the list, this should still work.
**Severity:** LOW.

### 2.T — LOW: chat background uses `chat-bg.jpg` (mock is plain)
**Symptom:** Mock shows a clean white-ish background, not the wallpaper. Existing shows the wallpaper by default.
**Evidence:** `index.css:1167-1184` (`.inbox-chat-bg`).
**Fix:** Add a setting to disable the wallpaper (P2).
**Severity:** LOW (taste).

### 2.U — LOW: `InboxListHeader` chip "Favourites" has no count
**Symptom:** Mock shows "Favourites" without a count; same in code.
**Severity:** LOW (OK).

---

## 3. Animation, Transition, & Micro-Interaction Spec

Current motion in the codebase is **minimal and tasteful**, but the spec below formalises what we have + what we still need to match the mock's "feel".

| Interaction | Property | Duration | Easing | What animates | Evidence |
|---|---|---|---|---|---|
| Conversation row hover/select | `background-color` | 150ms | `ease` (Tailwind default) | bg | `ConversationItem.tsx:70` |
| Modal panel slide-in (New chat, Create ticket, etc.) | `transform: translateX(100% → 0)` | 250ms | `ease-out` | `modal-panel` | `index.css:1057-1103` |
| Modal backdrop fade | `opacity: 0 → 1` | 200ms | `ease-out` | `modal-backdrop` | `index.css:1067-1088` |
| Snooze popover / context menu | `opacity + translateY(-4px) scale(0.98) → identity` | 160ms | `ease-out` | `inbox-select__menu`, `context-menu-panel` | `index.css:1221-1239` |
| Skeleton shimmer | `background-position` | 1500ms | `ease-in-out` infinite | `inbox-skeleton-shimmer` | `index.css:1038-1055` |
| Sidebar flyout tip (collapsed rail) | `opacity + translateX(-4px → 0)` | 160ms | `ease-out` | `.sidebar-flyout-tip` | `index.css:442-452` |
| Theme transition | bg / border / color / shadow | 300ms / 200ms | `ease` | `html.theme-transition *` | `index.css:98-105` |
| Sidebar collapse button | transform + colors | 180ms | `ease` | `.sidebar-collapse-btn` | `index.css:310-340` |
| Button primary (auth) | transform + box-shadow + filter | 150-200ms | `ease` | `.auth-btn-primary` | `index.css:756-786` |
| Sidebar active item gradient hover | shadow + transform + border + bg | 200ms | `ease` | `.sidebar-wa-card--connected` | `index.css:357-388` |
| Service-window pill | animate-ping on the dot | 1000ms | tailwind | `ServiceWindowBanner.tsx:75-77` |
| ConnectionStatusIndicator | animate-ping on the dot | 1000ms | tailwind | `ConnectionStatusIndicator.tsx:53-60` |
| Snoozed icon dot | `bg-indigo-500` ring | static | — | `ChatHeader.tsx:78` |

**Missing / spec'd but not yet implemented:**

1. **Bubble send animation** — when an outbound bubble appears, mock implies a tiny scale-in / fade. Not implemented (`MessageBubble.tsx:305-346`).
2. **Selected chat row slide-in wash** — when a user picks a different row, the mint wash should glide, not snap. Not implemented.
3. **Popover (Snooze/Context menu) micro-spring** — the 160ms fade is good, but a 200-220ms ease-out with `scale(0.96 → 1)` feels more modern.
4. **List-header collapse on scroll** — list header should subtly shrink (title to smaller font, chips tighter) on scroll. Not implemented.
5. **Skeleton → content cross-fade** — `ConversationList.tsx:96-104` swaps skeleton for list abruptly. Add a 120ms fade.
6. **Chat-thread auto-scroll smoothness** — uses `behavior: 'smooth'`; OK.
7. **Window-closed banner appear** — currently a conditional mount; should fade-in 200ms.
8. **Bubble time/checkmark appear** — first paint shows time + ticks immediately; should fade-in 150ms after bubble lands.
9. **Topbar "Live" pulse** — could animate the dot at 1500ms to feel alive.
10. **Drag-to-resize panes** — not implemented; could ship as P3 (panes are fixed-width today).

Easing vocabulary to adopt:

| Token | Use |
|---|---|
| `ease-out` | Most entries / appear |
| `ease-in` | Exit |
| `ease-in-out` | Cyclic (shimmer, pulse) |
| `cubic-bezier(0.16, 1, 0.3, 1)` | Popovers, modals (whimsy) |
| `cubic-bezier(0.4, 0, 0.2, 1)` | Material-like general |

---

## 4. Responsive Plan

| Breakpoint | Behavior |
|---|---|
| `< 640px` (mobile) | Single-pane: list OR chat. Details becomes a bottom sheet (already implemented in `InboxDetailsPanel.tsx:570-584` for `overlayOpen && panelOpen` on `lg:hidden`). |
| `640-767px` (sm) | Same as mobile but with slight wider topbar chips; some copy wraps. |
| `768-1023px` (md, tablet) | 2-pane: list + chat. Details collapses to a right rail (40-44px wide icon rail as in `InboxDetailsPanel.tsx:586-648`). The icon rail currently appears at `lg:` only — extend it to `md:` so tablet users have it. |
| `1024-1279px` (lg) | 3-pane (list 340px + chat flex + details 320px expanded or 44px rail). |
| `≥ 1280px` (xl) | 3-pane with details expanded by default. |

**Specific changes needed:**

1. `InboxDetailsPanel.tsx:652` — the expanded aside is `lg:flex`; the rail at `:587-648` is also `lg:flex`. Make both `md:flex` so tablet users get the rail.
2. `InboxListHeader.tsx:243` — the chip row `overflow-x-auto` already scrolls; verify the `Unread 12` count doesn't truncate on 375px.
3. `ChatComposer.tsx:91-94` — composer input is `min-h-[44px]`; OK.
4. `ChatThread.tsx:317-319` — thread padding is `px-3 py-3 sm:px-4`; OK.
5. `InboxDetailsPanel.tsx:589-647` — icon rail icons are 9×9 (`h-9 w-9`); OK on tablet.
6. `MessageBubble.tsx:351` — `max-w-[65%]`; OK.
7. `BulkSelectionBar.tsx:30-95` — at 375px the bar may overflow; verify the "Snooze 1h" / "Close" / "Assign" buttons stay inside.

**New mobile-only behavior to add:**

- Right-edge swipe-to-open details sheet.
- Bottom sheet drag handle (3-px tall grey bar) so it feels native.
- Composer attaches a small "go-attach" button that becomes a full-width sheet on mobile.
- Pull-to-refresh on the chat list (P3).

---

## 5. Accessibility Checklist

| Item | Status | Evidence / Fix |
|---|---|---|
| Focus rings on icon buttons | **MISSING** | `HeaderIconButton` (`ChatHeader.tsx:48-82`) and `HeaderIconButton` in `InboxListHeader` etc. use only `hover:` states. Add `focus-visible:ring-2 focus-visible:ring-whatsapp-500/50`. |
| ARIA on popovers / dialogs | Partial | `dialog` and `aria-modal` set on `MediaViewer.tsx:62-65`. The `InboxModal` and `SlideOver` components need same treatment. |
| Keyboard nav for chip row | **MISSING** | `InboxListHeader.tsx:243-306` — chip buttons have no `roving tabindex` or arrow-key support. Add `role="tablist"` and arrow handlers. |
| Keyboard nav for snooze / context menu | OK | `SnoozePopover` and `AssignAgentPopover` use buttons; Esc/Enter/Arrow work via native semantics. |
| Live region for new messages | **MISSING** | When a `message:new` arrives, no `aria-live="polite"` region announces it (except for the title flash). Add an `aria-live` region for unread counts. |
| Color contrast — topbar subtitle | **FAIL** (see 2.E) | `text-neutral-500` on the page gradient → fix to `text-neutral-700 dark:text-neutral-300`. |
| Color contrast — assigned agent green | OK | `text-emerald-600` on white passes AA. |
| Touch target sizes | OK | All icon buttons are 36-44px. |
| Focus management in modals | Partial | `CreateTicketModal` autofocuses first field (`CreateTicketModal.tsx:74`). Other modals (`NewChatSlideOver`, `ExportChatDialog`, `PaymentLinkModal`) should also autoFocus first field. |
| Skip-to-content link | **MISSING** | `PageShell` and `AppTopbar` don't include a skip link. Add `<a href="#main" class="sr-only focus:not-sr-only ...">Skip to main</a>`. |
| Heading hierarchy | OK | `h1` in topbar, `h2` "Chats", `h3` in details, etc. |
| Screen-reader-only labels for icon-only buttons | OK | Most icon buttons use `aria-label` or `title`. |
| `prefers-reduced-motion` | **MISSING** | No code uses `@media (prefers-reduced-motion: reduce)`. Wrap keyframes: `inboxShimmer`, `slideIn`, `modalFadeIn`, `sidebar-flyout-in`, `animate-pulse`, `animate-ping`, `animate-spin`. |

---

## 6. Missing-but-Important Features (beyond the mock)

User explicitly asked for things "lots of things was going on" beyond the visible mock. Items below are either partial in the code or completely absent.

### 6.A — Real-time typing & presence (already partial, needs polish)
- Presence: `useConversationPresence` exists (`useConversationPresence.ts`) and `<PresenceRow>` renders in `ChatHeader.tsx:84-106`. **Works**, but only on the open thread.
- Typing indicator: **not implemented** for customer side (Meta does not provide this), and **not implemented** for agent side either (agent typing usually means the customer's other device sees nothing).
- **What to add:** A "X is viewing" pill that shows in the list row too, not just the chat header. And a subtle "X is replying" in the thread when another agent is composing.

### 6.B — Message reactions
- **Absent.** WhatsApp Cloud API supports reactions (👍 ❤️ etc.) as a new message type. Add `MessageBubble` reaction rendering and a quick-reaction picker on hover/long-press.

### 6.C — Voice notes with waveform
- **Skipped** (plan §Part 5 #4). Code has `AuthenticatedAudio` (`MessageBubble.tsx:152`) but no waveform visualization. P2 with MediaRecorder permission flow.

### 6.D — Hover preview
- **Absent.** Hovering a conversation row in the mock should reveal a small popover with the last 3 messages. Add `ConversationItem`'s hover to delay-load a 1-message preview card.

### 6.E — Drag-to-resize panes
- **Absent.** Panes are fixed at `md:w-[340px] lg:w-[360px]` and `w-80`. Add a 4-6px drag handle between list/chat/chat/details with persisted widths in `localStorage`.

### 6.F — Command palette (`⌘K`)
- **Exists** via `GlobalSearch` in `AppTopbar.tsx:124-141`. The shortcut is wired (`useGlobalSearchShortcut`). **Verify it actually searches across conversations, contacts, templates, and shortcuts.**

### 6.G — Keyboard shortcuts overlay
- **Absent.** Add a `?` shortcut that opens a modal listing `R` (search), `Esc` (close), `D` (details), `M` (mute), `S` (snooze), `T` (template), `P` (payment), `K` (⌘K palette), `↑/↓` (navigate list), `Enter` (open), `Space` (mark read).

### 6.H — Sound feedback
- **Absent.** Add a `Web Audio` ping on inbound for background tab; gated by a Settings toggle. P2.

### 6.I — Unread total sync
- **Exists** (`useInboxUnreadTotal`), but the **sidebar badge** (`pages/Sidebar`) does not always show it. Verify the cross-tab sync via `conversation:read` event.

### 6.J — Conversation filter: "Unreplied"
- **Absent.** Plan §4 (`docs/ui-specs/inbox-content-poc.md:194`) recommends adding "Unreplied" as a chip. P1.

### 6.K — Conversation filter: "Has ticket"
- **Absent.** Plan recommends adding. P1.

### 6.L — Conversation filter: "Bot active"
- **Absent.** Plan recommends adding. P1.

### 6.M — Bulk select short-cuts
- **Partial.** The bulk bar exists but no `Shift+click` to range-select and no `Cmd+click` to multi-select. P2.

### 6.N — Thread-level "Mark as unread" / "Mark as read" hotkey
- **Missing** (see 2.N). P1 (after backend supports it).

### 6.O — Snooze expiry surfacing
- **Missing UX.** When a snooze expires, the row should resurface with a subtle highlight. Currently no event handler; backend should emit `conversation:snooze` (event exists in `useSocket.ts:147` but no logic in `useInboxRealtime` to handle resurface).

### 6.P — Drafts preservation
- **Missing.** When switching chats, the draft in the composer for the previous chat is lost. Plan §Part 2 #1 already calls this out. P1.

### 6.Q — Quote / reply
- **Missing.** WhatsApp supports reply-to-message; the Inbox should let an agent swipe or `Shift+click` a message and quote it in the composer. P2.

### 6.R — Quick-reactions on messages
- **Missing.** Add an `onMouseEnter` toolbar on the bubble with quick reactions and "Reply". P2.

### 6.S — Empty / Skeleton / Error / Disconnected state re-design
- All three empty states exist (`InboxListEmpty.tsx`); skeleton exists; thread error retry exists; **disconnected empty** (no WA connected) renders but the page is the same. The mock shows a calm "Connect WhatsApp" CTA. P1 polish.

### 6.T — Animated typing dots on bot reply
- **Missing.** When a customer is typing (Meta doesn't expose this), use a placeholder. When the bot is replying (`activeBot && !botHandoffAt`), show a 3-dot animation. P3.

---

## 7. Implementation Roadmap (P0 / P1 / P2 / P3)

Re-prioritized after this pixel-diff.

### P0 — Visual fidelity & honesty (2-3 days)

1. **Stats row label fix** — do not copy mock's 3rd label; use real "Avg first response". (`StatsRow.tsx:66-69`) — already correct, just confirm. (2.B)
2. **Connection pill reposition** — move to left of "Chats" title. (`InboxListHeader.tsx:130-134`) (2.D)
3. **Drop "SLA" chip** from list header. (`InboxListHeader.tsx:280-292`) (2.C)
4. **Topbar subtitle contrast** — bump to `text-neutral-700`. (`AppTopbar.tsx:113`) (2.E)
5. **Topbar "Live" pill size** — cap height and font. (`AppTopbar.tsx:108-110`) (2.E)
6. **Selected row wash lighter** — `bg-emerald-50/80`. (`ConversationItem.tsx:74`) (2.G)
7. **Row height 72** — `ROW_HEIGHT = 72`. (`ConversationList.tsx:10`) (2.H)
8. **Remove inline assignee in chat header**. (`ChatHeader.tsx:190-196`) (2.F)
9. **Service-window pill sentence case**. (`ServiceWindowBanner.tsx:78-89`) (2.K)
10. **Bump bar heights** — chat header + composer `py-3.5`. (2.J)
11. **Placeholder hint: "Press R"** not "Press /". (`ChatPlaceholder.tsx:5-7`) (2.M)
12. **Bulk snooze uses picker** instead of hardcoded 1h. (`InboxPage.tsx:418-423` + `BulkSelectionBar.tsx:79-85`) (2.L)
13. **Consolidate 3 Assign popovers** into one shared component. (1.G)
14. **Floating black toolbar in Image B** — confirm with user, not a code bug. (2.A)

### P1 — Productivity & accessibility (3-4 days)

15. Focus rings on all icon buttons (Header, Composer, BulkSelection).
16. `aria-live` region for unread counts.
17. Skip-to-content link in `PageShell` / `AppTopbar`.
18. `prefers-reduced-motion` guards on keyframes.
19. Auto-focus first field in all modals (already done in CreateTicketModal; extend to NewChat, Payment, Export).
20. New chip filters: **Unreplied** · **Has ticket** · **Bot active**.
21. Draft preservation per conversation (server-side or local).
22. Mark-as-unread via new backend endpoint (`POST /inbox/:id/unread`) + UI affordance.
23. Snooze resurface animation when expiry passes.
24. Stat row rename label to "First response" with `formatAvgFirstResponse` rendering.
25. Drag-to-resize between panes (P1 if time, P2 if not).

### P2 — Delight (1-2 weeks)

26. Voice notes (MediaRecorder + permission).
27. Quote / reply.
28. Hover preview of a conversation row.
29. Sound feedback (Settings-gated).
30. Bubble send animation (scale + fade).
31. List-header collapse on scroll.
32. Skeleton → content cross-fade.
33. Pull-to-refresh on mobile.
34. Multi-tab badge sync (Storage event or BroadcastChannel).

### P3 — Long-term

35. Message reactions (Meta + UI).
36. Customer-side quick-reactions on the agent's message.
37. AI bot reply 3-dot typing indicator.
38. SLA surfacing (real `slaDueAt` UI; the chip lives in the row already).
39. Markdown export of a conversation (in addition to TXT/JSON).
40. Webhook health sidebar indicator (per workspace rule — never green-badge a dead inbound).
41. "Linked contact" deep-link from the right pane to `/contacts`.
42. Native mobile app-style swipe-back gesture from chat to list.

---

## 8. Severity Count

| Severity | Count |
|---|---|
| CRITICAL | 3 (2.A, 2.B, and the implicit "do not copy the mock's 3rd stats label" is captured by 2.B) |
| HIGH | 7 (2.C, 2.D, 2.E, plus 1A#5, 1A#7, 1E#6) |
| MEDIUM | 11 (2.F, 2.G, 2.H, 2.I, 2.J, 2.K, 2.L, 2.M, 2.N, 2.O, plus 1G assign popover consolidation) |
| LOW | 9 (1A#11, 1A#12, 1B#1, 1B#9, 1G label picker, 1C#11, 1F#4, 2.P, 2.Q, 2.R, 2.S, 2.T) |

*(Some findings overlap; total unique = 47 items across 28 source files.)*

---

## 9. Evidence Map (file:line → mock element)

| Mock element | File:line |
|---|---|
| Green WhatsApp glyph in list header | `client/src/components/inbox/WhatsAppLogo.tsx:10-22` |
| "Chats" title | `client/src/components/inbox/InboxListHeader.tsx:126` |
| Connection indicator (right of Filters) | `client/src/components/inbox/InboxListHeader.tsx:130-134` |
| Filters button | `client/src/components/inbox/InboxListHeader.tsx:136-153` |
| Kebab menu | `client/src/components/inbox/InboxListHeader.tsx:181-231` |
| Search bar | `client/src/components/inbox/InboxListHeader.tsx:235-241` |
| Chip row (All / Unread / Favourites / SLA / +) | `client/src/components/inbox/InboxListHeader.tsx:243-306` |
| Conversation row (mint selected) | `client/src/components/inbox/ConversationItem.tsx:65-167` |
| Virtualized list | `client/src/components/inbox/ConversationList.tsx:1-199` |
| Chat header (avatar / name / phone / 6 icon buttons) | `client/src/components/inbox/ChatHeader.tsx:172-389` |
| Service-window badge in header | `client/src/components/inbox/ServiceWindowBanner.tsx:69-92` |
| Bot-on icon and "Add to favourites" | `client/src/components/inbox/ChatHeader.tsx:233-254` |
| Snooze popover | `client/src/components/inbox/SnoozePopover.tsx:43-135` |
| Thread with bubbles / date divider / failed retry | `client/src/components/inbox/MessageBubble.tsx:166-405` |
| Composer (Plus pill / text pill / send button) | `client/src/components/inbox/ChatComposer.tsx:91-261` |
| Window-closed banner | `client/src/components/inbox/ChatThread.tsx:393-411` |
| Customer details panel | `client/src/components/inbox/InboxDetailsPanel.tsx:74-656` |
| Profile card | `client/src/components/inbox/details/ProfileCard.tsx:10-37` |
| Stats row (3 chips) | `client/src/components/inbox/details/StatsRow.tsx:62-71` |
| Quick Actions (Assign / Campaign / Ticket / Export / Snooze) | `client/src/components/inbox/details/QuickActions.tsx:54-97` |
| Notes | `client/src/components/inbox/InboxDetailsPanel.tsx:427-501` |
| Custom Attributes | `client/src/components/inbox/InboxDetailsPanel.tsx:503-555` |
| Active Automations | `client/src/components/inbox/details/AutomationsSection.tsx:33-81` |
| Collapsed icon rail | `client/src/components/inbox/InboxDetailsPanel.tsx:586-648` |
| Topbar (Inbox / Live / "Reply to your customers" / avatar) | `client/src/components/layout/AppTopbar.tsx:85-228` |
| Page shell + Inbox rounded card | `client/src/index.css:947-975` |
| Chat background wallpaper | `client/src/index.css:1167-1184` |
| Modal slide-in / fade | `client/src/index.css:1057-1103` |
| Snooze/context menu popover keyframes | `client/src/index.css:1221-1239` |
| Skeleton shimmer | `client/src/index.css:1038-1055` |
| Create ticket modal | `client/src/components/inbox/CreateTicketModal.tsx:29-117` |
| Payment link modal | `client/src/components/inbox/PaymentLinkModal.tsx:20-100` |
| Export chat dialog | `client/src/components/inbox/ExportChatDialog.tsx:23-127` |
| New chat slide-over | `client/src/components/inbox/NewChatSlideOver.tsx:15-95` |
| Bulk select bar | `client/src/components/inbox/BulkSelectionBar.tsx:18-97` |
| Search in chat bar | `client/src/components/inbox/SearchInChatBar.tsx:16-99` |
| Context menu (right-click on a row) | `client/src/components/inbox/ChatContextMenu.tsx:51-239` |
| Keyboard shortcuts (R / Esc / D) | `client/src/hooks/useInboxKeyboardShortcuts.ts:16-52` |

---

## 10. Honest Verdict

The Inbox is **functionally 80% of where it needs to be** and **visually 65% of the mock**. Most of the missing 20-35% is **polish and micro-states**, not features. The biggest risks are:

1. **Following the mock blindly** for the stats row's 3rd label (label-concatenation bug) → would violate plan §Part 5.
2. **Trusting that the floating black toolbar in Image B is part of the UI** → it's not in the source; confirm with the user.
3. **Keeping the SLA chip** when no SLA work has been wired → dead control.

If we ship P0 in this document (14 items, ~2-3 days) and complete the existing plan's P0/P1 (parts 2-3 of `inbox-redesign_f8ecc995.plan.md`), the Inbox should be **9/10** by the next review cycle.

---

*End of pixel-diff. Pair with `docs/audit/inbox-redesign_f8ecc995.plan.md` Parts 1-6 and `docs/ui-specs/inbox-content-poc.md` for full context.*
