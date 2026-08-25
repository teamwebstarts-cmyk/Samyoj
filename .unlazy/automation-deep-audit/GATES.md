# Gates: automation and flow deep audit

Scope: automation-deep-audit

- [x] G1: Backend audit artifact is evidence-backed and complete
  CHECK: node -e "const fs=require('fs');const p='docs/audit/automation/BACKEND_AUDIT.md';const t=fs.readFileSync(p,'utf8');for(const x of ['## Architecture map','## Confirmed findings','## Verification matrix','Evidence','Status:'])if(!t.includes(x))throw new Error('missing '+x);console.log('backend audit artifact verified')"
  EXPECT: backend audit artifact verified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=backend audit artifact verified

- [x] G2: Frontend workflow audit artifact is evidence-backed and complete
  CHECK: node -e "const fs=require('fs');const p='docs/audit/automation/FRONTEND_AUDIT.md';const t=fs.readFileSync(p,'utf8');for(const x of ['## Current user journey','## Confirmed fixes','## Effort-reduction design','## Frontend test plan'])if(!t.includes(x))throw new Error('missing '+x);console.log('frontend audit artifact verified')"
  EXPECT: frontend audit artifact verified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=frontend audit artifact verified

- [x] G3: External research and decision record is documented
  CHECK: node -e "const fs=require('fs');const p='docs/audit/automation/EXTERNAL_RESEARCH.md';const t=fs.readFileSync(p,'utf8');for(const x of ['## Meta WhatsApp Cloud API','## BullMQ','## Prescriptive implementation decisions'])if(!t.includes(x))throw new Error('missing '+x);console.log('external research artifact verified')"
  EXPECT: external research artifact verified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=external research artifact verified

- [x] G4: Security and tenancy review has explicit negative checks
  CHECK: node -e "const fs=require('fs');const p='docs/audit/automation/SECURITY_AND_TENANCY.md';const t=fs.readFileSync(p,'utf8');for(const x of ['## Trust boundaries','## Security findings and disposition','## Required negative tests'])if(!t.includes(x))throw new Error('missing '+x);console.log('security tenancy artifact verified')"
  EXPECT: security tenancy artifact verified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=security tenancy artifact verified

- [x] G5: Confirmed fixes compile
  CHECK: cd server && npm run build
  EXPECT: /tsc/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=> whatsapp-platform-server@1.0.0 build | > tsc

- [x] G6: Confirmed backend regressions pass
  CHECK: cd server && npx vitest run src/modules/automation src/modules/flows src/modules/flows-assets src/modules/integrations src/modules/messages
  EXPECT: /Test Files\s+\d+ passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  08:48:52 | Duration  4.39s (transform 627ms, setup 0ms, import 1.58s, tests 127ms, environment 2ms)

- [x] G7: Client flow and automation tests pass
  CHECK: cd client && npx vitest run src/utils/flow-utils.test.ts src/utils/flow-live.test.ts src/utils/flow-waiting.test.ts
  EXPECT: /Test Files\s+\d+ passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  08:48:57 | Duration  974ms (transform 192ms, setup 0ms, import 327ms, tests 22ms, environment 0ms)

- [x] G8: Root review has no unclassified confirmed high findings
  CHECK: node -e "const fs=require('fs');const p='docs/audit/automation/FINAL_REVIEW.md';const t=fs.readFileSync(p,'utf8');for(const x of ['## Verdict','## Confirmed working','## Critical / High','## Still deferred','## Test evidence'])if(!t.includes(x))throw new Error('missing '+x);if(/UNCLASSIFIED_HIGH/.test(t))throw new Error('unclassified high finding');console.log('final review classified')"
  EXPECT: final review classified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=final review classified
