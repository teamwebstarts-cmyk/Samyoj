# Plan: Growth surfaces research (quality, quota, templates, retargeting)

Scope: growth-surfaces-2026-08-29
Depth: tree 2
Mode: orchestrated

## Contract

- Interfaces: each leaf writes one markdown research note under `docs/product/research-notes/`. Synthesis leaf writes `docs/product/GROWTH_SURFACES_PHASE_2026-08-29.md` with a GO / DEFER / NO-GO table for every user ask.
- Ownership: disjoint paths listed on each leaf ledger. No concurrent overlap.
- Dependencies: synthesis (`leaf-1.2.1`) needs `leaf-1.1.1`, `leaf-1.1.2`, `leaf-1.1.3` VERIFIED.
- Toolchain: Node 22+, bash, repo-root CWD. Official Meta docs via WebSearch/WebFetch. Samyoj mapping via repo grep/read only. Do not implement product features in this pipeline.
- Conventions: cite official URLs; never mix Meta Cloud API fees into Samyoj SaaS price; do not claim customer production-ready; do not start SAMYOJ-35 TARGET billing, Phase C automations, or live WebRTC transfer.
- Manual review: driver reviews GO/NO-GO table for policy/ban risk (green tick, template pre-verify, click tracking).

## Out of scope for this pipeline

- `/gsd/research-phase`: `gsd-tools.cjs` is not installed (`~/.claude/get-shit-done` missing; no `.planning/`). Equivalent research uses Task agents + this ledger.
- `/automate` Cursor Automations: `open_automation` is not in this session. User must run that skill in the Agents Window if they want a Cursor Automation.

## State vocabulary

Leaf: WAITING | READY | IN-FLIGHT | VERIFIED | ABANDONED
Branch: OPEN | VERIFIED | ABANDONED

## Tree

- 1 Growth surfaces research .............. GATES.md ..................... State: VERIFIED
  - 1.1 Parallel research ........ gates/node-1.1.md ............ State: VERIFIED
    - 1.1.1 Meta policy .......... gates/leaf-1.1.1.md .......... Needs: - ...... State: VERIFIED
    - 1.1.2 Samyoj surfaces ...... gates/leaf-1.1.2.md .......... Needs: - ...... State: VERIFIED
    - 1.1.3 Competitors + catalog  gates/leaf-1.1.3.md .......... Needs: - ...... State: VERIFIED
  - 1.2 Synthesis + product calls  gates/node-1.2.md ............ State: VERIFIED
    - 1.2.1 Phase decision doc ... gates/leaf-1.2.1.md .......... Needs: 1.1.1, 1.1.2, 1.1.3 .. State: VERIFIED

## Status log

Append-only via `gate-check.mjs --scope growth-surfaces-2026-08-29 --log`.
