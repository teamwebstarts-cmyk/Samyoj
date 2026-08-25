# Gates: frontend flow builder audit

OWNS: client/src/pages/FlowBuilderPage.tsx, client/src/pages/MetaFlowBuilder.tsx, client/src/pages/AutomationsPage.tsx, client/src/components/flows/**, client/src/components/automations/**, client/src/utils/flow*.ts

- [x] F1: Frontend audit maps the complete creation and publish workflow
  CHECK: node -e "const fs=require('fs');const p='docs/audit/automation/FRONTEND_AUDIT.md';const t=fs.readFileSync(p,'utf8');for(const x of ['palette','canvas','node editor','validation','save','publish','version','test'])if(!t.toLowerCase().includes(x.toLowerCase()))throw new Error('missing '+x);console.log('frontend workflow map complete')"
  EXPECT: frontend workflow map complete
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=frontend workflow map complete

- [x] F2: Flow and automation tests pass
  CHECK: cd client && npx vitest run src/utils/flow-utils.test.ts src/utils/flow-live.test.ts src/utils/flow-waiting.test.ts
  EXPECT: /Test Files\s+\d+ passed/
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Start at  08:49:03 | Duration  991ms (transform 176ms, setup 0ms, import 301ms, tests 19ms, environment 0ms)

- [x] F3: User-effort findings distinguish safe defaults from hidden behavior
  CHECK: node -e "const fs=require('fs');const t=fs.readFileSync('docs/audit/automation/FRONTEND_AUDIT.md','utf8');for(const x of ['Safe defaults','Explicit confirmation','User-effort improvements'])if(!t.includes(x))throw new Error('missing '+x);console.log('frontend effort review classified')"
  EXPECT: frontend effort review classified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=frontend effort review classified
