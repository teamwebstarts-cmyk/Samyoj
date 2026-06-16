# WhatsApp Platform — Local Setup Guide

PERN stack WhatsApp automation platform. Ye guide Windows + PowerShell ke liye hai.

## TL;DR — 5 commands me start

```powershell
# 1. Docker Desktop install karo (https://www.docker.com/products/docker-desktop/) aur PC restart karo
# 2. Repo root pe jao
cd D:\whatsapp

# 3. Database + cache start karo
docker compose up -d

# 4. Database schema push karo (tables ban jayenge)
cd server; npm run db:push; npm run db:generate; cd ..

# 5. Dono server start karo
npm run dev
```

Phir browser me jao:
- **Frontend** → http://localhost:5173
- **Backend API** → http://localhost:5000/health

---

## Detailed Steps

### Prerequisites
- **Node.js 18+** (npm ke saath) — `node --version`
- **Docker Desktop** for Windows — WSL2 backend ON hona chahiye
- **Git** (optional, sirf code edits ke liye)

### Step 1: Docker install (agar nahi hai)
1. Download: https://www.docker.com/products/docker-desktop/
2. Install karo, install ke dauran **"Use WSL 2 instead of Hyper-V"** select karo
3. PC restart karo
4. Verify: `docker --version` aur `docker compose version`

### Step 2: Environment files (already created)
- `server/.env` — done (dev secrets generated, Meta creds placeholder)
- `client/.env` — done

### Step 3: Start Postgres + Redis
```powershell
cd D:\whatsapp
docker compose up -d
docker compose ps   # verify both services "healthy" hain
```

### Step 4: Database initialize
```powershell
cd D:\whatsapp\server
npm run db:push       # schema → tables create
npm run db:generate   # Prisma client generate
cd ..
```

### Step 5: Start dev servers
```powershell
cd D:\whatsapp
npm run dev
```

Ye concurrently 2 processes chalayega:
- `server` (Express + Socket.IO) → port **5000**
- `client` (Vite + React) → port **5173**

---

## Meta WhatsApp API setup (real messages bhejne ke liye)

Testing ke liye Meta creds OPTIONAL hain — UI + database + auth sab bina Meta ke bhi chalega.

Real integration ke liye:
1. https://developers.facebook.com/apps/ pe app banao
2. **WhatsApp** product add karo
3. `server/.env` me update karo:
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_VERIFY_TOKEN` (ye webhook verify ke liye same rakhna)
4. Webhook URL set karo Meta console me:
   - URL: `https://your-tunnel/api/whatsapp/webhook` (local dev ke liye `ngrok` ya `cloudflared` use karo)
   - Verify Token: jo `META_VERIFY_TOKEN` me rakha
   - Subscribe: `messages`, `message_statuses`

Local dev me webhook expose karne ke liye:
```powershell
# cloudflared quick tunnel (no signup needed)
cloudflared tunnel --url http://localhost:5000
```

---

## Common Issues & Fixes

### Port 5432 already in use
Postgres local install hai system pe. Ya toh Docker port change karo `docker-compose.yml` me, ya local Postgres stop karo:
```powershell
net stop postgresql-x64-16
```

### Port 6379 already in use
Redis local install hai. Same fix.

### `prisma db push` fail
- Verify Postgres healthy: `docker compose ps`
- Check `DATABASE_URL` in `server/.env` matches docker-compose credentials
- Default: `postgresql://postgres:postgres@localhost:5432/whatsapp_platform`

### `Cannot find module '@prisma/client'`
```powershell
cd server
npm run db:generate
```

### Frontend blank screen
- Console me errors check karo
- Backend running hai verify: http://localhost:5000/health
- `client/.env` me `VITE_SOCKET_URL=http://localhost:5000` hai?

### `EADDRINUSE :::5000`
Koi process port 5000 hold kar raha hai:
```powershell
netstat -ano | findstr :5000
# PID milne ke baad:
taskkill /PID <pid> /F
```

---

## Scripts Reference

| Command | Kya karta hai |
|---|---|
| `npm run dev` | Dono (server + client) concurrently start |
| `npm run dev:server` | Sirf backend |
| `npm run dev:client` | Sirf frontend |
| `npm run docker:up` | Docker services start |
| `npm run docker:down` | Docker services stop |
| `npm run db:migrate` | Prisma migrations run (production ke liye) |
| `npm run db:push` | Schema → DB push (dev ke liye) |
| `npm run db:studio` | Prisma Studio GUI (DB explore) |

Worker separately chalana ho (production):
```powershell
cd server
npm run dev:worker
```

---

## Project Structure
```
D:\whatsapp\
├── client/              # React + Vite + Tailwind
├── server/              # Express + TypeScript + Prisma
│   ├── prisma/          # Database schema
│   ├── src/             # Source code
│   │   ├── modules/     # auth, whatsapp, inbox, automations, campaigns
│   │   ├── workers/     # BullMQ queue processors
│   │   └── config/      # DB, Redis, queues
│   └── scripts/         # setup-webhook helper
├── scripts/             # dev-tunnel.sh (Linux/Mac only)
├── docker-compose.yml   # Postgres + Redis
└── package.json         # Root — orchestrates both apps
```

---

## Next Steps After First Run
1. UI pe register karo (first user = admin of new org)
2. `Settings → WhatsApp` me Meta connect karo
3. Test contact add karo, message bhejo
4. Automations aur campaigns explore karo
