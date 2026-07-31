---
name: screenshot-to-code
description: >-
  Converts UI screenshots, Figma exports, mockups, and screen recordings into
  production code via deep visual analysis, a written visual spec, implementation
  into the existing Samyoj React+Tailwind design system, then visual QA and
  iteration. Use when the user shares any image/screenshot/mockup/Figma design,
  asks to implement a UI from a picture, says screenshot-to-code, design-to-code,
  or image-to-UI.
---

# Screenshot → Spec → Code → QA

Adapted from [abi/screenshot-to-code](https://github.com/abi/screenshot-to-code) agent methodology for Samyoj (`client/`: React 18 + Vite + Tailwind + existing UI primitives).

**Never skip Phase 1–2.** Jumping straight to code is the main failure mode.

## Progress checklist

Copy and track:

```
Screenshot→Code:
- [ ] Phase 1: Deep image analysis (Read every attached image)
- [ ] Phase 2: Visual spec written (confirm with user if ambiguous)
- [ ] Phase 3: Map to existing Samyoj components / routes
- [ ] Phase 4: Implement (surgical edits preferred)
- [ ] Phase 5: Visual QA vs source image(s)
- [ ] Phase 6: Fix mismatches; re-check
```

---

## Phase 1 — Deep image analysis (mandatory)

For **every** attached or referenced image, use the Read tool and inspect pixels carefully. Do not rely on filename alone.

Extract and note:

| Layer | What to capture |
|-------|-----------------|
| Structure | Page/shell, regions (nav, sidebar, main, footer), columns, cards |
| Hierarchy | What dominates the first viewport; primary CTA |
| Typography | Approximate sizes, weights, alignment, truncation |
| Color | Backgrounds, surfaces, borders, accents, text tiers |
| Spacing | Gaps, padding rhythm, alignment grids |
| Components | Buttons, inputs, tables, badges, tabs, modals, lists |
| States | Empty, loading, selected, hover cues if visible |
| Assets | Logos, icons, photos, illustrations (exact crops, not redraws) |
| Copy | **Exact** visible text — do not paraphrase UI strings |
| Responsive | Desktop vs mobile; ignore device/browser chrome on phone shots |

### Multi-image rules

- Different pages → separate routes/views + navigation between them
- Tabs/views of one app → one shell + view switching
- Unrelated shots → scaffold sections labeled clearly
- Mobile frames → implement the UI only; drop status bar / device bezel

### Asset rules (from screenshot-to-code)

- Prefer **real** logos/images from the design or repo assets — do not invent SVG approximations of brand marks when a source exists
- Never paste the whole screenshot as a background to fake layout
- Crop/describe assets precisely (location, nearby context, which screenshot #)
- Low-res assets that must display large → upscale or replace properly; do not CSS-stretch blur

---

## Phase 2 — Visual specification document

Before coding, produce a short **Visual Spec** (chat or `docs/ui-specs/<name>.md` if the user wants it persisted).

Use the template in [visual-spec-template.md](visual-spec-template.md).

Minimum sections:

1. Goal / screen name
2. Layout map (regions)
3. Component inventory
4. Exact copy
5. Tokens (map to Samyoj CSS vars / Tailwind when possible)
6. Interactions & empty/loading states
7. Open questions (ask user if blocking)

If the design conflicts with Samyoj’s existing design system (`client/src/index.css` theme vars, `AppButton`, `PageShell`, etc.), **prefer the Samyoj design system** unless the user explicitly wants pixel-perfect brand-new styling.

---

## Phase 3 — Map into Samyoj codebase

1. Find the target route/page under `client/src/pages/`
2. Reuse primitives first: `client/src/components/ui/*`, layout shells, existing feature folders
3. Match patterns already used (theme classes: `bg-theme-surface`, `text-theme-fg`, `btn-primary`, etc.)
4. Prefer lucide-react icons already in the project
5. Do not introduce a new CSS framework or standalone HTML/CDN Tailwind page

Stack for this repo: **React + TypeScript + Tailwind** inside the existing app — not a single-file HTML prototype.

---

## Phase 4 — Implementation

### Create vs update

| Situation | Approach |
|-----------|----------|
| New screen | Create page/components; wire route if needed |
| Change existing UI | Surgical edits only — do not rewrite the whole file |
| User points at one region | Change that element and its rendering logic only |

### Implementation order

1. Shell / layout regions
2. Static structure + exact copy
3. Shared components / tokens
4. Interactive behavior
5. Assets / icons
6. Responsive polish

### Coding constraints

- Match spacing and visual hierarchy from the spec
- Keep TypeScript types clean; follow nearby file style
- No drive-by refactors unrelated to the design
- Concise chat updates; put code in files, not giant chat dumps

---

## Phase 5 — Visual QA (mandatory)

Compare implementation against source image(s) using [qa-checklist.md](qa-checklist.md).

Rate fidelity **1–4** (screenshot-to-code eval scale):

| Score | Meaning |
|-------|---------|
| 4 | Near-exact layout, copy, spacing, colors |
| 3 | Correct structure; minor spacing/color drift |
| 2 | Recognizable but wrong hierarchy or missing sections |
| 1 | Wrong screen / unusable |

Target **≥ 3** before calling done. If ≤ 2, fix and re-check.

### What to verify

- [ ] Exact visible strings
- [ ] Region order and relative sizes
- [ ] Alignment / gaps
- [ ] Button/input variants match design intent
- [ ] Icons present and sized correctly
- [ ] Light/dark if theme-aware
- [ ] Mobile and desktop if both were provided
- [ ] No leftover placeholder lorem unless in the design

### Runtime checks when UI is runnable

- `cd client && npm run build` (or typecheck) if types touched
- Manually note what the user should click to verify
- Prefer fixing visual bugs over rewriting the whole screen

---

## Phase 6 — Iterate

When the user requests changes:

1. Treat feedback as **targeted edits** (screenshot-to-code `edit_file` philosophy)
2. If they attach a new annotated screenshot, re-run Phase 1 on the delta only
3. Re-run QA on changed regions
4. Summarize in 1–2 sentences what changed

---

## Figma / MCP path

If a Figma URL is provided and Figma MCP/skills are available:

1. Prefer official design-context / Code Connect skills over guessing from a flat PNG
2. Still write a Visual Spec before implementing into Samyoj
3. Still run Phase 5 QA against the reference

If only a PNG/JPG export exists, use this skill’s image path — do not invent Figma node IDs.

---

## Anti-patterns

- Coding before reading the image with the Read tool
- Paraphrasing UI copy
- Rebuilding shared components that already exist
- Embedding the screenshot as the page
- Ignoring Samyoj theme tokens for a one-off purple/generic AI look
- Declaring done without a fidelity self-score

---

## Additional resources

- Methodology notes: [reference.md](reference.md)
- Spec template: [visual-spec-template.md](visual-spec-template.md)
- QA checklist: [qa-checklist.md](qa-checklist.md)
