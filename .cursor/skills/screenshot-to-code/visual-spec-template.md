# Visual Spec Template

Fill this after Phase 1 (image analysis). Keep it tight — enough for implementation, not a novel.

```markdown
# Visual Spec: <Screen / Feature Name>

## Source
- Images: <paths or attachments>
- Type: screenshot | Figma export | mockup | recording stills
- Viewport: desktop | mobile | both

## Goal
One sentence: what the user should be able to do on this screen.

## Layout map
- Shell: (e.g. app Layout + sidebar / full-bleed auth / modal)
- Regions (top → bottom or left → right):
  1. …
  2. …
  3. …

## Component inventory
| Region | UI pieces | Samyoj reuse candidate |
|--------|-----------|------------------------|
| Header | title, actions | PageShell / existing header |
| … | … | AppButton, DataTable, … |

## Exact copy
- Title: "…"
- Buttons: "…"
- Labels / placeholders: "…"
- Empty state: "…"
(Quote strings exactly from the image.)

## Visual tokens
Map to existing CSS vars / Tailwind where possible:
- Background: …
- Surface / cards: …
- Borders: …
- Primary text / secondary / muted: …
- Accent (WhatsApp green / theme): …
- Radius / shadow: …

## Spacing & density
- Overall: compact | comfortable | airy
- Notable gaps: …

## Assets
| Asset | Description / location | Action |
|-------|------------------------|--------|
| Logo | top-left wordmark | use existing / extract / placeholder |
| Icon | … | lucide-react: `…` |

## Interactions
- Primary CTA → …
- Secondary → …
- Navigation → …
- Forms / validation cues visible in design → …

## States (if shown or required)
- Loading:
- Empty:
- Error:
- Selected / active:

## Multi-screen linking
(If multiple images) How screens connect: routes, tabs, back buttons.

## Open questions
- …
```

## When to persist

Write to `docs/ui-specs/<kebab-name>.md` when:

- The screen is large / multi-page, or
- The user asks for documentation, or
- Implementation will span multiple turns/agents

Otherwise keep the spec in chat and proceed once clear.
