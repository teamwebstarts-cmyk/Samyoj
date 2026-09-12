# Gates: CRM leftover recheck

OWNS: docs/audit/CRM_SURFACE_AUDIT_2026-09-12.md, .unlazy/crm-leftover-recheck/**

Scope: Recheck every leftover finding from the CRM surface audit, implement remaining production-risk fixes that do not require live-host proof, and reverify.

- [x] G1: leftover P1 findings are classified as already-fixed, newly-fixed, deferred-with-reason, or live-only
  EVIDENCE: `docs/audit/CRM_SURFACE_AUDIT_2026-09-12.md` leftover recheck 2026-09-13 lists newly-fixed items and remaining deferred/live-only items.

- [x] G2: remaining code-level production-risk leftovers that can be fixed without TARGET billing, live transfer, or Phase C are implemented
  EVIDENCE: skipCreditCheck, inbound stage claim, webhook health queue, import tag wipe, provider-status lock, webhook delivery idempotency, campaign repeat recovery, Content Draft number bind, inbox conversation number IDs, handoff number-scope, invite accept, mustResetPassword mutation block.

- [x] G3: focused tests and server/client builds pass after leftover fixes
  CHECK: node verify-leftover.mjs
  EXPECT: crm-leftover-recheck-ok
  EVIDENCE: exit=0; output=crm-leftover-recheck-ok. Follow-up full server suite: 175 files / 1,120 tests passed. Client: 40 files / 183 tests passed. Additive migration `20260913010000_content_draft_whatsapp_number` applied locally.
