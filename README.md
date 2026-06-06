# WhatsApp Automation Platform

Production-grade WhatsApp automation platform built with **PERN Stack** (PostgreSQL, Express, React, Node.js) using the official **Meta WhatsApp Business Cloud API**.

## Features (MVP Phase 1)

- **Authentication** — JWT with refresh tokens, organization-based accounts
- **WhatsApp Connection** — Meta Embedded Signup, webhook verification, multi-number support
- **Shared Team Inbox** — Realtime messaging via Socket.IO, conversation assignment, unread indicators
- **Automations** — Keyword replies, welcome messages, away/business hours automation
- **Broadcast Campaigns** — Template campaigns with queue-based batch sending
- **Contacts** — Import/export, tags, search
- **Analytics** — Messages sent, delivery rate, read rate, active conversations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Socket.IO Client |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Queue | Redis + BullMQ |
| Realtime | Socket.IO |
| WhatsApp | Meta Cloud API (official) |

## Quick Start

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Configure environment

```bash
cp server/.env.example server/.env
# Edit server/.env with your Meta App credentials
```

### 4. Run database migrations

```bash
cd server && npm run db:push && npm run db:generate
```

### 5. Start development

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:5000
- Health check: http://localhost:5000/health

## Meta WhatsApp Setup

1. Create app at [Meta Developers](https://developers.facebook.com/)
2. Add **WhatsApp** product
3. Configure webhook:
   - URL: `https://your-domain.com/api/whatsapp/webhook`
   - Verify token: same as `META_VERIFY_TOKEN` in `.env`
   - Subscribe to: `messages`
4. Set environment variables in `server/.env`:
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_VERIFY_TOKEN`

## Project Structure

```
whatsapp/
├── client/                 # React frontend
│   └── src/
│       ├── pages/          # Dashboard, Inbox, Automations, etc.
│       ├── components/     # Layout, ProtectedRoute
│       ├── services/       # API client
│       └── hooks/          # Socket.IO hook
├── server/                 # Express backend
│   └── src/
│       ├── modules/        # auth, whatsapp, inbox, automation, campaigns
│       ├── workers/        # BullMQ queue processors
│       └── config/         # DB, Redis, queues
└── docker-compose.yml      # PostgreSQL + Redis
```

## Architecture

```
Customer Message → Meta Webhook → Redis Queue → Worker → Database → WebSocket → Frontend
Agent Reply → API → Message Queue → Worker → Meta Send API → Delivery Status
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register + create organization |
| POST | `/api/auth/login` | Login |
| GET | `/api/inbox` | List conversations |
| POST | `/api/inbox/:id/messages` | Send message |
| GET/POST | `/api/automations` | Manage automations |
| GET/POST | `/api/campaigns` | Manage campaigns |
| GET/POST | `/api/contacts` | Manage contacts |
| GET | `/api/analytics/overview` | Dashboard stats |
| GET/POST | `/api/whatsapp/webhook` | Meta webhook |

## Production Deployment

Single VPS recommended (8GB RAM, 4 CPU):

- Nginx reverse proxy
- PM2 for API + workers
- PostgreSQL + Redis on same server or managed services

Run workers separately in production:

```bash
cd server && npm run dev:worker
```

## License

Private — All rights reserved.
