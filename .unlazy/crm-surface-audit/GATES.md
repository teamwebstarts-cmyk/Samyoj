# Gates: CRM surface audit

OWNS: docs/audit/CRM_SURFACE_AUDIT_2026-09-12.md, .unlazy/crm-surface-audit/**

Scope: Audit the existing non-billing CRM surfaces, document evidence-backed findings, apply minimal approved fixes, and reverify the changed paths.

- [x] G1: baseline inventory reconciles routes, server modules, shared tenancy middleware, workers, tests, and existing readiness ledgers
  EVIDENCE: `docs/audit/CRM_SURFACE_AUDIT_2026-09-12.md` records the current route/module scope, shared middleware, embedded worker model, 174 server/40 client/9 admin test-file inventory, and the existing manual gates.

- [x] G2: Inbox and WhatsApp audit has exact evidence for inbound, outbound, realtime, media, and tenant/number boundaries
  EVIDENCE: Report findings 1–12 plus the existing webhook, number-isolation, socket-room, and outbound-lease tests.

- [x] G3: AI, Train, calling, and WebRTC audit has exact evidence for routing, provider failures, usage, recordings, and known transfer limits
  EVIDENCE: Report findings 13–24 plus the focused AI/calling run: 8 files, 57 tests passed; live WebRTC/provider gates remain open.

- [x] G4: templates, Content Studio, contacts, leads, campaigns, automations, flows, and forms audit has exact evidence for consent, retries, permissions, and number scope
  EVIDENCE: Report findings 25–35 plus focused flow/automation/template/campaign tests; Meta/WABA behavior remains live-only.

- [x] G5: team, settings, auth, dashboard, reports, tickets, commerce, and media audit has exact evidence for permissions, reachability, analytics scope, and failure states
  EVIDENCE: Report findings 36–47 plus the current auth, platform, settings, analytics, and support test inventory.

- [x] G6: consolidated findings report separates verified, fixed, open, live-only, deferred, and production-blocking outcomes
  EVIDENCE: `docs/audit/CRM_SURFACE_AUDIT_2026-09-12.md` contains severity-ranked findings, verified controls, deliberate boundaries, live blockers, and implementation order.

- [x] G7: focused regression checks, builds, full suites, dependency audit, isolation audit, migration validation, and existing hardening oracles pass after fixes
  CHECK: node verify-final.mjs
  EXPECT: crm-surface-audit-final-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/crm-surface-audit; path=e3a870e24ba1/42 entries; output=crm-surface-audit-final-ok

- [x] G8: live inbound, end-to-end send, live isolation, off-host restore, and GO/NO-GO are explicitly evidenced or remain visibly open
  EVIDENCE: The audit report explicitly lists G3 fresh inbound, G4 end-to-end send, G5 live isolation, customer-like restore, real AI/WebRTC/provider checks, and final GO/NO-GO as open live-only gates. No production GO claim is made.
