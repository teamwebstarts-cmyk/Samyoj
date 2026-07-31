# Reference — screenshot-to-code methodology

Distilled from [abi/screenshot-to-code](https://github.com/abi/screenshot-to-code) (research only; not vendored). Use these ideas inside Cursor for Samyoj; do not clone the app unless the user asks.

## What that project does

1. Accepts screenshot / mockup / Figma still / video frames
2. Builds stack-specific system + user prompts (`detail: high` on images)
3. Runs an **agent tool loop** (create → preview → edit → asset tools)
4. Generates **parallel variants** from different models
5. Streams code; supports iterative **update** turns
6. Evaluates outputs on a **1–4** visual scale

## Agent tool loop (conceptual)

Their backend tools map to Cursor capabilities as follows:

| Their tool | Cursor equivalent |
|------------|-------------------|
| Read image (vision) | Read tool on image paths / attachments |
| `create_file` | Write new page/component files |
| `edit_file` (exact replace) | StrReplace / focused edits |
| `extract_assets` | Crop/reuse repo assets; describe precise crops |
| `generate_images` / `edit_images` | GenerateImage only if user asked for assets |
| `screenshot_preview` | Visual re-Read of result; user screenshots; build/preview |
| `retrieve_option` | Compare alternative approaches before committing |

Guardrail idea: cap edit/preview loops; stop when fidelity ≥ 3.

## Prompt principles worth keeping

From their create/image + system prompts:

- Make the page look **exactly** like the screenshot
- Use **exact text** from the screenshot
- Extract real image assets; generate only when not extractable
- Never use the full screenshot as the layout
- After create/edit, **visually verify** and fix
- Updates: surgical edits, not full file regeneration
- Multiple screenshots → pages/tabs/nav, not one mashed layout
- Mobile: drop device/browser chrome
- Design system block wins on conflict when provided

## Pipeline stages (their backend)

Approximate mapping:

1. Parameter extraction (stack, input mode, create vs update)
2. Prompt assembly (image / text / video)
3. Model selection (variants)
4. Agentic generation + tools
5. Post-process assets
6. Human/eval rating

Samyoj skill collapses this to: **Analyze → Spec → Map → Implement → QA → Iterate**.

## Evaluation practice

- Small set of fixed screenshot fixtures
- Score 1–4; average multiple runs when comparing approaches
- Trust structured notes over vague “looks fine”
- Distinctive fixtures (clear logo + clear structure) make QA easier

## What we deliberately change for Samyoj

| screenshot-to-code default | Samyoj skill |
|----------------------------|--------------|
| Standalone HTML + CDN Tailwind/React | Integrate into `client/` React+TS+Tailwind app |
| Multiple LLM variants always | One solid implementation; optional alternate only if asked |
| Playwright preview tool | Read images + checklist + user verification |
| Replicate image gen always on | Only when needed / requested |
| Generic new page | Prefer existing `components/ui` and theme CSS variables |

## Sources (upstream)

- Repo: https://github.com/abi/screenshot-to-code
- Agent instructions: `AGENTS.md`
- Design docs: `design-docs/agent-tool-calling-flow.md`, `commits-and-variants.md`
- Prompts: `backend/prompts/system_prompt.py`, `backend/prompts/create/image.py`
- QA notes: `QA.md`, `Evaluation.md`
