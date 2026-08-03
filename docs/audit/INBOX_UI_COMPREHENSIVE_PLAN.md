# Samyoj Inbox — Comprehensive UI Plan (Single Source of Truth)

> **Date:** 2026-08-03
> **Status:** Implementation north star
> **Inputs synthesized:**
> 1. `docs/audit/INBOX_PIXEL_DIFF.md` — 47 file:line findings, ranked CRITICAL/HIGH/MEDIUM/LOW
> 2. `docs/INBOX_MOTION_RESPONSIVE_RESEARCH.md` — motion vocabulary, responsive plan, 28 micro-interactions, a11y
> 3. `docs/ui-specs/inbox-content-poc.md` — content architecture
> 4. `docs/WHATSAPP_API_DOCUMENTATION.md` — Meta compliance floor
> 5. `inbox-redesign_f8ecc995.plan.md` — implementation plan + **Confirmed Decisions** (honesty rules)
>
> **Rule of precedence:** Confirmed Decisions > Pixel diff > Mock. When the mock is wrong, we do not copy it (Stats row #3, Groups chip, Video icon, 4.8 Satisfaction).

---

## 0. Executive Summary

### Current scores (out of 10)

| Dimension | Score | Why |
|---|---:|---|
| **UI fidelity to mock** | **6.5** | Right bones, wrong polish — topbar, connection pill, selected wash, bar heights, service-window copy |
| **Honesty (no fake data)** | **9.0** | StatsRow already wired to real `formatAvgFirstResponse`; webhook health banner shipped; window tri-state shipped. **The 1.0 gap is the unconditional SLA chip.** |
| **Functional completeness** | **7.0** | All overlays exist; 3-pane IA correct; status/snooze/assign/notes/labels/export/quick-replies all wired. Missing: drafts, mark-unread, mark-read-to-Meta, load-earlier. |
| **Motion** | **4.0** | Modal slide-in + skeleton shimmer + button hover exist. Missing: bubble enter, scroll-up "N new", reduced-motion guards, count-up tokens, popover micro-spring. |
| **A11y (WCAG 2.2 AA)** | **3.5** | Touch targets OK. Missing: focus rings on icon buttons, `aria-live` for new messages, skip link, `prefers-reduced-motion` guards, topbar subtitle contrast, chip-row roving tabindex, dialog `aria-modal` everywhere. |
| **Responsive** | **5.5** | 3-pane to 2-pane to 1-pane works at the macro level. **Tablet (768–1023px) gets a missing icon rail**; details never become a sheet; 1k+ chats not virtualized; bulk bar overflows at 375. |
| **Meta compliance** | **9.5** | Window tri-state + auto-template switch on 131047 shipped; no fake groups/typing/voice/video. **The 0.5 gap is "Mic icon still rendered in some specs but already hidden in ChatComposer"** + missing sticker/reaction send paths. |
| **Production-ready for 1k–2k customers** | **6.5** | After P0 fixes, this jumps to **~8.5**. After P1, **9+**. |

### What is already shipping (from P1+P2+P3 of the master plan)

- **3-pane IA** with virtualized list, sticky thread, slide-over details
- **Service-window tri-state** (`undefined` → skeleton; `OPEN` → composer; `CLOSED` → amber banner + `TemplateComposer` with auto-switch on Meta `131047`)
- **Webhook health banner** (red, list-header-anchored; pops on inbound failure; per workspace rule)
- **Stats row** from real `/inbox/:id/stats` (no fake CSAT — `formatAvgFirstResponse` from `firstResponseAt`)
- **6 icon buttons** in chat header (Phone · Search · Bell · Star · Bot · More) — no Video (Cloud API gap)
- **Snooze popover** with 1h/4h/tomorrow-9AM/custom + indicator dot
- **Assign-agent popover** in header (assign-to-me · list · unassign)
- **Failed-message retry** (`Failed · Retry` inline; planned/p0)
- **Composer skeleton** during window-state load
- **All overlays** — New chat, Create ticket, Payment link, Export, Media viewer, Interactive composer, Search-in-chat, Bulk select, Context menu
- **Inbound/outbound bubbles** with grouping tails, blue read ticks, media, audio, docs, interactive, contact card, location, template display

### Top 5 visual gaps (from the diff)

1. **Stats row #3 label-concatenation bug in the mock** — do not copy. Code is already correct.
2. **Connection pill wrong position** — currently right of Filters; mock wants left of "Chats" or as a chip.
3. **Topbar "Live" pill oversized + grey-on-grey subtitle** — WCAG AA fail on subtitle.
4. **"SLA" chip in list header** — renders unconditionally with no SLA data behind it; dead control.
5. **Chat header has inline "· assigned agent"** — mock has it in the right pane only; we duplicate it.

### Top 5 motion / responsive gaps

1. **No bubble enter animation** — fresh bubbles just pop in.
2. **No "N new messages" affordance** when scrolled up — we auto-scroll anyway.
3. **No `prefers-reduced-motion` guard** on `inbox-skeleton-shimmer`, `animate-ping`, `modalFadeIn`.
4. **Tablet (768–1023px) has no icon-rail** — details is hidden, no way to open it.
5. **List not actually virtualized at 1k+ chats** — `ConversationList.tsx` uses dynamic measurement but the upstream `loadConversations` paginates 10 at a time (defect #1 in master plan P0).

### Top 5 missing-but-important features

1. **Drafts preserved per conversation** (P0 defect #1 in master plan; plan §Part 2 #1)
2. **Mark-as-unread** (backend endpoint + UI affordance; backend gap)
3. **`markAsRead` to Meta** (defined in `meta.service.ts:748`, never called — customers never get blue ticks)
4. **Load-earlier-messages** (`before` cursor exists server-side, client never calls it — defect #8)
5. **New filter chips: Unreplied · Has ticket · Bot active** (recommended in `inbox-content-poc.md:194`)

---

## 1. Side-by-Side Pixel Diff — Curated Top 20

Grouped by pane. Curated from the 47 raw findings; the 27 lower-priority ones are in `INBOX_PIXEL_DIFF.md` §1A–1G.

### Left pane (chat list)

| # | Element | Mock | Existing | Delta | Sev | file:line | Fix |
|---|---|---|---|---|---|---|---|
| 1 | Connection pill position | Small green dot + "Connected" in title row, left of "Chats" | Renders to the right of Filters; not a chip | Wrong location | **HIGH** | `InboxListHeader.tsx:130-134` | Move into title row; render as a pill `Connected · 5 agents` |
| 2 | "SLA" chip | Not present | Unconditional red chip | Dead control | **HIGH** | `InboxListHeader.tsx:280-292` | Remove; gate on real `slaBreached > 0`; keep row badge |
| 3 | Trailing `+` next to chips | One Filters control | `+` button opens the same popover | Duplicate | **MEDIUM** | `InboxListHeader.tsx:293-305` | Repurpose to "Save current view" |
| 4 | Row height | 72px | `ROW_HEIGHT = 68` | -4px | **MEDIUM** | `ConversationList.tsx:10` | `const ROW_HEIGHT = 72;` |
| 5 | Selected row wash | Light mint | `bg-emerald-100/70` (too dark) | Color delta | **MEDIUM** | `ConversationItem.tsx:74` | `bg-emerald-50/80` |

### Center pane (chat header)

| # | Element | Mock | Existing | Delta | Sev | file:line | Fix |
|---|---|---|---|---|---|---|---|
| 6 | Inline assignee in header | Not present | Shows "· Priya" in green below phone | Extra | **MEDIUM** | `ChatHeader.tsx:190-196` | Remove inline assignee; show only in right pane |
| 7 | Bar height | ~64px | `py-2.5` (~56-60px) | -4-8px | **MEDIUM** | `ChatHeader.tsx:172` | `py-3.5` |
| 8 | Service-window pill copy | Sentence case, "3h 12m left" | Uppercase `N H LEFT` | Copy delta | **MEDIUM** | `ServiceWindowBanner.tsx:78-89` | Remove `uppercase`; "Can reply · 3h 12m left" |

### Center pane (composer)

| # | Element | Mock | Existing | Delta | Sev | file:line | Fix |
|---|---|---|---|---|---|---|---|
| 9 | Bar height | ~64px | `py-2.5` | -4-8px | **MEDIUM** | `ChatComposer.tsx:94` | `py-3.5` |
| 10 | Placeholder hint | (mock doesn't show) | Says "Press / to find chats" | Wrong key | **MEDIUM** | `ChatPlaceholder.tsx:5-7` | "Press R to find chats" |
| 11 | Floating black toolbar in Image B | Not in mock | Not in any source file | Stale screenshot artifact | **CRITICAL** | (unowned) | Confirm with user; likely a browser extension or OS overlay; not a code bug |

### Right pane (customer details)

| # | Element | Mock | Existing | Delta | Sev | file:line | Fix |
|---|---|---|---|---|---|---|---|
| 12 | Stats row 3rd label | "35M OPEN TICKETS AVG FIRST RESPONSE" (concatenation bug) | "Avg First Response" with `formatAvgFirstResponse` | **MOCK IS WRONG** | **CRITICAL** | `StatsRow.tsx:66-69` | **Keep current code.** Do not copy the mock. |
| 13 | Stats row 2nd label | "0 OPEN TICKETS" | "Open Tickets" | OK | — | `StatsRow.tsx:65` | None |
| 14 | Assign agent surfaces | (one surface) | **Three** surfaces (header overflow + details panel + context menu) | Duplication | **MEDIUM** | `ChatHeader.tsx:281-336`, `InboxDetailsPanel.tsx:272-317`, `ChatContextMenu.tsx:38-49` | Consolidate to one shared `AssignAgentPopover` |

### Topbar

| # | Element | Mock | Existing | Delta | Sev | file:line | Fix |
|---|---|---|---|---|---|---|---|
| 15 | Subtitle contrast | Grey on grey, ~0.55/0.55 in screenshot | `text-neutral-500` on glass topbar | **WCAG AA fail** | **HIGH** | `AppTopbar.tsx:113` | `text-neutral-700 dark:text-neutral-300` |
| 16 | "Live" pill size | Small (~10px) | Code says 10px, but visually large due to surrounding kbd chip min-height | Visual weight | **HIGH** | `AppTopbar.tsx:108-110` | Cap to `h-5 px-2 text-[10px]`; or replace with a status dot inline |
| 17 | Number switcher | Not in mock | `NumberSwitcher` rendered | Extra | **LOW** | `AppTopbar.tsx:121-122` | Keep — product decision |

### Overlays / sub-screens

| # | Element | Mock | Existing | Delta | Sev | file:line | Fix |
|---|---|---|---|---|---|---|---|
| 18 | Bulk snooze | (mock omits) | Hardcoded `+1h` | Honesty / UX | **MEDIUM** | `BulkSelectionBar.tsx:79-85` + `InboxPage.tsx:418-423` | Open `SnoozePopover` from bulk bar |
| 19 | "Mark as unread" action | (mock omits) | Silently missing | Transparency | **MEDIUM** | `ChatHeader.tsx:362-363` | Disabled tooltip "Coming soon — API support in progress" |
| 20 | SLA row badge | (mock omits) | Always small | Conditional OK | **MEDIUM** | `ConversationItem.tsx:24-47` | Already conditional on real SLA data — keep, but verify schema wires it |

---

## 2. CRITICAL & HIGH — Fix-First List

Each item: file:line · root cause · fix recipe · verification step.

### 2.A — CRITICAL — Floating black toolbar in Image B
- **file:line:** unowned (not in any source file)
- **Root cause:** Stale screenshot artifact — likely browser extension (Loom, Loom AI, Otter, or similar), OS overlay, or the user's `react-devtools`/dev console.
- **Fix recipe:** **NOT a code change.** Add a `aria-hidden` overlay trap, but the real fix is to ask the user to disable browser extensions and re-screenshot. If it is reproducible, instrument `console.log` for any unowned `<div>` with `position: fixed; z-index >= 200` that matches the black bar.
- **Verification:** Ask user to confirm; in absence of reproduction, document as a known screenshot artifact.

### 2.B — CRITICAL — Mock's "35M OPEN TICKETS AVG FIRST RESPONSE" label-concatenation bug
- **file:line:** `client/src/components/inbox/details/StatsRow.tsx:62-71`
- **Root cause:** The mock is LLM-generated and concatenated two distinct labels. Plan §Part 5 #2 already warns against this.
- **Fix recipe:** **Keep the current code.** Label = "Avg First Response" with `formatAvgFirstResponse(stats.avgFirstResponseMinutes)`. Optionally rename the displayed label to "First response" for cleaner copy.
- **Verification:** `curl -s http://localhost:8000/api/inbox/:id/stats` returns `{ avgFirstResponseMinutes: 720 }` and UI renders "12h".

### 2.C — HIGH — "SLA" chip is rendered even with no SLA data
- **file:line:** `client/src/components/inbox/InboxListHeader.tsx:280-292`
- **Root cause:** The chip renders unconditionally. `slaDueAt`/`slaBreached` exist in the schema but the UI has no SLA list/filter wired yet.
- **Fix recipe:** Remove the unconditional chip. The row-level badge (`ConversationItem.tsx:24-47`) already shows context-sensitive SLA when real data is present. Add the chip back when `slaBreached > 0 || slaDueAt < now + 1h` and at least one row in the current filter has a SLA.
- **Verification:** With no SLA data, the chip is hidden. After backend wires SLA, it appears only when relevant.

### 2.D — HIGH — Connection pill mis-positioned
- **file:line:** `client/src/components/inbox/InboxListHeader.tsx:130-134`
- **Root cause:** Renders right of Filters, not in the title row.
- **Fix recipe:** Move `ConnectionStatusIndicator` into the title row, render as a small pill: `Connected · 5 agents` (or just `Connected` with a green dot). Keep the live `socketState.status` semantics.
- **Verification:** At 1280px, the title row shows `[WhatsApp glyph] Chats [Connected pill]` on the left and `[Search · Filters · Kebab]` on the right.

### 2.E — HIGH — Topbar "Live" pill oversized + subtitle grey-on-grey
- **file:line:** `client/src/components/layout/AppTopbar.tsx:108-117`
- **Root cause:** Subtitle `text-neutral-500` on glass topbar fails WCAG AA contrast. "Live" pill is code-correct (`text-[10px] py-0.5`) but visually inflated by the kbd chip beside it.
- **Fix recipe:**
  ```tsx
  // subtitle:
  className="mt-1 truncate text-[12px] font-medium leading-snug text-neutral-700 sm:text-[13px] dark:text-neutral-300"
  // live pill (or replace with dot + word):
  className="inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/80"
  ```
- **Verification:** Lighthouse contrast pass ≥ 4.5:1; the pill is ≤ 20px tall.

### 2.F — HIGH — Stats row uses the *real* code (already correct)
- **file:line:** `StatsRow.tsx:62-71`
- **Root cause:** This is a "HIGH" in the diff only because the mock is wrong.
- **Fix recipe:** **No fix needed.** Keep `formatAvgFirstResponse` and the skeleton fallback. Consider renaming the label to "First response" for clarity.
- **Verification:** Manually inspect the right pane for 3 conversations with different avg-response values.

### 2.G — HIGH — Connection-state webhooks should drive the connection pill
- **file:line:** `client/src/components/inbox/InboxListHeader.tsx:130-134` + `useSocket.ts:147`
- **Root cause:** The connection pill is socket-status only, not the same signal as the red "Inbound messages are not arriving" banner.
- **Fix recipe:** Reuse the same `useWebhookHealth` signal as the banner; show three states: `connected (green)`, `reconnecting (amber)`, `disconnected (red)`.
- **Verification:** Kill the tunnel → pill turns red within 5s. Restore → green within 10s.

---

## 3. Motion Vocabulary (the team's shared language)

> Single source of truth. Every motion in the Inbox must use a row from this table; if a needed motion is missing, **add it here first, then implement**.

| Action | Duration | Easing | Property | Reduce-motion fallback |
|---|---:|---|---|---|
| Conversation row hover | 100-150ms | `ease-out` (`cubic-bezier(0,0,0.2,1)`) | `background-color` | Instant; keep only on `(hover: hover)` |
| Row selected / deselected | 150-200ms | `ease-in-out` (`cubic-bezier(0.4,0,0.2,1)`) | `background-color` + 2px left-edge `aria-current` indicator | Instant; non-color cue retained |
| Icon button hover / focus | 100-150ms | `ease-out` | `color`, `background-color`, `box-shadow` | Instant; focus ring still visible |
| Icon button pressed | 80-120ms | linear / `ease-out` | `opacity`, `scale(0.96)` | Color/background only; no scale |
| Filter chip selection | 150-200ms | `ease-out` | `background-color`, `color`, `border-color` | Instant |
| Bubble enter (in & out) | 160-220ms | `ease-out` | `translateY(6-10px)`, `opacity` | Insert directly, no transform |
| New inbound at bottom | 160-220ms | `ease-out` | `translateY(6-10px)`, `opacity` | Insert directly |
| New inbound while scrolled up | 120-180ms | `ease-out` | `opacity` + small `translateY` | Insert directly; sticky "N new" affordance |
| Optimistic outbound | 120-180ms | `ease-out` | `opacity`, `translateY(4px)` | Insert directly |
| Failed-send transition | 120-180ms | `ease-out` | `color`, `border`, icon `opacity` | Instant error state with "Failed · Retry" text |
| Date divider / "New messages" marker | 150-200ms | `ease-out` | `opacity` | Immediate |
| Typing / bot-preparing indicator | 900-1200ms loop, 120-180ms stagger | `ease-in-out` | `opacity`, `translateY` | Static "Bot is preparing a reply…" |
| Composer attach menu open | 150-220ms | `ease-out` | `opacity`, `translateY(4px)`, optional `scale(0.98→1)` | Instant; focus retained |
| Composer attach menu close | 100-160ms | `ease-in` | `opacity`, `translateY(2px)` | Instant |
| Composer expand / collapse | 200-300ms | `ease-in-out` | `transform`, `opacity` | Instant layout change; draft preserved |
| Search-in-chat bar reveal | 180-250ms | `ease-out` | `translateY(-6px)`, `opacity` | Instant reveal |
| Right details rail open | 220-300ms (desktop) · 280-350ms (mobile sheet) | `ease-out` | `translateX(100%)`, `opacity` | Instant or cross-fade; focus → heading |
| Right details rail close | 160-220ms | `ease-in` | `transform`, `opacity` | Instant; focus → opener |
| New-chat slide-over | 220-300ms | `ease-out` | `transform`, `opacity` | Instant reveal |
| Modal open | 180-280ms | `ease-out` | `opacity` + small `translate/scale` | Cross-fade or instant |
| Modal close | 120-200ms | `ease-in` | `opacity` | Instant; focus → opener |
| Toast enter | 180-240ms | `ease-out` | `translateY(8px)`, `opacity` | Instant |
| Toast exit | 120-180ms | `ease-in` | `opacity` | Instant |
| Skeleton shimmer | 1200-1800ms loop | `linear` | `background-position` | Static neutral blocks |
| Loading spinner | 700-1000ms loop | `linear` | `rotate` | Static "Loading…" or `aria-busy` |
| Number / stat update | 180-300ms once | `ease-out` | `opacity` | Replace immediately; announce final value once |
| Segment underline slide | 180-240ms | `ease-out` | `translateX()` | Move underline instantly |
| Toggle switch | 100-180ms | `ease-out` | `thumb` + `color` | Instant thumb/color |
| Pane drag feedback | continuous pointer; 100-150ms snap | direct / `ease-out` snap | `transform` or grid track | Direct resize, no snap |
| Hover preview card | 150-220ms after 150-200ms intent delay | `ease-out` | `opacity`, `translateY` | No preview; expose via click/focus |
| Pull-to-refresh | gesture-driven; 180-250ms settle | direct + `ease-out` | `transform`, `opacity` of indicator | Static refresh button |
| Reconnect banner | 200ms | `ease-out` | `opacity`, `translateY(-4px)` | Instant |
| Window-closed banner appear | 200ms | `ease-out` | `opacity`, `translateY(-4px)` | Instant |
| Skeleton → content cross-fade | 120ms | `ease-out` | `opacity` | Instant swap |

### Easing tokens (use these literals in code)

| Token | CSS | When |
|---|---|---|
| `ease-out` | `cubic-bezier(0,0,0.2,1)` | Most entrances |
| `ease-in` | `cubic-bezier(0.4,0,1,1)` | Exits |
| `ease-in-out` | `cubic-bezier(0.4,0,0.2,1)` | Cyclic + Material standard |
| `ease-spring` | `cubic-bezier(0.16,1,0.3,1)` | Popovers, modals (whimsy) |
| `linear` | `linear` | Loops only |

### Reduced-motion rule (mandatory)

Wrap **every** keyframe (`inboxShimmer`, `modalFadeIn`, `slideIn`, `sidebarFlyoutIn`, `animate-pulse`, `animate-ping`, `animate-spin`) in:

```css
@media (prefers-reduced-motion: reduce) {
  .inbox-skeleton-shimmer,
  .modal-panel, .modal-backdrop,
  .inbox-select__menu, .context-menu-panel,
  .sidebar-flyout-tip {
    animation: none !important;
    transition: none !important;
  }
  /* Pulse / ping (Tailwind) — handled via motion-reduce: variant */
}
```

---

## 4. Hover / Focus / Active / Selected / Disabled / Loading / Error State Standards

Concrete Tailwind class examples for each element type.

### 4.1 Button (primary, e.g. Send)

| State | Class fragment |
|---|---|
| Default | `bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]` |
| Hover | `hover:brightness-105` |
| Focus-visible | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700` |
| Pressed | `active:scale-95 active:brightness-95` |
| Selected | N/A (button) |
| Disabled | `disabled:cursor-not-allowed disabled:from-neutral-300 disabled:to-neutral-400 disabled:shadow-none disabled:opacity-60` |
| Loading | Replace icon with `animate-spin` ring; keep geometry |
| Error | `bg-red-600 text-white` + ring `ring-2 ring-red-300` |

### 4.2 Icon button (HeaderIconButton, Attach, Snooze, etc.)

```tsx
className={[
  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700',
  active
    ? 'border-whatsapp-500/50 bg-whatsapp-500/10 text-whatsapp-700'
    : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg',
  disabled && 'cursor-not-allowed opacity-50',
].filter(Boolean).join(' ')}
```

| State | Rule |
|---|---|
| Default | outlined surface |
| Hover | surface tint, icon contrast shift |
| Focus-visible | 2px green outline, 2px offset (do not remove) |
| Pressed | `scale(0.96)` for 80-120ms |
| Active (toggled) | green ring + tint + `aria-pressed="true"` |
| Disabled | 50% opacity, no pointer |
| Loading | inline `animate-spin` ring inside the button |

### 4.3 Filter chip (All / Unread / Favourites / SLA / etc.)

| State | Tailwind |
|---|---|
| Default | `bg-theme-subtle text-theme-secondary` |
| Hover | `hover:text-theme-fg` |
| Focus-visible | `focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2` |
| Selected | `bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]` + `aria-pressed="true"` |
| Selected-destructive (SLA) | `from-red-500 to-rose-600` |
| Disabled | `disabled:opacity-40 disabled:cursor-not-allowed` |

### 4.4 Conversation row (ConversationItem)

| State | Tailwind |
|---|---|
| Default | `bg-white dark:bg-neutral-950` |
| Hover | `hover:bg-neutral-50 dark:hover:bg-neutral-900/60` |
| Focus-visible | `focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700` |
| Selected | `bg-emerald-50/80 dark:bg-emerald-950/40` + 2px left-edge indicator + `aria-current="true"` |
| Pressed | darker wash for 80ms |
| Checked (bulk) | `bg-whatsapp-500/10` + visible checkbox |
| Loading | `inbox-skeleton-shimmer` block (geometry match) |
| Error | outline red-400 + "Couldn't load" tooltip |

### 4.5 Search input (SearchInput)

| State | Tailwind |
|---|---|
| Default | `bg-theme-subtle/70 border-transparent` |
| Hover | `border-theme-border` |
| Focus-within | `focus-within:border-whatsapp-500/40 focus-within:ring-whatsapp-500/15` |
| Active (typing) | show clear button + result count, never replace typed value |
| Loading | inline progress bar in input |
| Error | `border-red-400 ring-1 ring-red-300` + helper text below |

### 4.6 Send / Retry / Submit (isolated action)

| State | Tailwind |
|---|---|
| Default | enabled only when `canSend` |
| Hover | `hover:brightness-105` |
| Focus-visible | 2px outline, never break circle geometry |
| Pressed | `scale(0.95)` for 80ms |
| Disabled | `disabled:from-neutral-300 disabled:to-neutral-400` |
| Loading | `animate-spin` ring **inside** button, geometry stable |
| Error | failed bubble remains, button becomes "Retry" with red ring |

### 4.7 Attach menu item / Snooze / Assign option

| State | Tailwind |
|---|---|
| Default | `text-theme-secondary` |
| Hover | `hover:bg-theme-subtle` |
| Focus-visible | `focus-visible:bg-theme-subtle focus-visible:outline-2 focus-visible:outline-emerald-700` |
| Pressed | darker wash |
| Selected | `aria-selected="true"` + check icon + bolder text |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` + accessible name explains why |

### 4.8 Toggle (Bot on/off in header)

| State | Tailwind |
|---|---|
| Default | `bg-neutral-300` track |
| Hover | `hover:bg-neutral-400` |
| Focus-visible | 2px outline around entire switch |
| Pressed | thumb moves immediately, settles 100-180ms |
| Checked | `bg-emerald-500` track + thumb right + `aria-checked="true"` |
| Disabled | track 30% opacity, label remains readable |

### 4.9 Stat chip (Total Chats, Open Tickets, Avg First Response)

| State | Tailwind |
|---|---|
| Default (skeleton) | `inbox-skeleton-shimmer h-[54px] rounded-xl` |
| Loaded | `border border-theme-border rounded-xl px-2 py-2.5` + value + uppercase label |
| Error | hide entire row (never fake a number) |
| Hover | none (info-only) |
| Focus-visible | `focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2` |

### 4.10 Toast / Snackbar

| State | Tailwind |
|---|---|
| Enter | `translateY(8px) opacity-0 → translateY(0) opacity-100`, 200ms |
| Visible | `bg-neutral-900 text-white px-4 py-2.5 rounded-xl shadow-lg` |
| Action (Undo) | `text-emerald-300 hover:text-emerald-200` |
| Exit | `opacity-0`, 150ms |
| Stacked | one visible at a time, 3-6s; failures stay until dismissed |

---

## 5. Responsive Plan

Per the InboxPage grid + InboxListHeader + ChatHeader + InboxDetailsPanel.

### 5.1 Breakpoint map

| Width | Layout mode | InboxListHeader | ChatHeader | InboxDetailsPanel | Composer |
|---:|---|---|---|---|---|
| **375** | Single-pane (list OR chat) | List only, chips scroll, search bar full width, Unread count truncates | Hidden when on list; full-bleed when on chat with back button | Bottom sheet, 85-95vh, drag handle, 44px close | 44px controls, safe-area bottom, no overflow |
| **390** | Single-pane | Same as 375 with more breathing room | Same | Bottom sheet | Same |
| **768** | Two-pane (list + thread) — **no details** | List 280-320px, chips still scroll | Identity + 3 actions + overflow | Hidden, opened via header overflow as overlay/sheet | 44px, attach menu becomes popover |
| **820** | Two-pane | List 280-320px | Identity + 3 actions, rest overflow | Collapsible rail (collapsed) or overlay | One row if input has ≥220px; else controls wrap above input |
| **1024** | Three-pane with **collapsed icon rail** | List 300-340px, identity column exposed | Full identity + service window pill + 6 actions | 44px icon rail (currently `lg:flex` — **extend to `md:flex`**) | Full one-row composer |
| **1280** | Three-pane (expanded details) | List 300-360px, cap row metadata | Same | 320px panel expanded | Full one-row |
| **1440** | Three-pane, comfortable | List 320-380px, generous row metadata | Same | 320-360px | Full one-row, attach popover aligns left |
| **1920** | Three-pane, fixed | List 360-420px (capped, not infinite), identity max width | Same | 340-400px | Full one-row, optional drag resize |

### 5.2 Specific file:line changes needed

1. **`InboxDetailsPanel.tsx:652`** — change expanded aside from `lg:flex` to `md:flex`.
2. **`InboxDetailsPanel.tsx:586-648`** — change icon rail from `lg:flex` to `md:flex` so tablet gets the rail.
3. **`InboxDetailsPanel.tsx:570-584`** — overlay becomes a slide-up **bottom sheet** with a drag handle (3px tall grey bar) on `md:` and below.
4. **`InboxListHeader.tsx:243`** — chip row already `overflow-x-auto`; ensure `Unread 12` doesn't truncate at 375 (use `shrink-0`, keep count outside chip).
5. **`ChatComposer.tsx:91-94`** — `min-h-[44px]` OK; attach + input + send all 44px.
6. **`ChatThread.tsx:317-319`** — thread padding `px-3 py-3 sm:px-4` OK.
7. **`BulkSelectionBar.tsx:30-95`** — at 375, "Snooze 1h" / "Close" / "Assign" may overflow. Verify, and replace hardcoded 1h with `SnoozePopover`.
8. **`MessageBubble.tsx:351`** — `max-w-[65%]` OK; cap text line length around 65-80 chars on huge screens.
9. **Drag-to-resize handle** (P1) — 4-6px splitter between list/chat/details; persist width in `localStorage`; full WAI-ARIA `separator` semantics (arrow keys, Home/End, Enter).

### 5.3 New mobile-only behaviors

- **Right-edge swipe to open details sheet** (mirrors iOS/Material gesture).
- **Bottom sheet drag handle** (3px tall grey bar) so it feels native.
- **Composer attach → full-width sheet** on mobile when the menu doesn't fit.
- **Pull-to-refresh** (P2) on chat list — with a visible "Refresh" button as the always-available alternative (WCAG pointer-gesture rule).
- **Swipe row actions** (P2) for snooze / mark unread / close — but always expose the same action in the kebab menu.

### 5.4 Width caps (do not let list grow infinitely)

- List max **340px** at desktop, fluid up to **380-420px** only on 1920px.
- Beyond that, scanning slows (eye travels farther between avatar/preview/metadata); excess width should go to the thread.
- Thread text line length cap ~ 65-80 chars even on 1920px.

---

## 6. Micro-Interaction Catalog (top 12 to ship)

| # | Trigger | Motion | Target file | Dep | Effort |
|---:|---|---|---|---|---|
| 1 | New bubble enters | `opacity + translateY(6px)`, 180ms `ease-out` | `MessageBubble.tsx` + `ChatThread.tsx` (wrap with Framer Motion or CSS) | none | 0.5d |
| 2 | "N new messages" affordance (scrolled up) | Sticky button, fade-in 200ms, click → smooth scroll to bottom | `ChatThread.tsx` | useNearBottom hook | 0.5d |
| 3 | Bubble send (optimistic) | Insert with `opacity 0 → 1` + `translateY(4px)`, 150ms | `MessageBubble.tsx` | shared with #1 | 0.25d |
| 4 | Bubble status tick appear | Fade in 150ms after bubble lands | `MessageBubble.tsx` (time + ticks row) | none | 0.25d |
| 5 | Attach menu open | 180ms `ease-out`, `opacity + translateY(4px) + scale(0.98→1)`; `cubic-bezier(0.16,1,0.3,1)` | `ChatComposer.tsx` | shared `motion.ts` | 0.5d |
| 6 | Canned reply autocomplete | 120-180ms `opacity` reveal; arrow keys move focus | `ChatComposer.tsx:130-147` | keyboard nav hook | 0.5d |
| 7 | Composer focus-within | `focus-within:border-whatsapp-500/40 focus-within:ring-whatsapp-500/15`, 150ms | `ChatComposer.tsx:233` | none | 0.1d |
| 8 | Window-closed banner appear | Cross-fade 200ms | `ChatThread.tsx:393-411` | shared | 0.25d |
| 9 | Skeleton → content cross-fade | 120ms `opacity` swap | `ConversationList.tsx:96-104`, `StatsRow.tsx:52-59` | shared | 0.5d |
| 10 | Popover micro-spring (Snooze, Context menu) | 200ms `ease-spring` (`cubic-bezier(0.16,1,0.3,1)`), `scale(0.96→1) + opacity` | `SnoozePopover.tsx`, `ChatContextMenu.tsx` | shared `motion.ts` | 0.25d |
| 11 | Topbar "Live" pulse | Animate dot at 1500ms (`animate-pulse`) | `AppTopbar.tsx:108-110` | none | 0.1d |
| 12 | Reduced-motion media query | Global guard on all keyframes | `client/src/index.css` | none | 0.25d |

**Total effort:** ~4 days; ships inside P0/P1.

---

## 7. Accessibility (WCAG 2.2 AA)

### 7.1 Focus rings (mandatory)

```css
:focus-visible {
  outline: 2px solid #087f5b; /* Samyoj dark green */
  outline-offset: 2px;
}
```

For white / mint surfaces, prefer a **two-color ring** (dark outer + light inner gap) so contrast is always ≥ 3:1.

### 7.2 Current failures + fixes

| Element | Current | Failure | Fix |
|---|---|---|---|
| `AppTopbar` subtitle | `text-neutral-500` on glass topbar | Contrast < 4.5:1 | `text-neutral-700 dark:text-neutral-300` |
| `HeaderIconButton` (chat header) | No `:focus-visible` rule | No visible focus | Add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700` |
| Filter chips | No focus-visible | No visible focus | Add `focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2` |
| All icon buttons in `BulkSelectionBar`, `ChatHeader` overflow, `SnoozePopover` | Hover-only | WCAG 2.4.7 fail | Token-based focus ring |
| `StatsRow` skeleton | No focus state | N/A (skeleton) | After load, chips get `focus-visible:ring-2` |
| Service-window pill | `uppercase tracking-wide` | OK contrast (green on white) | Keep |
| Assigned agent green | `text-emerald-600` on white | OK (≥ 4.5:1) | Keep |

### 7.3 Keyboard nav order

Three regions (Slack model): **List → Thread → Details**.

- **Tab** moves between regions and between controls.
- **Arrow ↑/↓** navigate conversation rows; **Home/End** jump to first/last; first-unread via `J` (Linear-style) is a P2.
- **Enter** opens the selected conversation.
- **Esc** deselects / closes current overlay / returns to list (mobile).
- **R** focuses the search input.
- **D** opens/closes details.
- **S** opens snooze popover.
- **T** opens template composer.
- **?** opens keyboard shortcuts overlay (P2).

### 7.4 Roving focus

- Chip row: `role="tablist"`, arrow keys move active descendant; only the active chip is in the tab order. `Tab` exits the row.
- Conversation list: `role="listbox"`, `aria-activedescendant` pattern, arrow keys move within.
- Message list: native `role="log"` (see live region below).

### 7.5 ARIA live regions

- **New message announcement** (polite): thread history container `role="log" aria-live="polite" aria-atomic="false"`. **Append** the new message DOM node only; do not re-render the whole thread.
- **Status announcements** (polite): "New messages", "Assigned to Alex", "Reconnecting", final stat change.
- **Failure announcements** (assertive, sparingly): send failures, webhook health down. Use `role="alert"`.
- **Live region container must exist in the DOM at page load** for reliable announcements.

```tsx
<div role="log" aria-live="polite" aria-atomic="false" className="sr-only">
  {newMessageAnnouncement}
</div>
<div role="alert" aria-atomic="true" className="sr-only">
  {errorAnnouncement}
</div>
```

### 7.6 Skip link + focus trap in modals

- **Skip link:** add `<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-emerald-600 focus:px-3 focus:py-2 focus:text-white">Skip to main</a>` in `PageShell`.
- **Modal focus trap:** `CreateTicketModal` already auto-focuses first field. Extend to `NewChatSlideOver`, `PaymentLinkModal`, `ExportChatDialog`, `InteractiveComposer`. Use `aria-modal="true"`, `role="dialog"`, `aria-labelledby={titleId}`. Restore focus to opener on close.

### 7.7 Reduced motion

Implement global `prefers-reduced-motion: reduce` guard on every keyframe (`inbox-skeleton-shimmer`, `modalFadeIn`, `slideIn`, `sidebar-flyout-in`, Tailwind `animate-pulse`, `animate-ping`, `animate-spin`). Replace with opacity/color changes only.

### 7.8 Target sizes (WCAG 2.2 AA Target Size Minimum)

- ≥ 24×24 CSS px for **all** controls. Samyoj's target is **36-44px** for icon buttons and **44px+** for touch rows.
- Audit: `HeaderIconButton` = 36×36 (h-9 w-9) ✓. Conversation row = ~72px ✓. Composer input = 44px ✓. Filter chip = 30px tall — should be **44px** tall for mobile touch (currently `py-1.5` ≈ 30px; bump to `py-2.5`).

### 7.9 Color independence

Every state cue must pair color with at least one of: weight, icon, text, border, shape.

- Unread: bold preview + green time + (optional) badge.
- Selected row: mint wash + `aria-current="true"` + 2px left-edge indicator.
- Disconnected: red banner with text "Inbound messages are not arriving" (color is **never** the only cue).
- Snoozed: indigo dot on Bell icon + status dot on row.

---

## 8. Honesty Patterns (no fake data anywhere)

> This section is the **contract** between the plan and the code review. Every honesty rule is testable.

### 8.1 Skeleton vs spinner rule

- **Skeleton** for content whose structure is known (list rows, thread bubbles, stats chips, composer).
- **Spinner** for isolated actions (Send, Retry, Refresh).
- **Static "Loading…" or `aria-busy`** for sub-second operations (do not show a spinner at all).
- **Real progress or named phase** for jobs > 10s ("Export started", "Export completed").

### 8.2 Already shipped (do not regress)

| Pattern | Where | What it does |
|---|---|---|
| Service-window tri-state | `InboxPage.tsx:267` + `ChatComposer.tsx:41-49` | `undefined` → skeleton; `OPEN` → composer; `CLOSED` → amber banner with `Template` CTA |
| Auto-template on Meta `131047` | `send.service.ts` | When send fails with 131047 (window closed), composer auto-switches to template mode with explanation |
| Webhook-down red banner | `InboxListHeader.tsx:92-114` | Red banner with reason, "Outbound still works on localhost" caveat, Retry button |
| Inbound health retry | `useWebhookHealth` | Poll webhook health on mount + on demand; reflects the *real* status |
| Snooze expiry toast | `useInboxRealtime` + `toast` system | "Snoozed chat from {name} is back" |
| 24h window countdown | `ServiceWindowBadge` (`ServiceWindowBanner.tsx:69-92`) | Live countdown; pulsing dot |
| Connection pill from socket | `ConnectionStatusIndicator.tsx:51-65` | Reflects `socketState.status` |
| Stats row from real `/inbox/:id/stats` | `StatsRow.tsx:37-49` | Returns `null` on failure (hides entire row) — never fakes a number |

### 8.3 Honesty rules for new work

- **Failed send:** optimistic bubble marked Failed, **Retry** button visible, error reason shown when known. Never remove the message or show only a red icon.
- **Meta 24h window closed:** amber explanatory banner + template action. Never briefly show "window closed" due to client flicker.
- **Media unavailable:** reserved-size placeholder, then "Photo unavailable" with retry.
- **Filtered empty:** "No chats match your filters" + Clear filters action. Never a generic "No data".
- **Not connected:** explain the missing connection + Connect WhatsApp CTA. Never an empty thread that looks like a load failure.
- **Export / bulk action:** "Export started" immediately, completion notification when ready. No indefinite spinner.
- **No activity yet:** calm connected-empty state with one useful next action. **Never fabricate conversations, totals, or presence.**
- **Customer typing / online / last seen:** **Meta exposes none of these.** Do not simulate them. The only "X is viewing" pill is for **fellow agents** (real data via `useConversationPresence`).
- **CSAT / satisfaction score:** schema has no model; do not ship a fake 4.8. Use `formatAvgFirstResponse` instead.
- **Voice notes:** the `Mic` icon is already hidden in `ChatComposer.tsx`. Do not re-add it.
- **Video calls:** Cloud API does not support outbound video from the business side. The 5th header icon is `Bot` (AI toggle), not `Video`.
- **Groups:** Cloud API has no groups. The "Groups" chip is removed from the mock per plan §Part 5 #1.
- **Mark as unread:** backend has no unread-write endpoint. Currently the action is **silently absent** (per `ChatHeader.tsx:362-363`). Ship as a **disabled** "Mark as unread" with tooltip "Coming soon — API support in progress" (transparent) instead.

---

## 9. Meta Compliance Floor

What the Cloud API does and does not support, and how the Inbox UI must respect it. **Source of truth: `docs/WHATSAPP_API_DOCUMENTATION.md` §§ 4-11.**

### 9.1 24-hour customer service window (CSW)

- The 24h CSW starts when the **customer** sends a message to the business.
- Free-form text/media/contacts/location/sticker/reaction/interactive can only be sent **inside** the CSW.
- Outside the CSW, only **approved templates** (and `template` messages) work; everything else returns error `131047`.
- **UI must:**
  - Render the service window pill in the chat header with live countdown.
  - When the window is closed, replace the composer with the amber "Reply window closed — send an approved template" banner + `Template` CTA.
  - On send failure with `131047`, auto-switch to template mode **without losing the draft**.
  - **Never** briefly show "window closed" due to client flicker (server is the only source of truth).
- **What we don't do:** client-side 24h recompute from the user's clock (defect #6 in master plan; fixed in P0).

### 9.2 No groups, no voice notes until built, no fake presence

| Capability | Meta status | UI implication |
|---|---|---|
| **Groups** | Cloud API does not support group messaging | The "Groups" chip from the mock is **removed** |
| **Voice notes (outbound)** | Supported in API (`audio` with `voice: true`) but no UI/permission flow yet | `Mic` icon hidden; revisit as P2 with MediaRecorder |
| **Video calls (outbound)** | Not supported on business side | `Video` icon removed; 5th header slot is `Bot` |
| **Stickers** | Supported (`webp`, 500KB) | Not yet exposed; add with sticker picker (P3) |
| **Reactions** | Supported (one emoji per message; replaces/removes when same emoji) | Not yet exposed; add with quick reaction picker (P3) |
| **Customer typing / online / last seen** | Not exposed in Cloud API | **Never simulate.** Only "X is viewing" for fellow agents (real `useConversationPresence`) |
| **Outbound voice calls (interactive)** | `call_permission_request` + `calling` module | Wire from `Phone` header icon (already exists) |
| **Location request** | `location_request_message` | Out of scope for Inbox |
| **Address (India)** | `address_message` (India only) | Out of scope for Inbox |
| **Carousel** | 2-10 cards, free-form | Out of scope for Inbox |
| **Marketing Messages Lite API** | Marketing-only, auto-optimised | Out of scope for Inbox |
| **Flows outbound** | `flow` interactive type | Out of scope; deep-link to `/flows` |

### 9.3 Media limits (UI must enforce before send)

| Type | Format | Max size | Caption |
|---|---|---|---|
| `image` | JPEG/PNG/WEBP | 5 MB | 1024 chars |
| `video` | MP4/3GPP | 16 MB | 1024 chars |
| `audio` | Opus (voice) or AAC/MP3/AMR/OGG | 16 MB | n/a |
| `document` | PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/TXT | 100 MB | optional filename |
| `sticker` | WEBP | 500 KB | n/a (1:1, 512×512) |

UI must validate before upload; show a friendly error "File too large. Max 5 MB for images." if exceeded.

### 9.4 Interactive caps

- Buttons: max 3 reply buttons OR 1 CTA URL (not both).
- List: max 10 sections, max 10 rows total.
- Title: 24 chars; row title 24 chars; description 72 chars; button 20 chars.
- The existing `InteractiveComposer.tsx` already enforces these.

### 9.5 Template rules

- Templates must be **pre-approved** by Meta; admin creates them in `/templates` and submits.
- The Inbox template picker (when window is closed) must show only **approved** templates.
- Quality flips GREEN/YELLOW/RED per template; surface this in the picker (e.g. "Marketing — quality: YELLOW, send carefully").
- Marketing templates can be downgraded to "Paused" by Meta via `message_template_status_update`; ship a quiet banner in the picker.

### 9.6 Quality rating tier surfacing

- Each phone number has GREEN/YELLOW/RED quality.
- Throughput tier depends on quality + verified business.
- The Inbox topbar / Settings should show the current tier (P1).
- Webhook `phone_number_quality_update` is the source; today we don't subscribe to it (gap §13.1 in Meta doc).

### 9.7 Per-conversation vs per-message pricing

- **Effective July 1, 2025**, Meta moved to **per-message** pricing for business-initiated template messages.
- Service (CSW) messages are **free** for the business.
- **Per-conversation pricing** was deprecated; the new model is per-template-message with category-based pricing.
- The Inbox UI does not need to display prices, but the **Settings → Usage** screen must be honest about it (P1).

### 9.8 Pair rate limit (the most common production bug)

- 1 message every 6 seconds per recipient; 45 messages in 6s burst then back-off.
- On `131056` (and `130429`), retry with **4^X** seconds.
- The current `messageQueue.add('retry-send', ..., { attempts: 4, backoff: { type: 'custom' } })` in `send.service.ts:204` is **almost right but does not implement 4^X exponential**. Fix in P0.

### 9.9 Webhook / inbound health

- Already shipped: red banner in `InboxListHeader.tsx:92-114` when `/api/whatsapp/webhook/health` reports unhealthy.
- Per workspace rule: **never green-badge a dead inbound.**
- Webhook signature verification: `meta.service.ts:verifyWebhookSignature` (already done).

### 9.10 Idempotency

- Dedupe inbound by `message.id` to prevent double-processing on Meta retries (today's `webhook.processor.ts` already handles arbitrary statuses; verify dedupe).
- Use the same `message.id` as `client_msg_id` for outbound to enable safe retries.

---

## 10. Missing-but-Important Features (priority-ranked)

> Each row: effort · depends-on · value · whether it can ship without backend work.

| # | Feature | Priority | Effort | Backend dep | Notes |
|---:|---|---|---|---|---|
| 1 | Drafts preserved per conversation | P0 | 0.5d | Yes (or localStorage) | Switch chats without losing the draft; master plan §Part 2 #1 |
| 2 | `markAsRead` to Meta (real blue ticks) | P0 | 0.5d | Yes (call `meta.service.ts:748`) | Customers see blue ticks when agents read |
| 3 | Load-earlier-messages (server cursor exists) | P0 | 0.5d | None (server `before` cursor exists) | "Load earlier" on scroll-top |
| 4 | Mark-as-unread (disabled tooltip) | P1 | 0.25d | Yes (POST `/inbox/:id/unread`) | Honest disabled state with "Coming soon" |
| 5 | New filter chips: Unreplied · Has ticket · Bot active | P1 | 1d | Partial | POC §4 recommends adding |
| 6 | Bulk snooze via `SnoozePopover` (replace hardcoded 1h) | P0 | 0.5d | None | `BulkSelectionBar.tsx:79-85` |
| 7 | Focus rings on all icon buttons (token) | P0 | 0.5d | None | §7.1 |
| 8 | `aria-live` log for thread + polite/alert regions | P0 | 0.5d | None | §7.5 |
| 9 | `prefers-reduced-motion` global guard | P0 | 0.25d | None | §3 / §7.7 |
| 10 | Skip-to-content link | P0 | 0.1d | None | §7.6 |
| 11 | Auto-focus first field in all modals | P0 | 0.5d | None | Extend from `CreateTicketModal` |
| 12 | Roving tabindex on chip row + conversation list | P0 | 0.5d | None | §7.4 |
| 13 | Stats row label rename to "First response" | P0 | 0.05d | None | Cosmetic |
| 14 | `formatAvgFirstResponse` already correct | P0 | 0d | None | Verified in `StatsRow.tsx:9-15` |
| 15 | Consolidate 3 assign-agent surfaces | P0 | 0.5d | None | One shared `AssignAgentPopover` |
| 16 | Hide "Mic" icon (already hidden) | P0 | 0d | None | `ChatComposer.tsx` already correct |
| 17 | Disable "Mark as unread" with tooltip | P1 | 0.1d | Yes | §8.3 |
| 18 | Drag-to-resize panes (with `separator` role) | P1 | 2d | None | WAI-ARIA pattern |
| 19 | ⌘K command palette (search + actions) | P1 | 1.5d | None | `GlobalSearch` exists; extend to actions |
| 20 | Keyboard shortcuts overlay (`?`) | P1 | 0.5d | None | §7.3 |
| 21 | Sound feedback (Settings-gated) | P2 | 0.5d | None | `Web Audio` ping on inbound, settings toggle |
| 22 | Bubble enter animation | P1 | 0.5d | None | §6 #1 |
| 23 | "N new messages" affordance (scrolled up) | P1 | 0.5d | None | §6 #2 |
| 24 | Skeleton → content cross-fade | P1 | 0.5d | None | §6 #9 |
| 25 | Multi-tab badge sync (`BroadcastChannel`) | P2 | 0.5d | None | `useInboxUnreadTotal` already exists |
| 26 | Hover preview card (150ms intent delay) | P2 | 2d | None | §6 (P2) |
| 27 | Message reactions (in & out) | P3 | 3d | Yes (Cloud API supports) | `reaction` message type |
| 28 | Voice notes with waveform (MediaRecorder) | P2 | 3d | None | §8.3 — only when real flow exists |
| 29 | WhatsApp Flows outbound (interactive) | P3 | 2d | Yes (Flows engine) | Deep-link to `/flows` |
| 30 | CRM integrations sidebar (HubSpot/Zoho) | P3 | n weeks | Yes | Out of scope for Inbox |
| 31 | Mobile app / PWA shell | P3 | n weeks | None | PWA with offline read-only |
| 32 | CSAT post-conversation (real, optional) | P2 | 1d | Yes (model + flow) | Only after schema migration; never fake |
| 33 | SLA policies + breach alerts | P2 | 1w | Yes (policies engine) | Row badge already shows; ship full chip + breach toast |
| 34 | Auto-assignment / round-robin | P3 | 1w | Yes | Settings → Teams |
| 35 | Contact dedupe (per phone) | P2 | 1d | Yes | Inline prompt on Contact save |
| 36 | Custom fields per contact (key-value) | P2 | 1w | Yes (schema `customFields Json`) | Phase 1: use `tags` |
| 37 | ⌘K navigation (jump to contacts/tickets) | P2 | 1d | None | §10 #19 |
| 38 | Drag-to-resize persistence (`localStorage`) | P1 | 0.5d | None | §5.2 |
| 39 | Pull-to-refresh (mobile) | P2 | 0.5d | None | §5.3 |
| 40 | Markdown export of conversation | P2 | 0.5d | None | In addition to TXT/JSON |

---

## 11. Implementation Roadmap (re-prioritized)

### P0 — Visual fidelity + honesty + a11y baseline (1-2 days, **blocks ship**)

| # | Item | File:line | Verify |
|---:|---|---|---|
| 1 | Remove unconditional "SLA" chip | `InboxListHeader.tsx:280-292` | Chip hidden when no SLA data |
| 2 | Move connection pill to title row | `InboxListHeader.tsx:130-134` | Pill left of "Chats" at 1280px |
| 3 | Topbar subtitle contrast | `AppTopbar.tsx:113` | Lighthouse contrast ≥ 4.5:1 |
| 4 | Cap "Live" pill height | `AppTopbar.tsx:108-110` | Pill ≤ 20px tall |
| 5 | Bump chat header + composer bar height | `ChatHeader.tsx:172`, `ChatComposer.tsx:94` | Bars ≥ 64px effective |
| 6 | Service-window pill sentence case | `ServiceWindowBanner.tsx:78-89` | Renders "Can reply · 3h 12m left" |
| 7 | Selected row wash lighter | `ConversationItem.tsx:74` | `bg-emerald-50/80` |
| 8 | Row height 72 | `ConversationList.tsx:10` | `ROW_HEIGHT = 72` |
| 9 | Remove inline assignee in chat header | `ChatHeader.tsx:190-196` | Header shows name + phone only |
| 10 | Placeholder hint "Press R" | `ChatPlaceholder.tsx:5-7` | Hint matches shortcut |
| 11 | Bulk snooze via `SnoozePopover` | `BulkSelectionBar.tsx:79-85` + `InboxPage.tsx:418-423` | Snooze picker opens |
| 12 | Consolidate 3 assign surfaces | header overflow + details + context menu | One shared `AssignAgentPopover` |
| 13 | Floating black toolbar in Image B — confirm with user | (unowned) | Screenshot regression or close the issue |
| 14 | `markAsRead` to Meta on `POST /:id/read` | `meta.service.ts:748`, call site in `inbox/routes.ts` | Customers get blue ticks |
| 15 | Retry-with-4^X backoff on `131056` / `130429` | `send.service.ts:204` | Sends succeed after backoff |
| 16 | Drafts preserved per conversation | `InboxPage.tsx` (state) | Switch chat → return → draft intact |
| 17 | Load-earlier-messages on scroll-top | `ChatThread.tsx` + `inboxApi.messages(before)` | Older messages load on click |
| 18 | Focus rings on all icon buttons (token) | global CSS / shared class | Tab through full page, all rings visible |
| 19 | `aria-live="polite"` thread + `role="alert"` failures | `ChatThread.tsx` | NVDA announces new messages |
| 20 | Skip-to-content link | `PageShell.tsx` | Skip link visible on focus |
| 21 | `prefers-reduced-motion` global guard | `client/src/index.css` | Toggle OS setting → all loops stop |
| 22 | Roving tabindex on chip row | `InboxListHeader.tsx` | Arrow keys move active chip |
| 23 | Auto-focus first field in all modals | NewChat, Payment, Export, Interactive | First input focused on open |
| 24 | `aria-modal="true"` on all dialogs/sheets | media viewer + 4 modals | NVDA reads "dialog" |
| 25 | Bubble enter animation (CSS only) | `MessageBubble.tsx` | Bubbles fade-in 180ms |
| 26 | "N new messages" affordance (scrolled up) | `ChatThread.tsx` | Sticky button, click → smooth scroll |
| 27 | "Connect WhatsApp" empty state polish | `InboxListEmpty.tsx` | Calm, clear CTA |
| 28 | Skeleton → content cross-fade | `ConversationList.tsx`, `StatsRow.tsx` | 120ms fade swap |
| 29 | Mobile single-pane polish (back button, safe-area) | `InboxPage.tsx`, `ChatComposer.tsx` | 375px flow works |
| 30 | Tablet 768-1023px icon rail | `InboxDetailsPanel.tsx:586-648` | `md:flex` shows rail |

**Verification commands:**

```bash
# Typecheck
cd client && npx tsc --noEmit
# Lint
cd client && npx eslint src/components/inbox src/components/layout/AppTopbar.tsx
# Build
cd client && npm run build
# Manual: Lighthouse a11y score ≥ 95
# Manual: Tab through full Inbox — every interactive element gets a visible ring
# Manual: NVDA/VoiceOver reads new messages on inbound
# Manual: Set OS reduced motion → all loops stop, instant state changes
# Manual: At 375 / 768 / 1024 / 1280 / 1440 / 1920 → no horizontal scroll
```

### P1 — Productivity + responsive + micro-interactions (2-3 days)

| # | Item | Notes |
|---:|---|---|
| 1 | New filter chips: Unreplied · Has ticket · Bot active | POC §4 |
| 2 | Mark-as-unread (disabled tooltip) | "Coming soon — API support in progress" |
| 3 | Drag-to-resize panes with `separator` role | WAI-ARIA pattern, persist to `localStorage` |
| 4 | ⌘K command palette (search + actions) | Extend `GlobalSearch` |
| 5 | Keyboard shortcuts overlay (`?`) | R / D / S / T / K / ↑↓ / Enter / Esc / Space / M |
| 6 | Auto-focus first field in remaining modals | §11 P0 #23 if not done |
| 7 | Bubble status tick appear (delayed fade) | §6 #4 |
| 8 | List-header collapse on scroll | Sticky chip row, title shrinks |
| 9 | Skeleton → content cross-fade (full coverage) | §6 #9 |
| 10 | Multi-tab badge sync via `BroadcastChannel` | `useInboxUnreadTotal` |
| 11 | Sound feedback (Settings-gated) | `Web Audio` ping |
| 12 | Stats row label rename to "First response" | Cosmetic |
| 13 | Drag-to-resize persistence | §10 #38 |
| 14 | Toast system: undo + duration rules | §10 (P1) |
| 15 | Pull-to-refresh (mobile) | §5.3 |
| 16 | Background job status (export) | "Export started" → "Completed" |

**Verification:** Run full P0 verification list + smoke test command palette, keyboard shortcuts, drag-resize.

### P2 — Delight (1-2 weeks)

| # | Item | Notes |
|---:|---|---|
| 1 | Voice notes with waveform (MediaRecorder + permission) | Only when flow is real |
| 2 | Quote / reply (`context.message_id`) | Cloud API supports; UI must add quote bar |
| 3 | Hover preview card (150ms intent delay) | §6 (P2) |
| 4 | Bubble enter animation (full coverage: every message type) | §6 #1 |
| 5 | Skeleton → content cross-fade (full coverage) | §6 #9 |
| 6 | Multi-tab badge sync | §10 #25 |
| 7 | Markdown export | In addition to TXT/JSON |
| 8 | SLA policies + breach alerts | Full chip + breach toast |
| 9 | CSAT post-conversation (real) | Only after schema |
| 10 | Contact dedupe (per phone) | Inline prompt on save |
| 11 | Custom fields per contact (key-value) | After `customFields Json` migration |
| 12 | Swipe row actions (mobile) | Always expose equivalent in kebab |

### P3 — Long-term

| # | Item | Notes |
|---:|---|---|
| 1 | Message reactions (Meta + UI) | `reaction` message type, quick-reaction picker |
| 2 | Customer-side quick-reactions on agent's message | Same as #1 |
| 3 | AI bot reply 3-dot typing indicator | Only when real signal exists |
| 4 | SLA surfacing (full `slaDueAt` UI) | Row chip + filter chip + breach toast |
| 5 | Webhook health sidebar indicator | Per workspace rule |
| 6 | "Linked contact" deep-link from right pane | Link to `/contacts/:id` |
| 7 | Native mobile swipe-back (chat → list) | iOS-style edge gesture |
| 8 | WhatsApp Flows outbound (interactive) | Deep-link to `/flows` |
| 9 | Auto-assignment / round-robin | Settings → Teams |
| 10 | CRM integrations | HubSpot / Zoho sidebar |
| 11 | Mobile app / PWA shell | Offline read-only |

---

## 12. Confidence Score Sheet (final)

| Dimension | Today | After P0 | After P1 | After P2 |
|---|---:|---:|---:|---:|
| UI fidelity to mock | 6.5 | **8.5** | **9.0** | 9.5 |
| Honesty (no fake data) | 9.0 | **9.5** | **9.8** | 9.9 |
| Functional completeness | 7.0 | **8.5** | **9.0** | 9.5 |
| Motion | 4.0 | **6.5** | **7.5** | 8.5 |
| A11y (WCAG 2.2 AA) | 3.5 | **7.0** | **8.0** | 9.0 |
| Responsive | 5.5 | **7.0** | **8.5** | 9.0 |
| Meta compliance | 9.5 | **9.8** | **9.8** | 9.9 |
| **Production-ready for 1k-2k customers** | **6.5** | **8.5** | **9.0** | **9.5** |

The jump from 6.5 → 8.5 happens in P0 (1-2 days). The remaining 1.0 comes from P1 (productivity) and P2 (delight).

---

## 13. Verification Checklist (the "what to test before shipping")

> Every box must be checked before a P0/P1 release.

### 13.1 Responsive widths
- [ ] **375** (iPhone SE) — single-pane, list only, then full-screen chat with back, details as bottom sheet, composer above safe-area, no horizontal scroll
- [ ] **390** (iPhone 13/14) — same as 375 with breathing room
- [ ] **768** (iPad portrait) — two-pane (list + thread), no details unless overflow opens sheet
- [ ] **820** (iPad landscape) — two-pane with overflow for details
- [ ] **1024** (small desktop) — three-pane with **collapsed icon rail**
- [ ] **1280** (desktop) — three-pane with expanded details
- [ ] **1440** (large desktop) — comfortable three-pane
- [ ] **1920** (extra large) — list capped at 420px, thread text line length capped ~80 chars

### 13.2 Keyboard
- [ ] **Tab + Shift+Tab** through full page — no focus traps, every interactive element reachable, no skipped controls
- [ ] **Arrow ↑/↓** in conversation list — moves active row
- [ ] **Home/End** jumps to first/last conversation
- [ ] **Enter** opens selected conversation
- [ ] **Esc** closes current overlay / returns focus to opener
- [ ] **R** focuses the search input
- [ ] **D** opens/closes details panel
- [ ] **S** opens snooze popover
- [ ] **T** opens template composer
- [ ] **?** opens keyboard shortcuts overlay (P1)

### 13.3 Screen readers
- [ ] **VoiceOver (macOS / iOS)** — new messages announced, modal `dialog` announced, list rows have accessible names, status changes announced
- [ ] **NVDA (Windows)** — same as above
- [ ] Live region for new messages — first paint does not re-read entire thread
- [ ] All icon-only buttons have `aria-label`
- [ ] All form fields have associated `<label>` or `aria-label`
- [ ] Heading hierarchy is correct (h1 topbar, h2 list, h3 details)

### 13.4 Reduced motion
- [ ] Toggle OS setting → all loops stop (skeleton, animate-ping, animate-spin, modal slide-in)
- [ ] State changes still visible (instant background/color changes, focus rings still show)
- [ ] No flashing content

### 13.5 Honesty states
- [ ] **Loading** — skeleton mirrors final geometry; spinner only on isolated actions
- [ ] **Error** — user-facing error message with Retry; no silent failures
- [ ] **Empty** — three variants (filtered / connected-empty / not-connected); clear CTA
- [ ] **Disconnected** — red banner; never green-badge a dead inbound

### 13.6 Color contrast
- [ ] All body text ≥ 4.5:1
- [ ] All large text ≥ 3:1
- [ ] All UI component boundaries (borders, icons, state indicators) ≥ 3:1
- [ ] Topbar subtitle (was failing) now passes
- [ ] Run Lighthouse a11y score ≥ 95

### 13.7 Hover / focus / active / selected / disabled
- [ ] Every interactive element has all 5 states visually distinct
- [ ] Hover unavailable on touch (`@media (hover: hover)`)
- [ ] Focus never removed (`outline: none` not used without replacement)
- [ ] Selected row has non-color cue (`aria-current` + 2px left indicator)
- [ ] Disabled controls remain readable (no opacity below 0.4)

### 13.8 No legacy dialogs
- [ ] `rg "prompt\(|alert\(|confirm\(" client/src/components/inbox` returns **0 matches**
- [ ] All ticket / payment / export flows use real modals
- [ ] All snooze flows use the popover (no hardcoded `+1h`)

### 13.9 No fake data
- [ ] **No** "4.8 Satisfaction" anywhere — confirmed in `StatsRow.tsx:62-71`
- [ ] **No** "Groups" chip — removed per plan §Part 5 #1
- [ ] **No** customer typing/online/last-seen UI — Meta exposes none
- [ ] **No** "Mark as unread" silently absent — must be a disabled "Coming soon" tooltip
- [ ] **No** voice notes UI — `Mic` icon hidden
- [ ] **No** video-call icon — replaced by `Bot` toggle
- [ ] **No** unconditional SLA chip — hidden until real SLA data

### 13.10 Meta compliance
- [ ] 24h window pill shows live countdown; auto-switches composer on expiry
- [ ] On `131047`, composer auto-switches to template mode, draft preserved
- [ ] On `131056`, retry with `4^X` backoff
- [ ] Webhook health banner appears when `/api/whatsapp/webhook/health` reports unhealthy
- [ ] All webhook fields subscribed: `messages`, `message_template_status_update`, `message_template_quality_update`, `phone_number_quality_update`, `account_alerts` (per §9)
- [ ] All inbound messages deduped by `message.id`
- [ ] All outbound messages use `client_msg_id` for safe retries

### 13.11 Performance
- [ ] Conversation list **virtualized** — scroll at 1k chats at 60fps
- [ ] Cursor pagination on `lastMessageAt,id` (uses existing index)
- [ ] Media uses **short-lived signed URLs** + client cache map
- [ ] Surgical socket updates — no full-list refetch on `message:new`
- [ ] First contentful paint of Inbox < 1.5s on a 1k-chat workspace
- [ ] No layout shifts (CLS) when new bubbles arrive

### 13.12 Operational
- [ ] `curl -s http://localhost:8000/api/whatsapp/webhook/health` returns `ok` when tunnel is up
- [ ] Inbound test: send a WhatsApp message from a phone → appears in Inbox within 2s
- [ ] Outbound test: send a message from Inbox → delivered to phone (blue ticks when read)
- [ ] Reconnect test: kill tunnel → red banner within 5s; restore → green within 10s
- [ ] Window test: wait 24h (or use a date-override) → composer auto-switches to template

---

## 14. Quick-Reference: file:line × fix matrix

| File:line | What it is | What changes |
|---|---|---|
| `InboxListHeader.tsx:130-134` | Connection indicator placement | Move to title row, render as pill |
| `InboxListHeader.tsx:280-292` | Unconditional SLA chip | Remove; gate on real `slaBreached > 0` |
| `InboxListHeader.tsx:293-305` | Trailing `+` duplicates Filters | Repurpose to "Save current view" |
| `InboxListHeader.tsx:243-306` | Chip row | Add `role="tablist"` + roving tabindex |
| `ConversationList.tsx:10` | Row height | `const ROW_HEIGHT = 72;` |
| `ConversationList.tsx:96-104` | Skeleton → list swap | Add 120ms cross-fade |
| `ConversationItem.tsx:74` | Selected row wash | `bg-emerald-50/80 dark:bg-emerald-950/40` |
| `ConversationItem.tsx:24-47` | Row SLA badge | Already conditional; verify schema |
| `ChatHeader.tsx:48-82` | `HeaderIconButton` | Add `focus-visible:outline-2 focus-visible:outline-emerald-700` |
| `ChatHeader.tsx:172` | Header bar height | `py-3.5` |
| `ChatHeader.tsx:190-196` | Inline assignee in header | Remove (move to right pane) |
| `ChatHeader.tsx:200-265` | 6 icon buttons | Verify focus rings, ARIA labels |
| `ChatHeader.tsx:281-336` | Inline assign popover | Extract to shared `AssignAgentPopover` |
| `ChatHeader.tsx:362-363` | Missing "Mark as unread" | Disabled "Coming soon" tooltip |
| `MessageBubble.tsx:305-346` | Bubble render | Add enter animation; failed-retry already shipped |
| `MessageBubble.tsx:351` | Bubble max width | OK; cap text at 80 chars on 1920px |
| `ChatThread.tsx:262-298` | Handoff/flow/AI banners | Add fade-in animation |
| `ChatThread.tsx:317-319` | Thread padding | OK |
| `ChatThread.tsx:393-411` | Window-closed banner | Add fade-in 200ms |
| `ChatComposer.tsx:41-49` | `ComposerSkeleton` | Add `motion-reduce` guard |
| `ChatComposer.tsx:91-94` | Composer bar height | `py-3.5` |
| `ChatComposer.tsx:130-147` | Canned-reply autocomplete | Add 120ms opacity reveal |
| `ChatComposer.tsx:151-168` | Plus button | Keep rotate-45; add focus-visible |
| `ChatComposer.tsx:170-228` | Attach menu | Add micro-spring open |
| `ChatComposer.tsx:233` | Input pill | `focus-within` ring already present |
| `InboxDetailsPanel.tsx:257-267` | "Customer Details" header | OK |
| `InboxDetailsPanel.tsx:272-317` | Assign in details | Extract to shared popover |
| `InboxDetailsPanel.tsx:321-410` | Labels section | OK |
| `InboxDetailsPanel.tsx:427-501` | Notes | OK |
| `InboxDetailsPanel.tsx:503-555` | Custom attributes | Phase 1: `tags`; P1: `customFields Json` |
| `InboxDetailsPanel.tsx:570-584` | Mobile sheet overlay | Add drag handle (P1) |
| `InboxDetailsPanel.tsx:586-648` | Collapsed icon rail | `md:flex` (not just `lg:flex`) |
| `InboxDetailsPanel.tsx:652` | Expanded aside | `md:flex` |
| `details/StatsRow.tsx:9-15` | `formatAvgFirstResponse` | Keep; correct |
| `details/StatsRow.tsx:62-71` | 3 stat chips | Keep; mock is wrong |
| `details/ProfileCard.tsx:11-37` | Profile card | OK |
| `details/QuickActions.tsx:54-97` | Quick actions | OK; check focus rings |
| `details/AutomationsSection.tsx:33-81` | Active automations | OK |
| `AppTopbar.tsx:85-228` | Topbar | Subtitle contrast + Live pill size |
| `AppTopbar.tsx:104-117` | Title + Live + subtitle | Fix contrast (2.E) |
| `AppTopbar.tsx:124-141` | Search bar (⌘K) | OK; extend palette to actions (P1) |
| `AppTopbar.tsx:165-167` | User chip | OK |
| `index.css:947-975` | Inbox shell | OK |
| `index.css:1038-1055` | `inbox-skeleton-shimmer` | Add `motion-reduce` guard |
| `index.css:1057-1103` | Modal slide-in/fade | Add `motion-reduce` guard |
| `index.css:1167-1184` | Chat background wallpaper | Add setting to disable (P2) |
| `index.css:1221-1239` | Popover keyframes | Add micro-spring (P1) |
| `BulkSelectionBar.tsx:30-95` | Bulk bar | Open `SnoozePopover` instead of 1h |
| `BulkSelectionBar.tsx:79-85` | Snooze 1h | Replace with popover |
| `ChatPlaceholder.tsx:5-7` | Hint | "Press R to find chats" |
| `useSocket.ts:147` | `conversation:snooze` event | Add resurface logic |
| `useInboxRealtime.ts` | Socket handlers | Surgical updates (master plan P0 #1) |
| `useInboxUnreadTotal` | Unread total | Hook up sidebar badge |
| `ConversationList.tsx:156` | `measureElement` | OK |
| `MessageBubble.tsx:78` | Blue read tick | OK |
| `MessageBubble.tsx:370-394` | Failed-retry | OK (shipped) |
| `useConversationPresence.ts` | Viewers hook | OK |
| `SnoozePopover.tsx` | Snooze popover | Add micro-spring (P1) |
| `ConnectionStatusIndicator.tsx:51-65` | Indicator | Use same signal as banner (2.G) |
| `useWebhookHealth.ts` | Webhook health | OK |
| `ChatContextMenu.tsx:38-49` | Context menu | Use shared `AssignAgentPopover` |
| `inbox/routes.ts` (server) | `POST /:id/read` | Call `meta.service.ts:748` to mark read |
| `send.service.ts:204` (server) | Retry queue | Implement `4^X` backoff on `131056` / `130429` |
| `meta.service.ts:726` (server) | Webhook subscription | Add `message_template_status_update`, `message_template_quality_update`, `phone_number_quality_update`, `account_alerts` |
| `meta.service.ts:748` (server) | `markAsRead` | Call from `POST /:id/read` |
| `schema.prisma` (server) | `Contact.customFields` (optional) | Add `Json @default("{}")` for true key-value (P2) |
| `schema.prisma` (server) | `Conversation.isFavorite` | `Boolean @default(false)` (already exists per `Conversation.isFavorite` in `ChatHeader.tsx:239`) |

---

## 15. Definition of Done (per phase)

### P0 done = all of:

- [ ] All 30 P0 items completed and verified (§11)
- [ ] Lighthouse a11y ≥ 95
- [ ] No `prompt()` / `alert()` / `confirm()` in inbox code (`rg` returns 0)
- [ ] All 4 honesty states (loading / error / empty / disconnected) visually distinct and tested
- [ ] At 375 / 768 / 1024 / 1280 / 1440 / 1920 widths, no horizontal scroll
- [ ] Tab + Shift+Tab through full Inbox — every interactive element reachable, focus rings visible
- [ ] VoiceOver/NVDA reads new messages, dialogs, status changes
- [ ] `prefers-reduced-motion` honored
- [ ] Connection pill position fixed
- [ ] SLA chip removed
- [ ] Topbar subtitle contrast passes WCAG AA
- [ ] Service-window pill sentence case
- [ ] Selected row wash lighter
- [ ] `markAsRead` to Meta wired (customers see blue ticks)
- [ ] Drafts preserved per conversation
- [ ] Load-earlier-messages works
- [ ] Bubble enter animation + "N new messages" affordance
- [ ] `aria-live` thread + role="alert" failures
- [ ] Skip-to-content link
- [ ] Floating black toolbar (Image B) confirmed with user
- [ ] Code merged to main, typecheck clean, build green

### P1 done = all of P0 +:

- [ ] All 16 P1 items completed and verified
- [ ] New filter chips working (Unreplied · Has ticket · Bot active)
- [ ] Drag-to-resize panes with `separator` role + `localStorage` persistence
- [ ] ⌘K command palette (search + actions)
- [ ] Keyboard shortcuts overlay (`?`)
- [ ] Mark-as-unread (disabled tooltip)
- [ ] All modals auto-focus first field
- [ ] Sound feedback (Settings-gated)
- [ ] Bubble status tick appear (delayed fade)
- [ ] List-header collapse on scroll
- [ ] Multi-tab badge sync (`BroadcastChannel`)

### P2 done = all of P1 +:

- [ ] Voice notes (with real MediaRecorder flow)
- [ ] Quote / reply
- [ ] Hover preview card
- [ ] Markdown export
- [ ] SLA policies + breach alerts (full)
- [ ] CSAT post-conversation (real)
- [ ] Contact dedupe
- [ ] Custom fields per contact
- [ ] Swipe row actions (mobile)

### P3 done = all of P2 +:

- [ ] Message reactions
- [ ] WhatsApp Flows outbound
- [ ] Auto-assignment / round-robin
- [ ] CRM integrations
- [ ] Mobile app / PWA shell

---

## 16. Glossary

- **CSW** — Customer Service Window (the 24h window that opens when a customer messages the business)
- **ETA / ETag** — HTTP caching
- **HCW** — (not used; CSW is the canonical term)
- **CSAT** — Customer Satisfaction (post-conversation rating; we do not fake this)
- **P1, P2, P3** — Priority levels
- **Tri-state** — three states: `undefined` (loading → skeleton), `OPEN` (composer), `CLOSED` (template banner)
- **Honest feedback** — UI feedback that reflects actual server state, not a guess or a fake
- **Surgical update** — updating one row/conversation without re-fetching the whole list
- **Mock** — the LLM-generated design image at `ui design/ChatGPT Image Aug 2, 2026, 12_25_40 PM.png`
- **Pixel diff** — `docs/audit/INBOX_PIXEL_DIFF.md` (47 findings, 5 already partial)
- **Motion doc** — `docs/INBOX_MOTION_RESPONSIVE_RESEARCH.md`
- **POC** — `docs/ui-specs/inbox-content-poc.md`
- **Meta doc** — `docs/WHATSAPP_API_DOCUMENTATION.md`
- **Master plan** — `inbox-redesign_f8ecc995.plan.md`

---

*This document is the single source of truth for the Samyoj Inbox redesign. Future contributors must read this before touching the Inbox. When the master plan or pixel diff is updated, this document is the synthesis that drives implementation order.*
