# Gates: fresh CRM data and VPS deploy

OWNS: GATES.md

Scope: Empty the local and VPS app databases, deploy origin/v8-esv4, and prove the API is healthy with no old WhatsApp numbers.

- [ ] G1: Local database has no WhatsApp numbers after the wipe
  CHECK: node -e "const {execSync}=require('child_process'); const n=execSync(\"docker exec samyoj-postgres-1 psql -U postgres -d whatsapp_platform -tAc \\\"SELECT count(*) FROM whatsapp_numbers\\\"\").toString().trim(); if(n!=='0'){console.error('numbers='+n); process.exit(1)} console.log('local numbers empty')"
  EXPECT: local numbers empty
  EVIDENCE: pending

- [ ] G2: VPS database has no WhatsApp numbers after the wipe
  CHECK: ssh -i /home/codespace/.ssh/google_compute_engine -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new codespace@34.47.220.76 "n=$(sudo -u postgres psql -d whatsapp_platform -tAc 'SELECT count(*) FROM whatsapp_numbers'); test \"$n\" = 0 && echo vps-numbers-empty"
  EXPECT: vps-numbers-empty
  EVIDENCE: pending

- [ ] G3: VPS is on the pushed v8-esv4 commit and the API health check passes
  CHECK: ssh -i /home/codespace/.ssh/google_compute_engine -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new codespace@34.47.220.76 "cd /home/samyoj/Samyoj && test $(git rev-parse --short HEAD) = 5a837b0 && curl -fsS --max-time 10 http://127.0.0.1:8000/health | grep -q '\"status\":\"ok\"' && echo vps-deploy-healthy"
  EXPECT: vps-deploy-healthy
  EVIDENCE: pending
