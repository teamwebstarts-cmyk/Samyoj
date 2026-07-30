#!/bin/bash
cd /workspaces/Samyoj/server
sed -i "s|CLIENT_URL=http://localhost:5173|CLIENT_URL=http://localhost:5175|" .env
echo "CLIENT_URL=$(grep CLIENT_URL .env)"
