# Backend — Complete Inventory

> Server: Express.js + TypeScript  
> ORM: Prisma (PostgreSQL)  
> Queue: BullMQ (Redis)  
> Real-time: Socket.IO  

---

## Entry Point

**File:** `server/src/index.ts`

Boot sequence:
1. `validateConfig()` — validates env vars
2. `initTelemetry()` — OpenTelemetry (optional)
3. `initSentry()` — Sentry error tracking (optional)
4. `setupGlobalErrorHandlers()` — uncaughtException/unhandledRejection
5. `setRealtimeIO(io)` — Socket.IO instance
6. `httpServer.listen(config.port)`
7. Redis check → start workers if available

---

## All 30 Modules

### 1. Auth (`/api/auth`)
- Register, login, logout, refresh, password reset
- Google + Microsoft OAuth
- 2FA (TOTP)

### 2. WhatsApp (`/api/whatsapp`)
- Meta Embedded Signup OAuth flow
- Multi-number management
- Inbound webhook receiver (GET verify + POST messages)
- Webhook health monitoring

### 3. Inbox (`/api/inbox`)
- Conversation list/detail/messages
- Send messages (text, template, image, video, doc, audio, interactive)
- Assignment, snooze, status, notes, labels, bot toggle

### 4. Automations (`/api/automations`)
- Rule-based: keyword, welcome, away, business hours, lead capture, AI chatbot
- Analytics, conflict detection

### 5. Flows (`/api/flows`)
- Visual flow builder (26 node types, 10 triggers)
- Versioning, templates, simulation, validation, analytics
- Draft/publish workflow

### 6. Flow Assets (`/api/flows-assets`)
- WhatsApp Flows (NFM) management
- Encrypted data endpoint for Meta

### 7. Settings (`/api/settings`)
- Business hours, AI config, campaigns, feature flags, alerts

### 8. Campaigns (`/api/campaigns`)
- Bulk template messaging with scheduling
- Audience targeting (manual, tag, segment, all)
- Analytics, quota, export, retry, pause/resume/cancel

### 9. Contacts (`/api/contacts`)
- CRUD, import, bulk ops, tags, export, timeline

### 10. Analytics (`/api/analytics`)
- Overview, reports, leaderboard, templates

### 11. Templates (`/api/templates`)
- Meta template CRUD, library, usage analytics

### 12. Messages (`/api/messages`)
- Direct send API (JWT or API key auth)

### 13. Team (`/api/team`)
- Members, roles, departments, invites, 2FA, sessions, audit log
- Auto-assignment strategies

### 14. AI Bot (`/api/ai-bot`)
- Bot CRUD, FAQ, URL/PDF ingestion, test, analytics, versioning
- Azure OpenAI integration (chat + embeddings)

### 15. Calling (`/api/calling`)
- Voice calls: AI voice agent, agent routing, WebRTC
- Deepgram STT, Google TTS

### 16. Labels (`/api/labels`)
- Conversation label CRUD

### 17. Canned Replies (`/api/canned-replies`)
- Pre-defined reply templates

### 18. Billing (`/api/billing`)
- Razorpay integration, plans, usage, payment links

### 19. Compliance (`/api/compliance`)
- GDPR export/deletion, SLA stats

### 20. Integrations (`/api/integrations`)
- API keys, outbound webhooks, Zapier, Google Sheets

### 21. Onboarding (`/api/onboarding`)
- Setup wizard (connect WhatsApp, create template, send test, add contacts)

### 22. WA Forms (`/api/wa-forms`)
- WhatsApp Flows management

### 23. Media (`/api/media`)
- Upload (local or S3), public serving

### 24. Catalog (`/api/catalog`)
- Meta catalog sync, product listing

### 25. Commerce (`/api/commerce`)
- Order management from WhatsApp

### 26. Content Studio (`/api/content-studio`)
- Brand kit, AI composer, images, voices, videos, library, calendar, approvals

### 27. Public API (`/api/v1`)
- External API (API key auth): messages, contacts, conversations, usage

### 28. Leads (`/api/leads`)
- Lead pipeline (7 stages)

### 29. Tickets (`/api/tickets`)
- Support tickets with SLA

### 30. SLA (service only)
- SLA computation and breach detection

---

## All API Endpoints (150+)

### Auth
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | Register user + org |
| POST | `/api/auth/login` | Login (with optional 2FA) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Current user profile |
| POST | `/api/auth/logout` | Revoke refresh token |
| POST | `/api/auth/forgot-password` | Send reset email |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/oauth/google/url` | Google OAuth URL |
| GET | `/api/auth/oauth/google/callback` | Google OAuth callback |
| GET | `/api/auth/oauth/microsoft/url` | Microsoft OAuth URL |
| GET | `/api/auth/oauth/microsoft/callback` | Microsoft OAuth callback |

### WhatsApp
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/whatsapp/meta-config` | Get Meta app config |
| PATCH | `/api/whatsapp/meta-config` | Update Meta app config |
| GET | `/api/whatsapp/connect-url` | Meta OAuth URL |
| POST | `/api/whatsapp/connect/callback` | OAuth callback |
| POST | `/api/whatsapp/connect/select` | Select phone number |
| POST | `/api/whatsapp/connect` | Manual connect |
| DELETE | `/api/whatsapp/numbers/:id` | Disconnect number |
| GET | `/api/whatsapp/numbers` | List numbers |
| GET | `/api/whatsapp/webhook-status` | Webhook health |
| POST | `/api/whatsapp/setup-webhook` | Setup webhook |
| GET | `/api/whatsapp/webhook` | Meta verification (GET) |
| POST | `/api/whatsapp/webhook` | Inbound webhook (POST) |

