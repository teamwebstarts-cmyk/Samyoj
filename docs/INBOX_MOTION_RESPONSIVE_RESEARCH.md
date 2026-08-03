# Animation, Responsive & Micro-Interaction Research

## Research framing

This report translates current platform, web, accessibility, and team-inbox guidance into a practical specification for Samyoj’s WhatsApp inbox. The strongest cross-source conclusion is restraint: motion should explain a state change, preserve spatial context, or confirm an action—not decorate every update. Frequent chat events therefore need shorter, quieter feedback than rare navigation or pane transitions.

**Source note.** Product documentation is strongest for interaction patterns and accessibility, while exact animation values are implementation recommendations derived from Tailwind, Material, Motion, Apple, NN/g, and web.dev guidance. Slack, Intercom, Front, Linear, respond.io, and Wati publish workflows and navigation more often than pixel-level motion tokens; their public material is consequently used as pattern evidence, not as claims about undocumented internal CSS.

## 1. Motion Vocabulary

### Recommended motion table

| Action | Duration | Easing | Property | Reduce-motion fallback |
|---|---:|---|---|---|
| Conversation row hover | 100–150ms | `ease-out`, roughly `cubic-bezier(0.0, 0.0, 0.2, 1)` | background-color, border-color | Instant color change; preserve hover only when a hover-capable pointer exists |
| Row selected/unselected | 150–200ms | standard/ease-in-out, `cubic-bezier(0.4, 0, 0.2, 1)` | background-color, inset indicator opacity | Instant selected wash plus non-color cue such as `aria-current`/check |
| Icon button hover/focus | 100–150ms | `ease-out` | color, background-color, box-shadow | Instant state change |
| Icon button pressed | 80–120ms | linear or ease-out | opacity, `scale(0.96)` | Color/background change only; no scale |
| Filter chip selection | 150–200ms | ease-out | background-color, color, border-color | Instant state swap |
| New inbound message when agent is at bottom | 160–220ms | ease-out/decelerate | `translateY(6–10px)`, opacity | Insert directly; optionally use a short persistent highlight tint |
| New message while agent is reading older content | 120–180ms | ease-out | opacity and small translate only | Insert directly; show “New messages” affordance, never force-scroll |
| Optimistic outbound bubble | 120–180ms | ease-out | opacity, `translateY(4px)` | Insert directly; status text still appears |
| Failed send transition | 120–180ms | ease-out | color/border/icon opacity | Instant error state with text “Failed · Retry” |
| Date divider / “new messages” marker | 150–200ms | ease-out | opacity | Immediate marker |
| Typing indicator dots | 900–1200ms loop | linear/ease-in-out, staggered 120–180ms | opacity/translateY only | Static three dots or text “Typing…”; no pulsing loop |
| Composer attach menu open | 150–220ms | ease-out/decelerate | opacity, `translateY(4px)`; optional `scale(0.98→1)` | Instant reveal; focus management remains |
| Composer attach menu close | 100–160ms | ease-in/accelerate | opacity, `translateY(2px)` | Instant removal |
| Composer expand/collapse | 200–300ms | ease-in-out/standard | transform/opacity; avoid animating layout height where possible | Instant layout change; preserve focus and draft |
| Search-in-chat bar reveal | 180–250ms | ease-out | `translateY(-6px)`, opacity | Instant reveal |
| Right details rail open | 220–300ms desktop; 280–350ms mobile sheet | ease-out/decelerate | `transform: translateX(100%)`, opacity | Instant reveal or cross-fade; focus moves to heading/close |
| Right details rail close | 160–220ms | ease-in/accelerate | `transform`, opacity | Instant hide; return focus to opener |
| New-chat slide-over | 220–300ms | ease-out | transform/opacity | Instant reveal |
| Modal open/close | 180–280ms open; 120–200ms close | ease-out open / ease-in close | opacity + small translate/scale | Cross-fade or instant; no zooming from far away |
| Toast/snackbar enter | 180–240ms | ease-out | `translateY(8px)`, opacity | Instant appearance |
| Toast/snackbar exit | 120–180ms | ease-in | opacity | Instant removal |
| Skeleton shimmer | 1200–1800ms loop | linear | background-position only | Static neutral blocks |
| Loading spinner | 700–1000ms loop | linear | rotate | Static “Loading…” or `aria-busy` state |
| Number/stat update | 180–300ms, once | ease-out | opacity or small digit transition | Replace immediately; announce final value once |
| Segment underline slide | 180–240ms | ease-out | `transform: translateX()` | Move underline instantly |
| Toggle switch | 100–180ms | ease-out | thumb transform + color | Instant thumb/color state |
| Pane drag feedback | continuous pointer movement; 100–150ms collapse snap | direct tracking / ease-out snap | transform or grid track, not animated `top/left` | Direct resize, no snap animation |
| Hover preview card | 150–220ms after 150–200ms intent delay | ease-out | opacity + small translate | No preview; expose the same action through click/focus |
| Pull-to-refresh | gesture-driven; completion 180–250ms | direct tracking + ease-out settle | transform/opacity of indicator | Static refresh button and status text |

### What the sources support

