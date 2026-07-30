import subprocess, os, signal, time

# Kill old server
subprocess.run("pkill -f 'tsx watch src/index.ts'", shell=True)
time.sleep(2)
print("Old server killed")

# Restart
cmd = "cd /workspaces/Samyoj/server && NODE_ENV=development DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whatsapp_platform REDIS_URL=redis://localhost:6379 node /workspaces/Samyoj/server/node_modules/.bin/tsx watch src/index.ts"
proc = subprocess.Popen(cmd, shell=True, stdout=open("/tmp/server.log","w"), stderr=subprocess.STDOUT, preexec_fn=os.setsid)
time.sleep(5)
with open("/tmp/server.log") as f:
    log = f.read()
    if "API server started" in log:
        print("SERVER RESTARTED OK!")
        print(log[-500:])
    else:
        print("WAITING...")
        time.sleep(5)
        with open("/tmp/server.log") as f2:
            print(f2.read()[-500:])
