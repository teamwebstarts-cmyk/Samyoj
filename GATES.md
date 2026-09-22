# Gates: fresh CRM data and VPS deploy

OWNS: GATES.md

Scope: Empty the local and VPS app databases, deploy origin/v8-esv4, and prove the API is healthy with no old WhatsApp numbers.

- [x] G1: Local database has no WhatsApp numbers after the wipe
  CHECK: node -e "const {execSync}=require('child_process'); const n=execSync(\"docker exec samyoj-postgres-1 psql -U postgres -d whatsapp_platform -tAc \\\"SELECT count(*) FROM whatsapp_numbers\\\"\").toString().trim(); if(n!=='0'){console.error('numbers='+n); process.exit(1)} console.log('local numbers empty')"
  EXPECT: local numbers empty
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=609b55c48eed/43 entries; output=local numbers empty

- [x] G2: VPS database has no WhatsApp numbers after the wipe
  CHECK: node -e 'const {execFileSync}=require("child_process"); const o=execFileSync("ssh",["-i","/home/codespace/.ssh/google_compute_engine","-o","IdentitiesOnly=yes","-o","StrictHostKeyChecking=accept-new","codespace@34.47.220.76","sudo -u postgres psql -d whatsapp_platform -tAc \"SELECT count(*) FROM whatsapp_numbers\""],{encoding:"utf8"}).trim(); if(o!=="0"){console.error(o); process.exit(1)} console.log("vps-numbers-empty")'
  EXPECT: vps-numbers-empty
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=609b55c48eed/43 entries; output=vps-numbers-empty

- [x] G3: VPS is on the pushed v8-esv4 commit and the API health check passes
  CHECK: node -e 'const {execFileSync}=require("child_process"); const ssh=(args)=>execFileSync("ssh",["-i","/home/codespace/.ssh/google_compute_engine","-o","IdentitiesOnly=yes","-o","StrictHostKeyChecking=accept-new","codespace@34.47.220.76",...args],{encoding:"utf8"}); const head=ssh(["sudo","-u","samyoj","git","-C","/home/samyoj/Samyoj","rev-parse","--short","HEAD"]).trim(); const health=ssh(["curl","-fsS","--max-time","10","http://127.0.0.1:8000/health"]); if(head!=="5a837b0"||!health.includes("\"status\":\"ok\"")){console.error(head); process.exit(1)} console.log("vps-deploy-healthy")'
  EXPECT: vps-deploy-healthy
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=609b55c48eed/43 entries; output=vps-deploy-healthy
