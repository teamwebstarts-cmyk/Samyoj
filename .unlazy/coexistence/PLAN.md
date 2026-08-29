# WhatsApp Coexistence — /unlazy contract

**Order:** Phase A (ES v4) → verify → Phase B (Coexistence).

## Depth tree

```
coexistence/
├── phase-a-es-v4/          # ES v4 migration + hardening
├── phase-a-meta-dashboard.md
└── phase-b-coexistence/
    ├── GATES.md            # integration
    ├── branch-connect/
    ├── branch-webhooks/
    └── branch-product/
```

## Dependencies

| Leaf | Depends on |
|------|------------|
| phase-a-es-v4 | — |
| phase-b-connect | phase-a-es-v4 verified |
| phase-b-webhooks | phase-a-es-v4 verified |
| phase-b-product | phase-b-webhooks |

## Status log

| When | Event |
|------|-------|
| 2026-08-29 | PLAN + Phase A gates created; ES v4 implementation started |
