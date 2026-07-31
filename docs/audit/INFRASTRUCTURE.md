# Infrastructure — Complete Inventory

---

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | 18.3 |
| Build tool | Vite | 6.0.7 |
| Styling | Tailwind CSS | 3.4.17 |
| Backend | Express.js + TypeScript | 4.21.2 |
| ORM | Prisma | 6.3.0 |
| Database | PostgreSQL | 16 |
| Cache/Queue | Redis | 7 |
| Queue lib | BullMQ | 5.34.8 |
| Real-time | Socket.IO | 4.8.1 |
| Auth | JWT (jsonwebtoken) | 9.0.2 |
| Validation | Zod | 3.24.1 |
| Logging | Winston | 3.19.0 |
| Error tracking | Sentry | 9.5.0 |
| Testing | Vitest | 4.1.8 |

---

## Project Structure

```
Samyoj/
├── package.json              Root (concurrently orchestration)
├── docker-compose.yml        PostgreSQL + Redis
├── .github/workflows/ci.yml  GitHub Actions CI
├── .gitignore
├── README.md
├── client/                   React frontend
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── pages/            20+ page components
│       ├── components/       150+ components
│       ├── contexts/         3 contexts
│       ├── hooks/            8 hooks
│       ├── services/         API layer (27 API objects)
│       └── utils/            14 utility files
├── server/                   Express backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                  Live credentials (71 lines)
│   ├── .env.example
│   ├── prisma/schema.prisma  48 models, 1310 lines
│   └── src/
│       ├── index.ts          Entry point
│       ├── config/           10 config files
│       ├── middleware/        4 middleware files
│       ├── modules/          30 modules
│       ├── workers/          4 worker files
│       ├── services/         2 global services
│       ├── errors/           2 error handlers
│       ├── types/            3 type files
│       ├── utils/            6 utility files
│       ├── realtime/         Socket.IO setup
│       └── scripts/          Setup scripts
├── config/                   Shared .env.sample
├── docs/                     7 documentation files
│   └── audit/                This audit (6 files)
└── scripts/                  3 shell scripts
```

---

## Docker

**`docker-compose.yml`** — Dev infrastructure only (no app containers)

| Service | Image | Port | Volume |
|---------|-------|------|--------|
| postgres | postgres:16-alpine | 5432 | postgres_data |
| redis | redis:7-alpine | 6379 | redis_data |

No Dockerfiles for server or client.

---

## CI/CD (GitHub Actions)

**File:** `.github/workflows/ci.yml`  
**Trigger:** Push/PR to main/master

### `server` job
- ubuntu-latest, Node 22
- Services: PostgreSQL 16 + Redis 7
- Steps: `npm ci` → `prisma generate` → `prisma migrate deploy` → `npm test` → `npm run build`

### `client` job
- ubuntu-latest, Node 22
- Steps: `npm ci` → `npm run build`

### Gaps
- No security scan (`npm audit`)
- No deploy job
- No migration drift check
- No Docker image build

---

## NPM Scripts

### Root
| Script | Command |
|--------|---------|
| `dev` | `concurrently "npm run dev:server" "npm run dev:client"` |
| `build` | Build client then server |
| `start` | `cd server && npm run start` |
| `docker:up` | `docker compose up -d` |
| `docker:down` | `docker compose down` |
| `db:migrate` | `cd server && npm run db:migrate` |

### Server
| Script | Command |
|--------|---------|
| `dev` | `tsx watch src/index.ts` |
| `dev:worker` | `tsx watch src/workers/index.ts` |
| `build` | `tsc` |
| `start` | `node dist/index.js` |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` |
| `db:push` | `prisma db push` |
| `db:studio` | `prisma studio` |
| `test` | `vitest run` |

### Client
| Script | Command |
|--------|---------|
| `dev` | `vite` (port 3000) |
| `build` | `tsc -b && vite build` |
| `preview` | `vite preview` |

---

## Environment Variables

### Server (165 lines in .env)

| Group | Variables | Purpose |
|-------|-----------|---------|
| Server | PORT, NODE_ENV, LOG_LEVEL, CLIENT_URL, BASE_URL | Config |
| Database | DATABASE_URL | PostgreSQL |
| Redis | REDIS_URL | BullMQ + cache |
| JWT | JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN | Auth |
| Meta WhatsApp | META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN, META_API_VERSION, META_REDIRECT_URI, META_WEBHOOK_URL | WA Cloud API |
| Encryption | ENCRYPTION_KEY (32 bytes hex) | AES for stored tokens |
| Azure OpenAI | AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT | AI chatbot |
| Voice | DEEPGRAM_API_KEY, GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_TTS_VOICE | STT + TTS |
| Email | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS | Nodemailer |
| Storage | STORAGE_DRIVER, S3_BUCKET, S3_REGION | Media (local/S3) |
| Razorpay | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET | Billing |
| OAuth | GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID | Social login |

### Client
| Variable | Purpose |
|----------|---------|
| VITE_API_ORIGIN | Optional cross-origin API |
| VITE_SOCKET_URL | Optional Socket.IO origin |
| VITE_APP_NAME | Display name |

---

## Testing

- **Framework:** Vitest 4.1.8
- **Config:** Default (no vitest.config file)
- **Server tests (8 files):**
  - `ai/ingest.test.ts`
  - `ai/guardrails.test.ts`
  - `campaigns/validation.test.ts`
  - `flows/link-nodes.test.ts`
  - `flows/analytics.test.ts`
  - `flows/language.test.ts`
  - `flows/validation.test.ts`
  - `flows/branch-resolve.test.ts`
- **Client tests:** None (0 files)
- **E2E tests:** None

---

## Scripts

| File | Purpose |
|------|---------|
| `scripts/dev-tunnel.sh` | Cloudflare tunnel for webhook exposure |
| `scripts/ngrok-tunnel.sh` | ngrok tunnel alternative |
| `scripts/test-webhook.sh` | 11-test webhook integration suite |
| `server/scripts/setup-webhook.ts` | Register webhook with Meta |

---

## Documentation

| File | Lines | Content |
|------|-------|---------|
| `AUDIT.md` | ~1192 | Platform audit, security gaps, cost analysis |
| `ENHANCEMENT_PLAN.md` | ~726 | 4-week sprint plan, 100+ tasks |
| `WHATSAPP_API_DOCUMENTATION.md` | ~2400 | Meta WA API reference |
| `WHATSAPP_CONNECT_DEVELOPER_GUIDE.md` | ~448 | OAuth flow guide |
| `IDEA_INTERACTIVE_MESSAGES.md` | ~1154 | Meta Flows research |
| `IDEA_AI_CONTENT_STUDIO.md` | ~1400 | AI content studio design |
| `API.md` | ~114 | Public API docs |

---

## Code Quality Gaps

| Tool | Status |
|------|--------|
| ESLint | NOT CONFIGURED |
| Prettier | NOT CONFIGURED |
| EditorConfig | NOT CONFIGURED |
| .nvmrc | NOT CONFIGURED |
| TypeScript strict | YES (both client & server) |

---

## Security Notes

- `.env` file contains live credentials in workspace (Azure OpenAI, Deepgram, Meta, JWT secrets, Razorpay)
- `.gitignore` correctly excludes `.env` files
- API key hashing (SHA-256) — never stores raw keys
- Webhook signature verification (HMAC-SHA256)
- AES-256-GCM for stored access tokens
- PII redaction in Sentry
- Helmet security headers
- Rate limiting (500 req/15min)
