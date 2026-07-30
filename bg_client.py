import subprocess, os
cmd = "cd /workspaces/Samyoj/client && NODE_ENV=development VITE_SOCKET_URL=http://localhost:5000 npx vite --port 5173 --host 0.0.0.0"
proc = subprocess.Popen(cmd, shell=True, stdout=open("/tmp/client.log","w"), stderr=subprocess.STDOUT, preexec_fn=os.setsid)
print("CLIENT_STARTED PID=" + str(proc.pid))
import time
time.sleep(6)
with open("/tmp/client.log") as f:
    print(f.read()[-2000:])
