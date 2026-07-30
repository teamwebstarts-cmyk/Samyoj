import subprocess, os
cmd = "cd /workspaces/Samyoj/server && NODE_ENV=development DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whatsapp_platform REDIS_URL=redis://localhost:6379 node /workspaces/Samyoj/server/node_modules/.bin/tsx watch src/index.ts"
proc = subprocess.Popen(cmd, shell=True, stdout=open("/tmp/server.log","w"), stderr=subprocess.STDOUT, preexec_fn=os.setsid)
print("SERVER_STARTED PID=" + str(proc.pid))
import time
time.sleep(5)
with open("/tmp/server.log") as f:
    print(f.read()[-2000:])
