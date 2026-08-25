# Gates: external automation research

OWNS: docs/audit/automation/**, .cursor/agents/samyoj-automation-audit.md

- [x] R1: Research cites primary sources and maps them to Samyoj decisions
  CHECK: node -e "const fs=require('fs');const p='docs/audit/automation/EXTERNAL_RESEARCH.md';const t=fs.readFileSync(p,'utf8');const urls=(t.match(/https?:\/\//g)||[]).length;if(urls<5)throw new Error('fewer than five URLs');for(const x of ['Sources','Applicable patterns','Decisions for Samyoj'])if(!t.includes(x))throw new Error('missing '+x);console.log('research sources and decisions verified')"
  EXPECT: research sources and decisions verified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=research sources and decisions verified

- [x] R2: Audit documentation defines explicit non-goals and a prioritized backlog
  CHECK: node -e "const fs=require('fs');for(const p of ['docs/audit/automation/EXTERNAL_RESEARCH.md','docs/audit/automation/README.md']){const t=fs.readFileSync(p,'utf8');for(const x of ['Non-goals','P0','P1','P2'])if(!t.includes(x))throw new Error(p+' missing '+x)}console.log('research backlog verified')"
  EXPECT: research backlog verified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=research backlog verified

- [x] R3: Reusable project subagent has valid frontmatter and review rules
  CHECK: node -e "const fs=require('fs');const t=fs.readFileSync('.cursor/agents/samyoj-automation-audit.md','utf8');for(const x of ['name: samyoj-automation-audit','description:','Never claim a fix without evidence','whatsappNumberId'])if(!t.includes(x))throw new Error('missing '+x);console.log('automation audit subagent verified')"
  EXPECT: automation audit subagent verified
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=automation audit subagent verified
