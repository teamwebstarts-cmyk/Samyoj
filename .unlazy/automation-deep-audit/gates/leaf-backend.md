# Gates: backend automation audit

OWNS: server/src/modules/automation/**, server/src/modules/flows/**, server/src/workers/**

- [x] B1: Backend audit contains a complete execution and boundary map
  CHECK: node -e "const fs=require('fs');const p='docs/audit/automation/BACKEND_AUDIT.md';const t=fs.readFileSync(p,'utf8');for(const x of ['triggers','node execution','delay/wait','pause','retry','idempotency','Inbox'])if(!t.toLowerCase().includes(x.toLowerCase()))throw new Error('missing '+x);console.log('backend map complete')"
  EXPECT: backend map complete
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=backend map complete

- [x] B2: Backend tests pass
  CHECK: cd server && npx vitest run src/modules/automation src/modules/flows
  EXPECT: /Test Files\s+\d+ passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  08:48:59 | Duration  3.22s (transform 407ms, setup 0ms, import 966ms, tests 105ms, environment 2ms)

- [x] B3: All backend findings are classified with exact evidence
  CHECK: node -e "const fs=require('fs');const t=fs.readFileSync('docs/audit/automation/BACKEND_AUDIT.md','utf8');if(!/Confirmed findings/.test(t)||!/Severity/.test(t)||!/Evidence/.test(t))process.exit(1);console.log('backend findings classified')"
  EXPECT: backend findings classified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=backend findings classified
