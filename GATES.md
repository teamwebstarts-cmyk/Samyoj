# Gates: Billing Remediation

OWNS: server/src/modules/billing/**, server/prisma/schema.prisma, server/src/middleware/plan-guard.ts, server/src/workers/**

Scope: Fix plan renewal deadlock, implement GST invoicing, add stale order cron, replay contact overflows, and eliminate dev bypass.

- [ ] G1: Plan Renewal Deadlock Fixed
  CHECK: npx vitest run src/modules/billing/billing-transitions.test.ts --reporter=basic | grep -c "fail"
  EXPECT: 0
  CWD: server
  EVIDENCE: pending

- [ ] G2: GST Invoicing Schema Added
  CHECK: grep -c "model Invoice {" prisma/schema.prisma
  EXPECT: 1
  CWD: server
  EVIDENCE: pending

- [ ] G3: Dev Bypass in Plan Guard Eliminated
  CHECK: grep -c "bypassPlanGuardsForLocalTesting" src/middleware/plan-guard.ts
  EXPECT: 0
  CWD: server
  EVIDENCE: pending

- [ ] G4: Stale Order Reconciliation Worker Created
  CHECK: ls src/workers/billing-reconciliation.worker.ts >/dev/null 2>&1 && echo "1" || echo "0"
  EXPECT: 1
  CWD: server
  EVIDENCE: pending

- [ ] G5: All Billing Tests Pass
  CHECK: npx vitest run src/modules/billing/ --reporter=basic | grep -c "fail"
  EXPECT: 0
  CWD: server
  EVIDENCE: pending
