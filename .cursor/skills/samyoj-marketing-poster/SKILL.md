---
name: samyoj-marketing-poster
description: >-
  Research-backed workflow for Samyoj AI Studio marketing posters: Hunyuan/GMI
  background + editable type overlay. Use when generating or prompting social
  ads, offer posters, carousel heroes, or improving imagePrompt for campaigns.
---

# Marketing poster generation (Samyoj)

## Production rule

Hunyuan has one `prompt` field, not a separate system role. Samyoj sends the creative-director brief, then the user's brief, then exact headline/offer/CTA lines to render in the image.

Copy (Instagram, WhatsApp, email) uses the marketing-copy system prompt on the text model. The app still requires one JSON object so the studio can place caption, template, and email into the right cards.

Code: `prompts/image-creative-director.ts`, `prompts/marketing-copy-system.ts`.

## Background prompt structure (use in `imagePrompt` / Hunyuan)

Always include, in order:

| Block | What to write |
| --- | --- |
| Format | `Square 1:1 marketing poster key visual` or `9:16 story hero` |
| Subject | One focal scene (gifts, product, diya, store flat lay) |
| Campaign mood | Occasion + palette (Christmas red/green/gold, Diwali maroon/gold) |
| **Safe zones** | `large soft dark gradient top third for headline`, `clean band for offer badge`, `uncluttered bottom fifth for CTA` |
| Lighting | natural / soft box / golden hour |
| Hard exclude | `no text, no letters, no numbers, no logos, no watermarks, no signage` |

**Bad:** `poster with text "50% OFF"` — model invents gibberish.

**Good:** `gift boxes and pine on marble, top third empty dark gradient for headline overlay, no text`.

## Copy hierarchy (overlay / slide elements)

| Role | Rules |
| --- | --- |
| Headline | 3–8 words, benefit or occasion |
| Subhead | One line urgency or dates |
| Offer | Short (`30% OFF`, `From ₹999`) |
| CTA | 2–4 words (`Shop gifts`, `Order now`) |

Contrast: white on dark scrim, or dark on light negative space. Test at phone thumbnail width.

## Advanced prompt checklist (from Prompt Library / GPT Image 2 guides)

When a model **does** render type (not Hunyuan default):

- Literal copy in **quotes**, each block named (`Headline (EXACT): "..."`)
- Font family + weight + color + zone (top third, centered)
- `no extra text, no duplicate lines`
- Keep total quoted words ≤ 12 for reliability

For Samyoj: put quoted copy in **slide `elements`**, not in Hunyuan payload.

## Samyoj code map

- `buildMarketingBackgroundPrompt()` — `server/src/modules/ai-studio/marketing-poster-prompts.ts`
- `stampPackWithModelImages()` — parallel Hunyuan calls, URLs on slides
- `SlideArt` — full-bleed `slide.image` + text from `elements`

## References (research)

- Wireflow: composition + empty space, typesetter in design tool
- ForgeEcho: safe zones, vibe + hex, no gibberish text in image
- Lovart: negative-space-dominant prompts
- Prompt Library: quote literal text OR composite in Figma/Canva
- GPT Image 2 marketing guides: hierarchy blocks, layout before style
