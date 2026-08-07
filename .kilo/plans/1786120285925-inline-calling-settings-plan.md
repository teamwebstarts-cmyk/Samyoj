# Plan: Pixel-Perfect Calling Settings UI in Calls Page Center Stage

## Goal
Replace the center "chat/call-detail" stage in the Calls page with the full calling customization UI — matching the reference design (image 1) pixel-perfectly. Layout: **history list (left) · settings config (center) · rail icons (right)**. Cancel/close returns to the chat.

## Reference Design Analysis (Image 1)
- **Left sidebar** (narrow, ~200px): icon + label items with subtle borders, active state has emerald left border + light bg
- **Main content area**: "Who answers calls" title + subtitle, then option cards
- **Option cards** (radio-select): clean borders (1px neutral-200), rounded-xl, generous padding (py-4 px-5), icon in colored circle (green/blue/amber), title, "Recommended" pill (green bg, white text, rounded-full, px-2 py-0.5, text-[10px] font-bold uppercase), description text, tags/pills, radio circle (border-2, 16px, selected = filled green)
- **Right "How it works" panel**: light mint/emerald bg (#f0fdf4 / emerald-50), rounded-2xl, numbered circles (emerald-600 bg, white text, h-5 w-5), clean step text
- **Bottom bar**: Reset default (left, ghost button) | Cancel (secondary, white bg, border) | Save changes (primary, emerald-600 bg, white text, rounded-lg, px-4 py-2)
- **Typography**: Inter/system font, tight tracking, clear hierarchy (title 18px extrabold, subtitle 13px medium, labels 12px bold, helper 11px medium)
- **Spacing**: Generous whitespace, consistent 4px/8px/12px/16px rhythm, max-width constraints on content

## Current State
- `CallingSettingsForm.tsx`: extracted form (already exists) with nav + content + footer, but styling doesn't match reference
- `CallingSettingsPanel.tsx`: thin wrapper for Settings page
- `CallingSettingsStage.tsx`: center-stage wrapper (already exists, needs header styling refinement)
- `CallsRailPanel.tsx`: help-only side panel
- `CallsPage.tsx`: renders `CallingSettingsStage` in center when `railPanel === 'settings'`

## What Needs to Change (Styling Overhaul)

### 1. `CallingSettingsForm.tsx` — Full styling rewrite to match reference

**SectionNav (left sidebar):**
- Width: `w-[200px] shrink-0` on desktop, horizontal scroll on mobile
- Items: `px-3 py-2.5 rounded-xl text-[12px] font-bold gap-2.5`
- Active: `bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300`
- Inactive: `text-neutral-600 hover:bg-neutral-50`
- Icon: `h-4 w-4`
- Border-bottom separator between sections? No — clean spacing only
- "Setup guide" link: `mt-auto pt-4 text-[11px] text-neutral-500 hover:text-emerald-700`

**Main content area:**
- Max-width: `max-w-2xl` or flexible with `flex-1`
- Section titles: `text-[18px] font-extrabold tracking-tight text-theme-fg`
- Subtitles: `text-[13px] font-medium text-theme-muted mt-1`
- Cards: `rounded-xl border border-neutral-200 bg-white p-5 hover:border-neutral-300 transition-all`
- Selected card: `border-emerald-400 ring-1 ring-emerald-200 bg-emerald-50/30`
- Card inner layout: flex row, icon left (h-11 w-11 rounded-xl), content middle, radio right

**WhoCard refinements:**
- Icon container: `h-11 w-11 rounded-xl flex items-center justify-center`
- Title: `text-[14px] font-bold text-theme-fg`
- Description: `text-[12px] font-medium text-theme-muted mt-1`
- Tags: `rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600`
- Recommended pill: `rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800`
- Radio circle: `h-4 w-4 rounded-full border-2`, selected = `border-emerald-600 bg-emerald-600`
- Card padding: `p-5` (up from `p-3.5`)

**HowItWorks panel (right aside):**
- Container: `rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5`
- Title: `text-[12px] font-extrabold text-emerald-900 dark:text-emerald-300`
- Steps: `mt-3 space-y-3`
- Number circle: `h-5 w-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center`
- Step text: `text-[12px] font-medium text-neutral-700 dark:text-neutral-300 pl-2`
- On mobile (`< xl`): render below content with `mt-4`

**SectionFrame:**
- Grid: `grid gap-6 xl:grid-cols-[1fr_240px]` (main + aside)
- Content padding: consistent `space-y-4`

**Footer:**
- Container: `flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-3.5`
- Reset default: `text-[12px] font-medium text-neutral-500 hover:text-neutral-700`
- Cancel: `px-4 py-2 rounded-lg border border-neutral-200 bg-white text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50`
- Save changes: `px-4 py-2 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 shadow-sm`
- Disabled Save: `opacity-50 cursor-not-allowed`

**Form-level wrapper:**
- Outer: `flex flex-col h-full`
- Scroll area: `flex-1 overflow-y-auto`
- Padding: `p-5 sm:p-6`

### 2. `CallingSettingsStage.tsx` — Header styling refinement
- Header bar: `flex items-center justify-between border-b border-neutral-200 px-5 py-3.5`
- Title: "Customize calls" — `text-[15px] font-extrabold tracking-tight`
- Subtitle: `text-[12px] font-medium text-theme-muted mt-0.5`
- Back button: `inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-[12px] font-semibold hover:bg-neutral-50`
- Chevron: `h-4 w-4`
- The form below gets `flex-1 overflow-hidden` so its internal scroll takes over

### 3. `CallsRailPanel.tsx` — No change needed (already help-only)
- Keep as-is

### 4. `CallsPage.tsx` — No change needed
- Stage routing already correct

### 5. `CallingSettingsPanel.tsx` — No change needed
- Already thin wrapper

## Files to Modify

| File | Changes |
|------|---------|
| `client/src/components/calls/CallingSettingsForm.tsx` | Full CSS class overhaul on SectionFrame, HowItWorks, WhoCard, BehaviorRow, DeepLinkCard, section nav, footer, and wrapper padding |
| `client/src/components/calls/CallingSettingsStage.tsx` | Minor header styling polish |

## Validation Criteria
1. Open Calls page → click Settings icon → center shows settings with reference design quality
2. "Who answers" section shows three clean cards with proper radio selection, "Recommended" pill, tags
3. "How it works" panel visible on desktop right side, clean mint background + numbered circles
4. Section sidebar (left) shows all 9 items, active state highlighted
5. Footer shows Reset default | Cancel | Save changes with correct button styles
6. Click "Calls" back button → returns to call detail/chat
7. Settings → Calling tab still works (backward compat)
8. Responsive: mobile stacks nav on top, content below, footer sticky

## Risks
| Risk | Mitigation |
|------|-----------|
| Center stage overflow on small screens | Form has `flex-1 overflow-y-auto`, header is `shrink-0` |
| Styling conflicts with existing theme vars | Use existing `text-theme-fg`, `text-theme-muted`, `dark:` variants consistently |
| Footer visibility | Sticky within form's flex column (`shrink-0` at bottom) |