### Inbox
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/inbox/` | List conversations |
| POST | `/api/inbox/start` | Start new conversation |
| GET | `/api/inbox/messages/:messageId/media` | Download media |
| GET | `/api/inbox/:id` | Conversation detail |
| GET | `/api/inbox/:id/messages` | Get messages |
| POST | `/api/inbox/:id/messages` | Send message |
| PATCH | `/api/inbox/:id/assign` | Assign agent |
| PATCH | `/api/inbox/:id/bot` | Toggle bot |
| PATCH | `/api/inbox/:id/snooze` | Snooze |
| DELETE | `/api/inbox/:id/snooze` | Unsnooze |
| PATCH | `/api/inbox/:id/status` | Change status |
| POST | `/api/inbox/:id/notes` | Add note |

### Automations
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/automations/analytics` | Automation analytics |
| GET | `/api/automations/conflicts` | Conflict detection |
| GET | `/api/automations/` | List automations |
| POST | `/api/automations/` | Create automation |
| PATCH | `/api/automations/:id` | Update automation |
| DELETE | `/api/automations/:id` | Delete automation |

### Flows
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/flows/templates` | List templates |
| GET | `/api/flows/` | List flows |
| POST | `/api/flows/validate` | Validate flow |
| POST | `/api/flows/simulate` | Simulate flow |
| GET | `/api/flows/:id` | Get flow |
| GET | `/api/flows/:id/analytics` | Flow analytics |
| GET | `/api/flows/:id/versions` | Version history |
| POST | `/api/flows/:id/duplicate` | Duplicate flow |
| POST | `/api/flows/:id/publish` | Publish draft |
| POST | `/api/flows/:id/restore/:version` | Restore version |
| POST | `/api/flows/` | Create flow |
| POST | `/api/flows/from-template/:templateId` | Create from template |
| PATCH | `/api/flows/:id` | Update flow |
| POST | `/api/flows/:id/schedule` | Schedule flow |
| DELETE | `/api/flows/:id` | Delete flow |

*(Remaining endpoints follow same pattern — see individual module route files)*

---

## Middleware Stack

| Middleware | Purpose |
|-----------|---------|
| `authenticate` | JWT Bearer verification |
| `requireOrg` | Ensures organizationId in JWT |
| `loadOrgRole` | Loads user's org role |
| `requireOrgRole(...)` | Role-based access |
| `authenticateApiKey` | API key auth (`x-api-key`) |
| `authenticateJwtOrApiKey` | Dual auth (API key → JWT fallback) |
| `loadPermissions` | Granular permissions |
| `requirePermission(...)` | Permission-based access |
| `rateLimit` | 500 req/15min per IP |
| `helmet` | Security headers |
| `cors` | CORS with origin delegate |

---

## Background Workers (11 BullMQ queues)

| Queue | Concurrency | Purpose |
|-------|-------------|---------|
| `webhook-queue` | 1 | Inbound Meta webhook processing |
| `message-queue` | 1 | Outbound message retries |
| `broadcast-queue` | 2 | Campaign bulk sending |
| `automation-queue` | 5 | AI chatbot replies |
| `flow-queue` | 10 | Flow delay/resume |
| `webhook-dispatch` | 5 | Outbound webhook delivery |
| `compliance-purge` | 1 | GDPR data deletion |
| `content-image` | 3 | AI image generation |
| `content` | 2 | AI voice generation |
| `content-video` | 2 | AI video generation |
| `retry-queue` | — | Generic retry |

### Interval Workers

| Worker | Interval | Purpose |
|--------|----------|---------|
| Alert Worker | 30s | SLA breach, billing expiry, template rejection |
| Media Retention | 24h | Purge old messages |
| Scheduled Campaigns | 60s | Process scheduled campaigns |
| Billing Analytics | 24h | Meta conversation analytics |

---

## Utilities

| File | Purpose |
|------|---------|
| `utils/logger.ts` | Winston logger with module factory |
| `utils/response.ts` | sendSuccess, sendError, asyncHandler |
| `utils/crypto.ts` | AES-256-GCM encryption |
| `utils/jwt.ts` | JWT signing/verification |
| `utils/phone.ts` | Phone normalization |
| `utils/pii-redaction.ts` | Sentry PII redaction |

---

## Error Handling

| File | Purpose |
|------|---------|
| `errors/index.ts` | AppError class, normalizeError, errorHandler |
| `errors/meta.ts` | Meta API error classification |
