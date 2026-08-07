# Plan: Inline Calling Settings in Calls Page Rail

## Goal
Embed the full calling customization UI directly into the Calls page rail panel so users configure who answers, greetings, voice, and all calling behavior without leaving the Calls screen. Same 9-section content and quality as Settings → Calling. No redirects to `/settings`.

## Current State (verified against code)
- `CallingSettingsPanel.tsx` (800 lines): owns ALL state + API calls + renders the form content, and passes the **Save / Cancel / Reset default** footer into `SettingsPanel`'s `footer` prop. Used ONLY by `SettingsPage.tsx` line 939 (`{activeTab === 'calling' && <CallingSettingsPanel />}`).
- `SettingsPanel.tsx`: a full-page "dashboard card" with gradient header, body (`p-4 sm:p-5`), and optional `footer` slot. NOT suitable to nest inside a 280px rail (it's page chrome).
- `CallsRailPanel.tsx`: slide-out panel with its own `PanelHeader` (title + X) and a single `overflow-y-auto` body. `SettingsBody` (lines 94–130) only shows links → `/settings?tab=calling`, `/ai-bot`, setup. Panel widths: `md:w-[260px] lg:w-[280px]` (help), `w-[min(100%,300px)]` mobile.
- `CallsPage.tsx` line 611–617: mounts `CallsRailPanel` with `panel={railPanel}` ('settings' | 'help' | null). `toggleRail` allows only one open at a time.
- Form internals: `<div className="flex flex-col gap-5 lg:flex-row lg:gap-6">` → section nav `lg:w-[200px]` + main. Below `lg` the nav is a **horizontal scroll row** (`overflow-x-auto`). "How it works" aside uses `xl:grid-cols-[1fr_220px]` and is hidden until `xl` viewport. So inside a narrow rail the form already degrades to a stacked layout (nav on top, content below) — good, no new responsive code strictly needed.
- `AiBotPage.tsx:1231` links to `/settings?tab=calling&section=behavior` (URL only, not the component) — must keep that route working.
- `CallingSettingsSkeleton` exists and is imported by the form for loading state.

## Key Correction vs. Prior Plan
Prior plan said "keep footer inside the form" but the code puts the footer in `CallingSettingsPanel`'s `SettingsPanel footer` prop. **Resolution: move the Save/Cancel/Reset footer INTO `CallingSettingsForm`** so it renders in both contexts. `CallingSettingsPanel` then renders `<SettingsPanel title/desc>{<CallingSettingsForm/>}</SettingsPanel>` with NO footer prop (avoids duplicate footers). The form's footer becomes a **sticky bottom bar** within its own container.

## Design Decisions (resolve these)

### D1. Presentation style (ASK USER — recommended: wide rail)
- **Recommended: Inline wide rail.** Clicking Settings widens the rail to `md:w-[480px] lg:w-[520px]`, shows the full 9-section form with a sticky Save/Cancel footer. Page chrome (list + stage) stays visible behind it.
- Alternative: Full-page overlay/modal (covers the Calls page). More room but breaks "stays in calls" feel and is heavier.
- The form's native responsive layout already supports a 480–520px width (stacked nav-on-top). No new layout CSS needed beyond width + sticky footer.

### D2. Keep or remove Settings → Calling tab
- **Recommended: KEEP** the tab but have it render the same shared `CallingSettingsForm` (via thin `CallingSettingsPanel`). Preserves `AiBotPage` deep link and bookmarks. Optionally add a small note "Edit these in Calls → Customize".
- Not removing avoids breaking `AiBotPage.tsx:1231`.

### D3. Section deep-linking in rail
- In the rail, section state is local (default `'who'`). `useSearchParams` reading moves to `CallingSettingsPanel` only; it passes `initialSection` to the form. Rail ignores URL.

## Files to Modify / Create

### 1. CREATE `client/src/components/calls/CallingSettingsForm.tsx`
Extract from `CallingSettingsPanel.tsx`:
- Types: `CallingSettings` interface, `SectionId`, `defaultSettings`, `SARVAM_SPEAKERS`, `SARVAM_LANGUAGES`, `RING_PRESETS`, `SECTIONS`.
- Logic: all `useState`/`useEffect` (load settings + bots), `dirty` memo, `handleSave`, `handlePreviewVoice`, `handleReset`, `handleCancel`.
- Helpers: `howItWorks`, `applyWhoAnswers`.
- Sub-components: `SectionFrame`, `HowItWorks`, `WhoCard`, `BehaviorRow`, `DeepLinkCard`.
- Render: the `<div className="flex flex-col gap-5 lg:flex-row">` block (all 9 sections) **plus** a **sticky footer** (`sticky bottom-0 ... Save changes / Cancel / Reset default`) so it works inside the rail.
- Props: `{ initialSection?: SectionId }`. Default `'who'`.
- Loading: `if (loading) return <CallingSettingsSkeleton />;`
- Export `CallingSettingsForm` and `type CallingSettings`.

### 2. REFACTOR `client/src/components/calls/CallingSettingsPanel.tsx`
- Imports `CallingSettingsForm`.
- Reads `useSearchParams` for `section`, passes `initialSection` to the form.
- Returns `<SettingsPanel title="Customize calls" description=... icon={PhoneCall} accent="emerald">{<CallingSettingsForm initialSection={...}/>}</SettingsPanel>` — **no footer prop** (form owns footer now).
- Removes the inline footer JSX and duplicate helper/sub-component definitions (now in the form file).

### 3. UPDATE `client/src/components/calls/CallsRailPanel.tsx`
- Import `CallingSettingsForm`.
- Replace `SettingsBody` usage when `panel === 'settings'` with `<CallingSettingsForm />`.
- Width: when `panel === 'settings'` use `md:w-[480px] lg:w-[520px]`; Help keeps `md:w-[260px] lg:w-[280px]`.
- `PanelHeader` already provides title "Customize" + close X — keep it; the form supplies content + its own sticky footer below the scrollable body.
- Remove the now-dead `ActionRow` links to `/settings?tab=calling` and `/ai-bot` (form handles those internally via its own links). Keep `onOpenSetup` only if still referenced by Help.
- Ensure the body container allows the form's sticky footer to stick (body is `overflow-y-auto`; the form's footer uses `sticky bottom-0` — verify it sticks within the scroll parent; if not, move footer outside the scroll container into `CallsRailPanel`).