- Tailwind documents `duration-150`, `duration-300`, custom duration values, default transition behavior, and `motion-safe`/`motion-reduce` variants. Its default transition timing is `cubic-bezier(0.4, 0, 0.2, 1)` and default duration is 150ms. [Tailwind transition duration](https://tailwindcss.com/docs/transition-duration), [Tailwind transition timing](https://tailwindcss.com/docs/transition-timing-function), [Tailwind transition property](https://tailwindcss.com/docs/transition-property)
- Material’s motion guidance distinguishes incoming deceleration, outgoing acceleration, and standard in-place changes. Material’s documented token families span short feedback through long transitions; duration should grow with travel distance and complexity. [Material 3 easing and duration](https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration), [Material Components motion system](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md), [Material duration and easing](https://m1.material.io/motion/duration-easing.html)
- NN/g recommends roughly 100–500ms overall, about 100ms for simple feedback, 200–300ms for substantial changes such as modal entry, and shorter exits than entrances. It also recommends ease-out for entrances and ease-in for exits. [NN/g: Executing UX animations](https://www.nngroup.com/articles/animation-duration/)
- Motion for React uses a 0.3s default tween and supports named easing, cubic-bezier arrays, springs, and a site-wide `reducedMotion="user"` policy. When reduced motion is enabled, transform/layout motion can be disabled while opacity/color feedback remains. [Motion React transitions](https://motion.dev/docs/react-transitions), [MotionConfig reduced motion](https://motion.dev/docs/react-motion-config)
- Apple says motion should be purposeful, optional, cancellable, and minimized for frequent interactions. Replace scaling, spinning, parallax, depth, or multi-axis movement with a dissolve, highlight fade, or static state where needed. [Apple Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion), [Apple reduced-motion environment value](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityReduceMotion), [Apple reduced-motion evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/)
- web.dev recommends animating `transform` and `opacity` rather than layout/paint-heavy properties such as `top`, `left`, `width`, or `height`, and using `will-change` sparingly. [web.dev animation guide](https://web.dev/articles/animations-guide), [web.dev animation performance](https://web.dev/articles/animations-and-performance)

### Specific answers to the motion questions

**Bubble enter/exit.** Use a small vertical translate plus fade, not a pop/bounce. Bubbles are frequent; scale changes can make the thread feel noisy and can be uncomfortable. Do not animate removal in a way that leaves a ghost gap or delays the next task. Exit faster than enter, or remove instantly if the message is being filtered/reordered.

**New message arrival.** Do not pulse the bubble indefinitely. If the agent is at the bottom, insert with a 6–10px translate and fade, then settle. If the agent is reading history, do not scroll; show a “New messages” marker/button and a list/header unread cue. Auto-scroll only when the user is already at the bottom or has explicitly chosen “Jump to latest.”

**Typing indicator.** Three dots are conventional, but Samyoj’s Meta WhatsApp context must not fabricate customer typing/presence: the plan explicitly says Meta does not provide those signals. Use typing motion only for a real Samyoj automation/AI generation state, with honest label text such as “Bot is preparing a reply.” Keep the dots in one message slot and replace them immediately when actual content begins; never label fictional internal phases.

**Composer expand/collapse.** Animate only a small visual affordance or use a layout transition if the implementation is stable. Preserve the draft, keep the focused input visible, and avoid a long height animation that makes the send button move away from the pointer.

**Sidebar/right-pane slide-in.** Use `transform: translateX()` plus opacity, not `left/right` positioning. Desktop can use a 220–300ms rail transition; mobile should use a bottom sheet or full-screen detail route because a narrow side rail creates cramped content. Close faster than open.

## 2. Hover / Focus / Active Standards

Every interactive element needs a complete state matrix, not just a hover style. The baseline is **default, hover, focus-visible, pressed/active, selected/toggled, disabled, loading, and error/success where applicable**. Hover is unavailable on touch, while focus must remain available for keyboard and assistive-technology users. [NN/g button states](https://www.nngroup.com/articles/button-states-communicate-interaction/), [Aura interaction states](https://docs.cognite.com/aura-design-system/foundations/interaction-states), [WCAG 2.2 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible)

| Element type | Hover | Focus-visible | Pressed/active | Selected/toggled | Disabled/loading |
|---|---|---|---|---|---|
| Conversation row | Neutral-50 or theme-subtle wash; reveal secondary actions only after intent | 2px green/blue ring with 2px offset, or high-contrast two-color ring; never remove outline | Slight darker wash, no row scale | Mint selected wash plus a non-color cue (`aria-current`, selected icon, or left border) | Keep row readable; loading row uses skeleton, not a disabled-looking blank |
| Icon button | Background tint and icon contrast shift; tooltip after 500–700ms intent | Persistent ring, at least 2px, not clipped by overflow | `scale(.96)` or darker state for 80–120ms | Toggle icon and label/state, e.g. `aria-pressed=true`; do not rely on color | `aria-busy=true`, spinner only inside the button if action is isolated |
| Filters/chips | Border/background tint | Ring around complete pill, not just text | Darker fill or 1px inset shift | Strong fill/border + selected semantics; unread count remains legible | Disabled chip is unavailable but still readable; do not use opacity so low that text fails contrast |
| Search/input | Border tint only | Focus-within ring and clear label/placeholder contrast | N/A | Search-active state can show clear button and result count | Loading search uses inline progress/status, never replace typed value |
| Send button | Slight brightness/lift only when enabled | Ring visible outside circular edge | Small scale/color confirmation | N/A | Disabled must have `disabled` semantics and explain why via nearby text if not obvious; sending state keeps button geometry stable |
| Attach menu item | Row wash | Menu-item ring/roving focus | Darker wash | Checkmark or active icon for persistent mode | Disabled item has reason in accessible name or adjacent text |
| Conversation action/status controls | Subtle surface change | Ring and logical tab order | Immediate press feedback | State icon plus text/status, e.g. snoozed, assigned, failed | Failed action exposes Retry; loading prevents duplicate submission |
| Radio card / assignment option | Surface tint | Ring around whole card | Slight inset/darker fill | Check/radio plus surface/border; announce selection | Disabled option explains unavailable state |
| Toggle | Track tint on hover | Ring around entire switch | Thumb moves immediately; 100–180ms settle | `aria-checked` or native checkbox semantics | Disabled track/thumb remain distinguishable and label remains readable |
| Resizable pane separator | Handle highlight on hover | Wide visible ring; separator remains in viewport | Direct tracking, no lag | Collapsed state has explicit affordance | Keyboard arrows/Home/End/Enter provide full alternative |

**Focus recommendation for Samyoj.** Use `focus-visible:outline-2 focus-visible:outline-offset-2` with a green focus color only if it passes 3:1 against the surrounding surface and against the component’s unfocused state. For white and mint surfaces, a two-color ring or dark green outer ring plus white inner gap is safer than a pale green ring. WCAG 2.2 AA requires visible keyboard focus; the newer Focus Appearance size/contrast numbers are AAA, but adopting them is a valuable quality target. [WCAG Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), [WCAG Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)

## 3. Responsive Breakpoint Plan

The breakpoints below are an implementation plan for the requested test widths, not a claim that device labels define responsive design. web.dev recommends starting at the smallest layout and adding breakpoints where the content becomes cramped; container queries are preferable for component-specific adaptation. Material’s adaptive guidance describes compact, medium, expanded, large, and extra-large width classes and recommends list-detail/supporting-pane patterns. [web.dev responsive basics](https://web.dev/articles/responsive-web-design-basics), [web.dev media queries](https://web.dev/learn/design/media-queries), [Android adaptive window classes](https://developer.android.com/develop/adaptive-apps/guides/use-window-size-classes), [Material adaptive layouts](https://developer.android.com/develop/adaptive-apps/guides/get-started-with-adaptive-apps)

| Width | Layout mode | Conversation list | Thread/header | Details rail | Composer |
|---:|---|---|---|---|---|
| **375px** | Compact, single pane | Full-screen list; rows 68–76px; search and chips scroll horizontally; list width is viewport | Selecting a row navigates to a full-screen thread; back button is always visible; header identity truncates safely | Hidden from base layout; “Customer details” opens a full-width or near-full-width bottom sheet with a visible close button; prefer sheet height 85–95vh | 44–48px minimum controls; attachment button, flexible input, send button; safe-area bottom padding; template banner wraps to two rows; prevent keyboard from covering the composer |
| **390px** | Compact, single pane | Same as 375px, with a little more horizontal breathing room; do not add a second pane merely because width is 15px larger | Same full-screen thread; put secondary header actions behind overflow if six icons do not fit | Bottom sheet; profile/stat cards stack vertically if needed | Input remains primary row; action menu is bottom-anchored or flips above composer when keyboard is visible |
| **768px** | Medium/tablet portrait | List-only destination or list + thread only if measured widths fit; list target 280–320px | Thread is a sibling pane; back/close control returns to list; header actions collapse to 2–3 primary icons plus overflow | Hide as a persistent third pane; open as a modal/sheet or temporary supporting pane | 44px controls; input and send remain one row; attachment menu may become a popover with enough width |
| **820px** | Medium/large edge | List + thread is the default; list 280–320px; avoid a permanently visible 320px details rail unless thread still has at least ~420px | Primary identity + 2–3 actions; search, snooze, favorite, bot, and assignment move to overflow as needed | Collapsible right rail; open as overlay rather than shrinking the thread below a usable reading width | One row if input has at least 220px; otherwise wrap attachment/template controls above the input, never make the send target tiny |
| **1024px** | Expanded threshold | Two-pane list + thread; list 300–340px, thread gets remainder | Identity and service-window pill remain; four primary actions max, rest overflow | Optional collapsed icon rail or overlay; persistent detail rail only if thread remains ≥500px | Full composer row; service-window/closed-template state must keep explanatory text visible |
| **1280px** | Desktop 3-pane | 300–360px; cap list so names/previews scan without excessive line length | Thread flexes; bubble max width ~65%, but cap message text line length around 65–80 characters | 300–340px persistent rail | Full one-row composer; six square actions only if each remains ≥36px and the identity region does not collapse |
| **1440px** | Desktop 3-pane | 320–380px; use extra width for comfortable row metadata, not oversized text | Thread gets generous breathing room; center content can use `max-width` around 760–900px and center within pane | 320–360px; show full stats/quick actions | Full one-row composer; attach popover aligns to left edge and remains inside viewport |
| **1920px** | Extra-large desktop | Do not let list grow without bound; target 360–420px max, then keep it fixed | Keep thread readable; center message column and cap bubble/text width; avoid giant empty bubbles | 340–400px max; details content can use more internal spacing, not endless line length | Full one-row composer; optional pane resize is useful, with keyboard-accessible splitter |

### Width recommendations

- **Conversation list max width:** start with 340px at desktop and allow fluid growth to roughly 380–420px only on very wide displays. Past that, scanning becomes slower because the eye travels farther between avatar, preview, and metadata; excess width should go to the thread. This is a product recommendation based on the mock’s ~340px list, web.dev’s readable text guidance, and the need to preserve a wide center pane—not a universal WCAG limit. [web.dev optimize text for reading](https://web.dev/articles/responsive-web-design-basics#optimize_text_for_reading)
- **Right-rail collapse point:** hide the persistent rail below the width where `list-min + thread-min + rail-min` no longer fits. For Samyoj, use a practical **1024px layout threshold**, but test the actual content: at 820px, use an overlay/sheet; at 1024px, allow a collapsed rail; at 1280px+, show the persistent rail.
- **Do not equate 768px with “desktop.”** At 768/820px, the list-detail canonical pattern is safer than squeezing three panes. Material explicitly recommends one pane at compact/medium and multiple related panes at expanded widths.
- **Header reflow:** mobile shows back + avatar/name + overflow; tablet shows identity + up to three actions; desktop shows identity + service-window pill + six actions where space permits. Never shrink icon targets below 36–44px to preserve all actions.
- **Composer reflow:** mobile keeps send accessible above the safe area and moves secondary actions into a menu/sheet; tablet keeps one row if the input remains usable; desktop exposes the full mock row.
- **Implementation shape:** use CSS grid/flex with min/max tracks, `min-width: 0`, and pane-level container queries where possible. Animate transform/opacity, not pane `left`/`width` changes. If Samyoj adds drag resizing, implement the WAI-ARIA Window Splitter pattern. [WAI-ARIA Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)

## 4. Modern Team-Inbox Motion Language

### Product pattern comparison

| Product | Publicly documented pattern | Implication for Samyoj |
|---|---|---|
| Slack | Region-based keyboard navigation with F6, Tab, and arrow keys; first-unread and latest-message navigation; configurable reduced motion and screen-reader message readouts | Treat the inbox as three keyboard-navigable regions. Add list arrow navigation, `Home/End`, first unread, and a focus-visible blue/green ring. Do not make pointer hover the only way to expose actions. [Slack keyboard navigation](https://slack.com/help/articles/115003340723-Navigate-Slack-with-your-keyboard), [Slack accessibility](https://slack.com/accessibility), [Slack screen readers](https://slack.com/help/articles/360000411963-Use-Slack-with-a-screen-reader) |
| Linear | Inbox is an attention queue with keyboard movement (`J/K` or arrows), snooze, mark read/unread, quick search, contextual menu, and peek preview | Add lightweight queue operations and a hover/focus preview card only after the core list is stable. Keep actions reversible and show state, not decorative animation. [Linear Inbox](https://linear.app/docs/inbox) |
| Intercom | Inbox prioritizes immediacy, no loading screens/spinners for ordinary navigation, Command-K, direct shortcuts, list/table layouts, filter-scoped search, and background-job notifications | Prefer cached/surgical updates and skeletons only for real content fetches. Use a command menu later for assign/snooze/close/template; communicate background work with a “Started” then “Completed” status. [Intercom Inbox explained](https://www.intercom.com/help/en/articles/6258745-the-inbox-explained), [Intercom Command-K](https://www.intercom.com/help/en/articles/6272267-how-to-use-command-k-with-intercom-inbox), [Intercom search/filter](https://www.intercom.com/help/en/articles/6516006-inbox-search-and-filter) |
| Front | Team inbox with independently configurable desktop, mobile, and email notifications; configurable shortcut sets | Notification policy should be explicit: in-app for assigned/new activity, optional browser sound, and no duplicate toast storm. Consider user-configurable shortcuts only after core navigation. [Front notifications](https://help.front.com/en/articles/2174), [Front shortcuts](https://help.front.com/en/articles/2189) |
| respond.io | Unified inbox with assignment, snippets, dynamic variables, mentions, mobile notification drawer, quick reply, and team/custom inboxes | Samyoj’s `/` canned replies, assignment, and notification center fit established team-inbox practice. Keep the suggestion menu keyboard-navigable and allow quick reply from notifications only if authentication and failure feedback are robust. [respond.io responding](https://respond.io/help/quick-start/responding-to-messages), [respond.io mobile messaging](https://respond.io/help/mobile-app/messaging-from-your-mobile), [respond.io team inbox](https://respond.io/team-inbox) |
| Wati | Unified team inbox across channels, channel identification, status management, and shared conversation controls | Preserve WhatsApp provenance and status clarity. Do not copy consumer WhatsApp-only affordances such as groups, typing, online, or video calls when the Cloud API does not supply them. [Wati multi-channel Team Inbox](https://support.wati.io/en/articles/11463002-how-to-use-the-multi-channel-team-inbox-in-wati) |

### Recommended shared language

1. **Instant for navigation, subtle for context.** Switching conversations should feel immediate; a 120–180ms selected-state change is enough. Avoid page-level fades that make a busy agent wait.
2. **Skeletons for content, spinners for actions.** The existing `ComposerSkeleton` shimmer is appropriate for unknown service-window state. Use thread/list skeletons that mirror their final geometry. Use a spinner only inside Send, Retry, or a single isolated action.
3. **Shimmer, not pulsing opacity, for structured skeletons.** A restrained 1.2–1.8s gradient sweep communicates active loading without making every row breathe. Provide a static fallback under reduced motion. NN/g cautions that animated skeletons can distract and that frame-only skeletons do not give enough structural information. [NN/g Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/)
4. **Empty states explain the next action.** Use an illustration only when it improves recognition and remains lightweight; pair it with a heading, one sentence, and one primary action. For filtered-empty, a simple icon and “No chats match these filters” plus “Clear filters” is better than a large decorative scene. Connected-empty can show the WhatsApp mark and “Your inbox is ready” with a clear next step. Not-connected must explain Connect WhatsApp.
5. **Toasts/snackbars are secondary feedback.** Place them bottom-left on desktop and above the bottom safe area/composer on mobile; never cover the composer or the focused control. One visible toast at a time, 3–6 seconds for reversible low-risk feedback, indefinite for failures requiring Retry/Dismiss. Material recommends bottom placement, action support, timeout, and not using a snackbar as the only route to a core task. [Material snackbars](https://m1.material.io/components/snackbars-toasts.html), [Android Snackbar reference](https://developer.android.com/reference/com/google/android/material/snackbar/Snackbar)
6. **No fake page transitions.** For a realtime inbox, instant state updates outperform decorative route fades. Reserve 180–300ms motion for drawers, sheets, modals, and search-bar insertion where it preserves spatial hierarchy.
7. **Honest realtime surfacing.** A new inbound message should reorder the one conversation surgically, update unread, and animate only the changed row/bubble. Never refetch the whole list in a way that resets scroll and looks like a loading screen.

## 5. Micro-Interactions Catalog

| # | Interaction | Recommended behavior/spec | Priority |
|---:|---|---|---|
| 1 | Inbound bubble entry | 160–220ms, `opacity + translateY(6px)`, no bounce | P0 |
| 2 | Outbound optimistic send | Show immediately, 120–180ms settle; status changes independently | P0 |
| 3 | Failed-message retry | Red icon/text is persistent; Retry press gives inline spinner and preserves bubble position | P0 |
| 4 | New messages while scrolled up | No forced scroll; sticky “N new messages” button fades in and jumps to latest on activation | P0 |
| 5 | Auto-scroll at bottom | If within a small bottom threshold, append and scroll smoothly; otherwise never steal scroll | P0 |
| 6 | Unread row surfacing | Preview becomes bold/dark, timestamp/badge changes immediately; no pulsing badge | P0 |
| 7 | Typing/automation indicator | Three staggered dots only for a real automation wait; polite status text; static reduced-motion fallback | P1, only with real signal |
| 8 | Attach menu | Plus rotates 45° over 150ms; menu enters 180ms from the composer; Escape/outside click closes | P0 |
| 9 | Canned-reply autocomplete | Keyboard arrows move through suggestions, Enter inserts, Escape closes; 120–180ms opacity reveal | P0 |
| 10 | Composer focus | `focus-within` border/ring changes in 100–150ms; no layout shift | P0 |
| 11 | Template-mode swap | Preserve draft; cross-fade banner/content in 160–220ms; explain the closed 24h window | P0 |
| 12 | Filter chip switching | Underline/fill updates in 150–200ms; result list updates without whole-page spinner | P0 |
| 13 | Segmented tabs | Slide a single underline with `transform` over 180–240ms; selected semantics remain immediate | P1 |
| 14 | Favorite toggle | Star fills and `aria-pressed` changes immediately; optional 120ms opacity/color transition, no confetti | P1 |
| 15 | Snooze action | Conversation row leaves current filtered list with a short fade/translate; show Undo toast | P1 |
| 16 | Assignment change | Agent avatar/name updates immediately; transient “Assigned to …” status, no row teleport animation | P1 |
| 17 | Number/stat update | Prefer instant update for unread counts; animate only low-frequency stats over 180–300ms; announce final value once | P1 |
| 18 | Search-in-chat | Bar slides under header 180–250ms; matches highlight with non-color cue and previous/next controls | P1 |
| 19 | Radio-card selection | Entire card gets a selected border/background and check icon; 120–180ms | P1 |
| 20 | Toggle switch | Thumb translates 100–180ms; native checkbox/switch semantics; state is not color-only | P1 |
| 21 | Pull-to-refresh | Gesture-driven indicator with release threshold, then 180–250ms settle; also expose visible Refresh button | P2/mobile |
| 22 | Swipe row actions | Reveal Snooze/Mark unread/etc. over a bounded distance; commit threshold; provide overflow/menu equivalent | P2/mobile |
| 23 | Long-press menu | 400–500ms hold opens contextual menu; provide a visible overflow action and do not make hold the only route | P2/mobile |
| 24 | Drag-to-resize panes | Pointer tracks directly; snap collapse in 100–150ms; separator supports arrows/Home/End/Enter | P2 |
| 25 | Hover preview card | 150–200ms intent delay, then 150–220ms opacity/translate; focus and click must expose it too | P2 |
| 26 | “Started/Completed” background job | Immediate toast/status “Export started”; completion notification when ready; do not spin indefinitely | P1 |
| 27 | Reconnect banner | Appear immediately on disconnect; no alarming shake; stable amber banner, then quiet success status or removal on reconnect | P0 |
| 28 | Media placeholder | Reserve dimensions to avoid layout shift; shimmer only while fetching; “Photo unavailable” after fallback fails | P0 |

**Count-up versus instant.** For unread badges, use instant updates because the value is operational and may change several times per minute. For profile stats such as total chats, a one-time 180–300ms transition is acceptable but not necessary. If animating, keep the visible counter `aria-hidden` and announce the final value once through a polite status region; otherwise intermediate values may be read as noise. [Accessible animated counter example](https://asoasis.tech/articles/2026-07-05-0838-react-animated-counter-component/)

**Swipe, long press, and pointer alternatives.** Swipe actions are useful on mobile, but they cannot be the only way to perform an action. WCAG’s pointer-gesture guidance requires a single-pointer alternative for path-based gestures; Apple describes swipe as a conventional way to reveal actions and touch-and-hold as a contextual-menu trigger. Provide an overflow button, keyboard/menu route, and visible action labels. [WCAG Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html), [Apple Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures)

## 6. Accessibility Checklist

### WCAG 2.2 AA baseline

- **Contrast:** normal text ≥4.5:1; large text ≥3:1. Meaningful UI component boundaries, icons, and state indicators should meet ≥3:1 against adjacent colors. Test Samyoj’s WhatsApp green on white and on mint selected surfaces, especially muted preview/timestamp text. [WCAG Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), [WCAG Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- **Focus visible:** every keyboard-operable button, row, chip, menu item, input, dialog control, and pane close control has a persistent `:focus-visible` indicator. Do not use `outline: none` without an equivalent. [WCAG Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible)
- **Focus not obscured:** focus must not be entirely hidden under the sticky header, composer, toast, sheet, or details overlay. Use `scroll-margin` and return focus to the invoking control when overlays close. [WCAG 2.2 overview](https://www.w3.org/TR/WCAG22/Overview.html)
- **Target size:** WCAG 2.2 AA Target Size Minimum is 24×24 CSS px or a spacing exception; Samyoj should target 36–44px for icon buttons and 44px+ touch rows as a practical enhanced baseline. [WCAG Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- **Keyboard order:** use landmarks/regions for list, thread, and details; Tab between regions and controls, arrow keys within conversation/message lists, Enter/Space to activate, Escape to close menus/sheets, Home/End for list extremes. Slack’s region and arrow-key model is a useful precedent. [Slack keyboard navigation](https://slack.com/help/articles/115003340723-Navigate-Slack-with-your-keyboard)
- **Roving focus:** conversation rows and message actions should not create hundreds of Tab stops. Use a roving tab index or a listbox/tree-like keyboard model only where semantics fit; otherwise keep rows as native buttons/links and document predictable arrow behavior.
- **Chat live updates:** put the stable thread history container in the DOM from initial render with `role="log"`, `aria-live="polite"`, and `aria-atomic="false"`; append only the new message content so screen readers do not reread the entire history. [W3C ARIA23 chat log](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23)
- **Announcements:** use a separate polite `role="status"` for “New messages,” “Assigned to Alex,” “Reconnecting,” and final count/stat changes. Use `role="alert"` sparingly for send failures or critical webhook errors; W3C recommends that the empty alert/live container exist at page load for reliable announcements. [W3C ARIA19 alerts](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19)
- **Reduced motion:** implement `@media (prefers-reduced-motion: reduce)` globally for nonessential transforms, slide-ins, shimmer, bounce, pulse, and auto-scroll. Replace with instant state changes, opacity, color/highlight, or static indicators. Tailwind supports `motion-reduce`; Motion supports `reducedMotion="user"`. [Tailwind reduced motion](https://tailwindcss.com/docs/transition-duration), [MotionConfig](https://motion.dev/docs/react-motion-config), [Apple reduced motion](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/)
- **No flashing:** do not pulse or flash error/unread states. Keep any attention animation below seizure-risk thresholds and prefer a persistent textual/icon cue.
- **Color independence:** unread, delivered/read/failed, snoozed, selected, and connected/disconnected states must pair color with weight, icon, text, border, or shape.
- **Names and roles:** icon-only buttons need accessible names; avatars should have useful alt text or be decorative; attachment/media bubbles need meaningful labels; menus/dialogs need correct focus trap and escape behavior.
- **Draft safety:** focus loss from responsive reflow or a template-mode swap must not erase the composer draft.
- **Zoom/reflow:** test at 200% zoom and narrow widths without horizontal scrolling; do not hide essential controls merely because the viewport is small. [web.dev responsive basics](https://web.dev/articles/responsive-web-design-basics)
- **Resizable panes:** if drag resize ships, the separator needs `role="separator"`, a name, `aria-valuenow/min/max`, `aria-controls`, and Arrow/Home/End/Enter support. [WAI-ARIA Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
- **Touch:** do not rely on hover. Verify coarse-pointer behavior with `@media (hover: none)` and preserve large tap targets.

### Suggested Samyoj focus token

```css
:focus-visible {
  outline: 2px solid #087f5b;
  outline-offset: 2px;
}
```

Validate the actual color pair with a contrast checker; if the green ring does not meet the needed contrast on a given surface, use a two-layer ring such as a dark outer ring and light inner gap. Do not treat the sample token as automatically compliant.

## 7. Honest UX Patterns

### Choose feedback by what is uncertain

| Situation | Honest signal | Avoid |
|---|---|---|
| Local interaction acknowledged | Immediate pressed/selected state | Waiting for server response before any feedback |
| Content structure is known but data is pending | Skeleton matching the final row/thread/composer geometry | Blank pane, full-page spinner, frame-only skeleton |
| Isolated action is processing | Button-local spinner and `aria-busy`; keep label/geometry stable | Blocking the entire inbox |
| Unknown-duration short request | Spinner plus a useful label if needed | Pretending progress with arbitrary percentages |
| Request may take >10s | Real progress or named phases tied to actual work | Endless spinner with no explanation |
| Realtime connection lost | Amber “Reconnecting… new messages may be delayed” banner | Green connected badge while inbound is down |
| Webhook/inbound health failed | Red actionable banner with health/retry detail | Silent stale inbox |
| Send failed | Optimistic bubble marked Failed, Retry, and a reason when known | Removing the message or showing only a red icon |
| Meta 24h window closed | Amber explanatory banner and template action; preserve draft | Briefly showing a generic closed state due to client flicker |
| Media unavailable | Reserved-size placeholder, then “Photo unavailable” and retry/fallback if possible | Broken image icon with no explanation |
| Filter has no results | “No chats match these filters” + Clear filters | Generic “No data” illustration |
| Account is not connected | Explain the missing connection and Connect WhatsApp CTA | Empty thread that looks like a loading failure |
| Background export/bulk action | “Export started” immediately, then completion notification | Indefinite spinner in the inbox |
| No activity yet | Calm connected-empty state with one useful next action | Fake conversations, fake totals, or fake presence |

NN/g distinguishes skeletons from spinners by context: skeletons are structural placeholders for full-page/content loads; spinners are better for isolated modules and actions; under about one second, neither is usually needed; beyond about ten seconds, show real progress or an estimate. [NN/g Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/)

**Uncertainty rule for Samyoj:** if the server has not returned the service-window state, render `ComposerSkeleton`, not “Window closed.” If the socket is disconnected, show the actual connection state and catch up after reconnect. If Meta rejects a message, preserve the bubble and expose the known error code/message. If data does not exist—customer typing, satisfaction score, groups, video-call capability—do not simulate it for visual completeness.

## 8. Samyoj-Inbox-Specific Recommendations

### P0 — high impact, low/medium effort

| Recommendation | Concrete behavior | File targets |
|---|---|---|
| Add a small bubble entrance | New inbound/outbound message gets `opacity + translateY(6px)` over 160–220ms; disable transform under reduced motion | `client/src/components/inbox/MessageBubble.tsx`, thread message list component |
| Fix new-message scrolling | At bottom: append and keep bottom; scrolled up: no auto-scroll, show “New messages” button; no pulse | `InboxPage.tsx`, thread container, `MessageBubble.tsx` |
| Make connection/error feedback explicit | Stable amber reconnect banner and red webhook-health banner in list header; use polite/alert regions appropriately | `InboxPage.tsx`, `InboxListHeader.tsx`, `ConnectionStatusIndicator.tsx`, notification/toast component |
| Preserve the composer skeleton | Keep tri-state service-window behavior; skeleton shimmer is content-shaped and static under reduced motion | `ChatComposer.tsx` (`ComposerSkeleton`), new `ThreadSkeleton.tsx` |
| Complete composer state matrix | Attach button, attach menu rows, canned replies, and send button need hover/focus/pressed/disabled/loading states; preserve focus and draft | `ChatComposer.tsx` |
| Remove hidden/unsupported affordances | Do not render Mic, customer typing/presence, Groups, or video-call action until a real data/capability source exists | `ChatComposer.tsx`, `ChatHeader.tsx`, filter/header components |
| Avoid layout-heavy animation | Use transform/opacity for menus, sheets, and overlays; do not animate `left`, `top`, width, or pane geometry unless measured | All components under `client/src/components/inbox/**` |
| Add chat semantics | Thread history should use `role="log"`; new messages are polite additions; action failures and reconnect states have text | Thread message-list component, `InboxPage.tsx`, `MessageBubble.tsx` |
| Add robust focus rings | Apply a shared `focus-visible` token to every icon button, row, chip, input, menu item, dialog, and close control; test contrast on white/mint/amber/red surfaces | All components under `client/src/components/inbox/**`, shared theme/style tokens |
| Keep loading honest | No full-inbox spinner for ordinary socket updates; use skeletons for first list/thread load and button-local spinners for send/retry | `ConversationList.tsx`, `ThreadSkeleton.tsx`, `ChatComposer.tsx`, `InboxPage.tsx` |

### P1 — productivity and clarity

| Recommendation | Concrete behavior | File targets |
|---|---|---|
| Implement responsive pane policy | `<600px`: single-pane route; 600–1023px: list/detail or list+thread; 1024–1279px: optional collapsed details; ≥1280px: persistent 3-pane | `InboxPage.tsx`, pane layout components, `InboxDetailsPanel.tsx`, responsive CSS/Tailwind classes |
| Use a mobile details sheet | Details opens from a visible header action, slides from bottom over 280–350ms, traps focus, closes with Escape, returns focus | `InboxDetailsPanel.tsx`, new `CustomerDetailsSheet.tsx` |
| Add keyboard list navigation | Arrow keys through conversation rows, Home/End, first unread/latest; Tab between major regions | `ConversationList.tsx`, `ConversationItem.tsx`, `InboxPage.tsx` |
| Add search-in-chat transition | Bar enters under header over 180–250ms, focus moves into it, Escape closes and returns focus to search trigger | New `SearchInChatBar.tsx`, `ChatHeader.tsx` |
| Add reversible state feedback | Snooze/assign/favorite updates are immediate; use one toast with Undo where possible; do not animate the entire list | Details/row/action components, notification/toast system |
| Add a command action surface later | Command-K style action menu for assign, snooze, close, template, mark unread, retry; only after semantics and shortcut conflicts are defined | New command-menu component, `InboxPage.tsx` |
| Add background-job states | Export/bulk operations show “Started” immediately and “Completed” when actually done | Export dialog, notification center, toast/status component |
| Add accessible splitter if resize ships | Pointer drag plus keyboard Arrow/Home/End/Enter and `aria-valuenow/min/max` | New pane splitter component, `InboxPage.tsx` |

### P2 — delight only after correctness

- Hover preview cards: useful for desktop triage, but defer until list virtualization, focus, and keyboard navigation are stable. Use a 150–200ms intent delay to avoid flashing previews while scanning.
- Pull-to-refresh: useful on mobile, but realtime socket updates and an explicit refresh control are more honest than teaching users to pull. If added, retain a visible Refresh alternative.
- Swipe actions and long-press menus: add only for secondary actions, with visible overflow/menu equivalents. Never hide Retry, assignment, or critical state behind a gesture.
- Number count-up: skip for unread totals; use at most for low-frequency profile statistics, with final-value-only announcements.
- Decorative page transitions, confetti, badge pulses, bouncing bubbles, and continuous attention effects: skip. They compete with incoming conversations and conflict with reduced-motion guidance.
- Voice-note/mic animation: skip with the feature itself until MediaRecorder and permission flows are real.

### Suggested implementation order

1. Correctness first: surgical socket updates, unread source of truth, explicit read endpoint, service-window tri-state, failed retry, and reconnect/webhook error states.
2. Shared interaction tokens: duration/easing CSS variables, `focus-visible`, reduced-motion CSS, stable toast/status semantics, and button state matrix.
3. Thread motion: bubble insertion, bottom-stickiness, new-message marker, media placeholder, and thread skeleton.
4. Responsive structure: single-pane mobile, list-detail tablet, persistent 3-pane desktop, details sheet, and header/composer reflow.
5. Productivity overlays: search-in-chat, snooze picker, assignment picker, ticket/payment dialogs, export feedback, and optional command menu.
6. Delight: hover previews, swipe/long-press actions, pull-to-refresh, and low-frequency stat transitions.

### Acceptance criteria

- No chat animation exceeds 500ms except a deliberate looping indicator, and no frequent update uses a large translate/scale.
- All animated transforms/opacity have a `prefers-reduced-motion: reduce` fallback.
- New messages never force-scroll a user who is reading history.
- Every icon-only action has an accessible name and visible focus state.
- The chat log announces appended messages without rereading the entire thread.
- At 375/390px the composer remains usable above the keyboard and details are a sheet; at 768/820px the UI does not squeeze three panes; at 1280px+ the 3-pane layout is comfortable.
- List width stays approximately 300–420px; thread text remains readable at 1920px instead of expanding indefinitely.
- Skeletons represent real pending content, spinners represent isolated actions, and >10-second jobs expose real progress or named background completion states.
- Unsupported WhatsApp capabilities remain hidden rather than simulated.

## Source index

1. [Tailwind transition duration](https://tailwindcss.com/docs/transition-duration)
2. [Tailwind transition timing function](https://tailwindcss.com/docs/transition-timing-function)
3. [Tailwind transition property](https://tailwindcss.com/docs/transition-property)
4. [Material 3 easing and duration](https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration)
5. [Material Components motion system](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)
6. [Material duration and easing](https://m1.material.io/motion/duration-easing.html)
7. [Apple Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion)
8. [Apple reduced-motion environment value](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityReduceMotion)
9. [Apple reduced-motion evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/)
10. [Motion React transitions](https://motion.dev/docs/react-transitions)
11. [MotionConfig reduced motion](https://motion.dev/docs/react-motion-config)
12. [NN/g: Executing UX animations](https://www.nngroup.com/articles/animation-duration/)
13. [web.dev animation guide](https://web.dev/articles/animations-guide)
14. [web.dev animation performance](https://web.dev/articles/animations-and-performance)
15. [WCAG 2.2 overview](https://www.w3.org/TR/WCAG22/Overview.html)
16. [WCAG Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible)
17. [WCAG Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
18. [WCAG Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
19. [WCAG Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
20. [WCAG Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
21. [WCAG Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html)
22. [W3C ARIA23 chat log](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA23)
23. [W3C ARIA19 alerts](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19)
24. [WAI-ARIA Window Splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)
25. [web.dev responsive basics](https://web.dev/articles/responsive-web-design-basics)
26. [web.dev media queries](https://web.dev/learn/design/media-queries)
27. [Android adaptive window classes](https://developer.android.com/develop/adaptive-apps/guides/use-window-size-classes)
28. [Material adaptive layouts](https://developer.android.com/develop/adaptive-apps/guides/get-started-with-adaptive-apps)
29. [Slack keyboard navigation](https://slack.com/help/articles/115003340723-Navigate-Slack-with-your-keyboard)
30. [Slack accessibility](https://slack.com/accessibility)
31. [Slack screen readers](https://slack.com/help/articles/360000411963-Use-Slack-with-a-screen-reader)
32. [Linear Inbox](https://linear.app/docs/inbox)
33. [Intercom Inbox explained](https://www.intercom.com/help/en/articles/6258745-the-inbox-explained)
34. [Intercom Command-K](https://www.intercom.com/help/en/articles/6272267-how-to-use-command-k-with-intercom-inbox)
35. [Intercom search/filter](https://www.intercom.com/help/en/articles/6516006-inbox-search-and-filter)
36. [Front notifications](https://help.front.com/en/articles/2174)
37. [Front shortcuts](https://help.front.com/en/articles/2189)
38. [respond.io responding](https://respond.io/help/quick-start/responding-to-messages)
39. [respond.io mobile messaging](https://respond.io/help/mobile-app/messaging-from-your-mobile)
40. [respond.io team inbox](https://respond.io/team-inbox)
41. [Wati multi-channel Team Inbox](https://support.wati.io/en/articles/11463002-how-to-use-the-multi-channel-team-inbox-in-wati)
42. [NN/g Skeleton Screens 101](https://www.nngroup.com/articles/skeleton-screens/)
43. [Material snackbars](https://m1.material.io/components/snackbars-toasts.html)
44. [Android Snackbar reference](https://developer.android.com/reference/com/google/android/material/snackbar/Snackbar)
45. [Apple Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures)
46. [Accessible animated counter example](https://asoasis.tech/articles/2026-07-05-0838-react-animated-counter-component/)
