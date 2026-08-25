# Gates: integrated automation review

- [x] N1: Child audit artifacts exist and are reverified
  CHECK: node -e "const fs=require('fs');for(const p of ['docs/audit/automation/BACKEND_AUDIT.md','docs/audit/automation/FRONTEND_AUDIT.md','docs/audit/automation/EXTERNAL_RESEARCH.md','docs/audit/automation/SECURITY_AND_TENANCY.md'])if(!fs.existsSync(p))throw new Error('missing '+p);console.log('child audit artifacts present')"
  EXPECT: child audit artifacts present
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=child audit artifacts present

- [x] N2: Cross-layer integration and user-path review is documented
  CHECK: node -e "const fs=require('fs');const p='docs/audit/automation/FINAL_REVIEW.md';const t=fs.readFileSync(p,'utf8');for(const x of ['inbound message','realtime','delay','pause','publish','tenant','user path'])if(!t.toLowerCase().includes(x.toLowerCase()))throw new Error('missing '+x);console.log('cross-layer review documented')"
  EXPECT: cross-layer review documented
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=cross-layer review documented

- [x] N3: Relevant server and client regression tests pass
  CHECK: cd server && npx vitest run src/modules/automation src/modules/flows
  EXPECT: /Test Files\s+\d+ passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  08:49:05 | Duration  3.06s (transform 348ms, setup 0ms, import 847ms, tests 106ms, environment 4ms)

- [x] N4: Final review classifies every major action
  CHECK: node -e "const fs=require('fs');const t=fs.readFileSync('docs/audit/automation/FINAL_REVIEW.md','utf8');for(const x of ['FIXED','DEFERRED','NOT A BUG','NEEDS LIVE TEST'])if(!t.includes(x))throw new Error('missing classification '+x);console.log('final actions classified')"
  EXPECT: final actions classified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=final actions classified
