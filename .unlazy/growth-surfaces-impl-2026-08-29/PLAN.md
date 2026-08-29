# Plan: Growth surfaces implementation (waves 1–3)

Scope: growth-surfaces-impl-2026-08-29
Depth: tree 2
Mode: orchestrated (sequential dispatch — CampaignsPage and Settings overlap across waves)

## Contract

- Spec: `docs/product/GROWTH_SURFACES_SPEC_2026-08-29.md`
- Keep existing working product. Polish/extend named surfaces only.
- Number isolation, consent fail-closed, no App ID in Settings.
- Do not start SAMYOJ-35 TARGET billing, Phase C drips, live WebRTC transfer.
- Do not fake Meta remaining unique-user quota, skip template review across WABAs, sell a green tick, retry AMBIGUOUS, or treat CRM Open as the 24h window.
- Toolchain: Node 22+, bash, repo-root CWD. Prisma migrate via existing `db:migrate-startup-safe` path after adding a non-destructive migration.

## Interfaces

- `GET /analytics/overview` adds `qualityRating`, `messagingLimitTier`, `promoConversations`, `serviceConversations` (null when no ConversationCharge rows).
- `GET /campaigns/quota` adds `dailySendLimit`, `remaining`, `reservedSendCount`. Labels: Samyoj daily send cap.
- `GET /inbox` accepts `window=open|closed` on `cs24hWindowOpensAt` (fail closed if missing).
- `GET /campaigns/:id/cohorts` + `GET /campaigns/:id/cohorts/:kind` for retarget lists.
- `GET /templates/starters` returns 3 UTILITY/AUTH definitions. Clone still uses existing `/templates/from-library` or create.
- WhatsApp numbers list includes `qualityRating`, `officialBusinessAccount`, `messagingLimitTier`.

## Tree

- 1 Growth surfaces impl .............. GATES.md
  - 1.1 Wave 1 ops truth ...... gates/node-1.1.md
    - 1.1.1 Honesty (CTR / meta-health)
    - 1.1.2 Dashboard quality + promo + Samyoj cap line
    - 1.1.3 Campaigns quota bar + wizard
    - 1.1.4 Inbox CSW chips
  - 1.2 Wave 2 money engine ... gates/node-1.2.md
    - 1.2.1 Campaign retarget wizard
    - 1.2.2 Featured 3 templates
  - 1.3 Wave 3 extras ......... gates/node-1.3.md
    - 1.3.1 wa.me website button
    - 1.3.2 OBA / official check checklist

Leaves run sequentially in this session (shared CampaignsPage / Settings / WhatsappNumber).

## Status log

Append-only via `gate-check.mjs --scope growth-surfaces-impl-2026-08-29 --log`.
