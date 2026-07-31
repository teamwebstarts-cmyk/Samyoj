# Samyoj — Complete Project Audit

> Generated: 2026-07-31

This folder contains a comprehensive inventory of the entire Samyoj platform — every feature, module, endpoint, component, database model, and infrastructure piece.

## Audit Files

| File | What it covers |
|------|----------------|
| [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) | **Start here** — feature-by-feature status (what's built, what's partial, what's missing) |
| [BACKEND.md](./BACKEND.md) | All 30 server modules, 150+ API endpoints, workers, middleware, services |
| [FRONTEND.md](./FRONTEND.md) | All 20+ pages, 150+ components, state management, real-time features |
| [DATABASE.md](./DATABASE.md) | All 48 Prisma models, 33 enums, relationships, multi-tenancy pattern |
| [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) | Stack, dependencies, Docker, CI/CD, env vars, scripts, testing |

## Quick Stats

| Metric | Count |
|--------|-------|
| Backend modules | 30 |
| API endpoints | 150+ |
| Frontend pages | 20+ |
| React components | 150+ |
| Database models | 48 |
| Database enums | 33 |
| BullMQ queues | 11 |
| External integrations | 12+ |
| Test files | 8 (server only) |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React + Vite)                 │
│  Tailwind CSS · React Router · Socket.IO · Axios        │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                  SERVER (Express + TS)                    │
│  30 modules · 150+ endpoints · 11 queues · Socket.IO     │
├──────────┬───────────┬────────────┬─────────────────────┤
│ Postgres │  Redis    │ Meta API   │ Azure OpenAI        │
│ (Prisma) │ (BullMQ)  │ (WhatsApp) │ (AI chatbot)        │
└──────────┴───────────┴────────────┴─────────────────────┘
```

## External Integrations

| Integration | Purpose |
|-------------|---------|
| Meta WhatsApp Cloud API | Messaging, templates, webhooks, calling |
| Azure OpenAI | AI chatbot, content generation, embeddings |
| Razorpay | Billing (INR payments) |
| Deepgram | Speech-to-text (voice calls) |
| Google Cloud TTS | Text-to-speech (voice calls) |
| Sentry | Error tracking |
| SMTP (nodemailer) | Email (invites, password reset) |
| AWS S3 | Media storage (optional) |
| Google OAuth | Social login |
| Microsoft OAuth | Social login |
| Zapier | Automation integration |
| Google Sheets | Data export |