### 4. `client/src/pages/SettingsPage.tsx` — NO structural change
- Line 939 already renders `<CallingSettingsPanel />`; continues to work.

### 5. `client/src/pages/CallsPage.tsx` — NO change needed
- Already mounts `CallsRailPanel` with `panel`. Width handled inside `CallsRailPanel`.

## UI/UX Details
- **Rail (settings):** header "Customize" + X; scrollable form; sticky footer with Reset default (left) and Cancel / Save changes (right).
- **Section nav:** horizontal scroll tabs on top (native `< lg` behavior); content below. At 520px this is comfortable.
- **"How it works" aside:** hidden until `xl` viewport; shows below content in rail — acceptable.
- **Deep links (Personality / Training):** `DeepLinkCard` → `/ai-bot`. Clicking navigates away from Calls (expected; same as today).
- **Mobile:** panel `w-[min(100%,300px)]` overlays; form scrolls vertically; footer sticky.

## Validation
1. Calls page: click Settings icon → rail widens, full 9-section form appears, no redirect.
2. Edit a field → Save changes enables; Cancel reverts; Reset default prompts.
3. Voice section: "Play greeting preview" triggers audio (or graceful error toast).
4. Switch sections via top tabs → content updates, state persists within panel session.
5. Close X → rail collapses to 72px icon rail; Calls list/stage unchanged.
6. Settings → Calling tab still renders the same form (backward compat + AiBotPage deep link works).
7. Help icon still opens Help at original width; no regression.
8. Responsive: desktop 520px readable; mobile 300px scrollable; footer stays visible.

## Risks
| Risk | Mitigation |
|------|-----------|
| Sticky footer won't stick inside `overflow-y-auto` rail body | Move footer out of scroll container into `CallsRailPanel` flex column (header / scroll body / footer) |
| 520px rail too narrow for "How it works" aside | Aside already `xl:`-gated; shows below content — acceptable |
| Duplicate footer if both `CallingSettingsPanel` and form render one | Form owns footer; `CallingSettingsPanel` passes NO footer prop |
| Breaking `AiBotPage` deep link | Keep Settings→Calling tab rendering the shared form |

## Open Questions
- **D1 (presentation):** wide inline rail (recommended) vs full-page overlay? → need user confirm.
- **D2:** keep Settings→Calling tab (recommended) — assumed yes unless user says remove.
