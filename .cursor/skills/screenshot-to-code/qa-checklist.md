# Visual QA Checklist

Run after implementation. Compare live UI (or code structure) against source image(s).

## Fidelity score (1–4)

Pick one and state it explicitly:

- **4** — Near pixel-faithful: layout, copy, spacing, color
- **3** — Correct structure; small spacing/color/icon drift
- **2** — Same idea, wrong hierarchy or missing blocks
- **1** — Wrong or broken

Ship only at **≥ 3** unless the user accepts lower.

## Structure

- [ ] Same major regions in the same order
- [ ] Relative proportions roughly match (sidebar width, hero height, etc.)
- [ ] No extra marketing chrome the design did not have
- [ ] No missing sections present in the screenshot

## Typography & copy

- [ ] All visible strings match exactly (including casing/punctuation)
- [ ] Hierarchy (title vs body vs caption) matches
- [ ] Truncation / wrapping behaves sensibly

## Color & surfaces

- [ ] Backgrounds and surfaces match intent (use theme tokens)
- [ ] Borders / dividers present where shown
- [ ] Accent usage matches (primary buttons, links, badges)
- [ ] Dark mode not broken if app is theme-aware

## Spacing & alignment

- [ ] Consistent gap rhythm
- [ ] Columns/rows align
- [ ] Padding inside cards/panels matches density of design

## Components & controls

- [ ] Buttons use correct variant (primary/secondary/ghost)
- [ ] Inputs, selects, tables match existing Samyoj patterns
- [ ] Icons present; size/weight feel right
- [ ] Badges, chips, status colors correct

## Assets

- [ ] Logos not crude redraws when a real asset exists
- [ ] No full-screenshot-as-background hack
- [ ] Images not blurry from CSS upscaling

## Responsive

- [ ] If mobile source: no device bezel; usable narrow layout
- [ ] If desktop source: does not collapse incorrectly at default width
- [ ] Touch targets ≥ ~44px where Samyoj buttons already enforce it

## Behavior smoke

- [ ] Primary click paths work (or stubbed with clear TODO only if agreed)
- [ ] No console/type errors introduced
- [ ] `client` typecheck/build passes when TS changed

## Diff notes

List remaining mismatches for the next edit pass:

1. …
2. …
