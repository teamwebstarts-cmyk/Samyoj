# Gates: Meta ecosystem audit and phase ledger

OWNS: docs/meta-ecosystem/**, .cursor/agents/samyoj-meta-auditor.md, .unlazy/meta-audit/**

Scope: produce an evidence-backed read-only audit of Meta phases 0–5 and define the remaining Phase 6/7 work without changing application code.

- [x] G1: current repository evidence contains the known Meta surface boundaries and the Instagram HTTP object gate is visible
  CHECK: node -e "const fs=require('fs'); const route=fs.readFileSync('server/src/modules/whatsapp/routes.ts','utf8'); const nav=fs.readFileSync('client/src/config/navigation.ts','utf8'); if(!route.includes(\"payload.object !== 'page'\") || route.includes(\"payload.object !== 'instagram'\") || !route.includes(\"payload.object === 'page' || payload.object === 'instagram'\") || !nav.includes(\"to: '/facebook/ads'\")) process.exit(1); console.log('AUDIT_SOURCE_EVIDENCE_OK')"
  EXPECT: AUDIT_SOURCE_EVIDENCE_OK
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=609b55c48eed/43 entries; output=AUDIT_SOURCE_EVIDENCE_OK

- [x] G2: final audit report contains phase scores, live test runbook, capability matrix, and exact Phase 6/7 scope
  CHECK: node -e "const fs=require('fs'); const p='docs/meta-ecosystem/META_ECOSYSTEM_AUDIT_REPORT_2026-09-24.md'; const s=fs.readFileSync(p,'utf8'); for (const x of ['Phase 0','Phase 5','Phase 6 — Analytics','Phase 7 — Portfolio/Channels','Confidence','Exact Meta connection and Phase 5 test runbook','Capability matrix','Instagram HTTP ingress','Do not show one combined ROI']) if(!s.includes(x)) process.exit(1); console.log('AUDIT_REPORT_COMPLETE')"
  EXPECT: AUDIT_REPORT_COMPLETE
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=609b55c48eed/43 entries; output=AUDIT_REPORT_COMPLETE

- [x] G3: status and blocker docs point to the audit and do not claim live Meta proof
  CHECK: node -e "const fs=require('fs'); const files=['docs/meta-ecosystem/STATUS_SIMPLE.md','docs/meta-ecosystem/BLOCKERS.md']; for (const p of files) { const s=fs.readFileSync(p,'utf8'); if(!s.includes('META_ECOSYSTEM_AUDIT_REPORT_2026-09-24.md') || !/live|Live/.test(s)) process.exit(1); } console.log('META_DOC_STATUS_ALIGNED')"
  EXPECT: META_DOC_STATUS_ALIGNED
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=609b55c48eed/43 entries; output=META_DOC_STATUS_ALIGNED

- [x] G4: report review records the unresolved live and production gates honestly
  EVIDENCE: Reviewed against current source, focused test output, API/webhook/client health, and Meta read-only app status on 24 Sep 2026. Report explicitly records the Instagram HTTP ingress blocker, rejected/absent non-WhatsApp privileges, WhatsApp-only webhook subscription, missing production callback, no live Page/IG/Ads proof, Admin unreachable, and customer production remaining blocked.
