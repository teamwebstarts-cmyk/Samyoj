#!/bin/bash
cd /workspaces/Samyoj/server
nohup node /workspaces/Samyoj/server/node_modules/.bin/tsx watch src/index.ts > /tmp/server.log 2>&1 &
echo "PID: $!"
