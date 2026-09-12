# Gates: CRM leftover recheck

OWNS: docs/audit/CRM_SURFACE_AUDIT_2026-09-12.md, .unlazy/crm-leftover-recheck/**

Scope: Recheck every leftover finding from the CRM surface audit, implement remaining production-risk fixes that do not require live-host proof, and reverify.

- [ ] G1: leftover P1 findings are classified as already-fixed, newly-fixed, deferred-with-reason, or live-only
  EVIDENCE: pending

- [ ] G2: remaining code-level production-risk leftovers that can be fixed without TARGET billing, live transfer, or Phase C are implemented
  EVIDENCE: pending

- [ ] G3: focused tests and server/client builds pass after leftover fixes
  CHECK: node verify-leftover.mjs
  EXPECT: crm-leftover-recheck-ok
  EVIDENCE: pending
