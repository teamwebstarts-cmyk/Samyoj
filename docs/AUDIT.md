# Palerma — WhatsApp Business Platform Audit

| Field | Value |
| --- | --- |
| Product codename | Palerma (working name "WhatsApp Platform" in `package.json`) |
| Repo root | `D:\whatsapp` |
| Stack | PERN — PostgreSQL 16, Express (TypeScript), React 18 + Vite, Node.js 22, Redis 7 |
| Meta API | WhatsApp Cloud API (v21.0 by default), official Graph endpoints |
| Channels covered | Messaging, automations, visual flow builder, AI chatbot, voice calling, campaigns, integrations, billing, team |
| Repo version | `1.0.0` (server, client, root) — single monorepo, no git tag captured |
| Audit date | Monday, 15 June 2026 |
| Prepared by | Cursor Agent (audit sub-agent) |
| Status | **Pre-production** — large functional surface, several operational and billing gaps. Not ready for paying customers until Roadmap "Now" items are completed. |

---

## 1. Executive summary (60-second read)

- **Surface area is broad, depth is uneven.** 22 server modules and 19 client pages — every advertised feature has UI and a REST surface, but several are partially wired (AI voice sessions can be patched through WebRTC, calls rely on `@roamhq/wrtc`, outbound calling requires the same WABA you use for messaging).
- **Core journey works end-to-end**: WhatsApp Embedded Signup → webhook verification → inbox send/receive with Socket.IO realtime → automation engine (rule-based + LLM fallback) → flow builder with BullMQ delays → template-driven campaigns in batches. Confirmed by reading `server/src/index.ts`, `workers/index.ts`, `modules/whatsapp/routes.ts`, `modules/inbox/routes.ts`, `modules/campaigns/service.ts`, `modules/flows/engine.ts`.
- **Two big "free" assumptions will hurt the business**: (a) the WhatsApp conversation-based pricing model is not surfaced anywhere in the product — there's no per-org conversation counter, no chargeback view, no budget alerts; (b) the on-prem `STORAGE_DRIVER=local` is the default with no backup, no S3 migration path runbook, and no `uploads/media` retention policy.
- **Calling is functional but rough.** Deepgram STT + Google TTS + Azure OpenAI voice session exist, but the WebRTC bridge uses `@roamhq/wrtc` (an unofficial fork), and the call modal in the client only shows a setup progress component — there's no in-browser media test, no agent audio device picker, no fallback to "ring on phone". Calling is gated behind Meta's WABA eligibility (≥2k unique customers/day, payment method added, Cloud API not On-Premises API).
- **Auth and security foundations are solid.** JWT access + refresh with DB-tracked refresh tokens, optional TOTP 2FA, role/permission system (OWNER/ADMIN/SUPERVISOR/AGENT), webhook signature verification on Meta and Razorpay webhooks, access-token encryption (`utils/crypto.ts`), helmet, rate limiter, helmet, CORS allow-list, `trust proxy` set.
- **Operational posture is single-host dev-grade.** `docker-compose.yml` runs Postgres + Redis on a laptop. There is **no CI** in `.github/workflows/ci.yml` beyond a basic `npm test` + `npm run build` matrix (no security scan, no migration check, no deploy job). There is **no status page**, **no SLOs**, **no key rotation policy**, **no DR plan**, **no production observability** (only Winston console logs).
- **Billing is a stub.** Razorpay integration works for INR (`server/src/modules/billing/razorpay.service.ts` + webhook), but plans are hard-coded in `billing/plans.ts` (₹3,999/mo Growth, ₹11,999/mo Business, custom Enterprise). There is **no USD/EU pricing**, no metering against Meta conversation tiers, no per-seat overage, no Stripe, no tax handling, no invoice numbering beyond what Razorpay returns.
- **Multi-tenancy isolation is enforced at the query layer** (every module scopes by `organizationId`), but secrets are stored in plaintext in `OrgAiSettings.apiKeyEncrypted` (encrypted with `ENCRYPTION_KEY` from env) — fine for a single-tenant, but a leaked env var decrypts every org's Azure key.
- **Compliance posture is GDPR-shaped but shallow.** `/api/compliance/export` and `/delete-request` exist and work, but there is no retention job, no scheduled purge, no DPIA template, no DPA flow for EU customers, no record-of-processing-activity export, and `auditLog` table exists but is not actually written to by most modules (most modules use `TeamAuditLog` for team events and `AutomationLog` for automation runs).
- **Top recommendation before going live**: implement an org-level **cost & quota guardrail** (Meta conversation counter, daily send budget, template-rejection alerts, calling-enabled health check), ship a **production deployment runbook** (Postgres backup/restore, Redis persistence, secret rotation, DR), and replace the local-only media storage with **S3** (config exists, code path is in `media/storage-adapter.ts` but unverified) plus a CDN.

---

## 2. Scope of the audit

### What was reviewed
- All server code under `server/src/` — 22 modules, 5 services, 3 utility files, 2 workers, 1 realtime helper, Prisma schema (793 lines, 35+ models), `server/.env.example`, `server/package.json`.
- All client code under `client/src/` — 19 pages, 9 component folders (auth, ai-bot, automations, billing, calls, campaigns, contacts, dashboard, flows, inbox, layout, reports, settings, team, templates, ui), routing in `client/src/App.tsx`, API service in `client/src/services/api.ts`.
- Repo-level: `README.md`, `RUN-LOCALLY.md`, `docker-compose.yml`, root `package.json`, `start-all.ps1`, `.github/workflows/ci.yml`.
- 10 server tests: `flows/analytics.test.ts`, `flows/language.test.ts`, `flows/validation.test.ts`, `campaigns/validation.test.ts`, `ai/guardrails.test.ts`, `ai/ingest.test.ts` (Vitest framework; coverage scope limited).

### What was not reviewed (gaps that need verification)
- **Live Meta Cloud API pricing for the operator's region.** All numbers in §8 are 2025–2026 public estimates and must be re-confirmed against `developers.facebook.com/docs/whatsapp/pricing/` and the operator's billing dashboard.
- **Live Meta App approval status** for the WABA(s) this product is connecting to (e.g., has the app passed App Review for `whatsapp_business_management` and `whatsapp_business_messaging`?).
- **Live AI voice cost in production** — Deepgram per-minute and Google TTS per-character pricing change frequently and depend on the model chosen (e.g., `en-IN-Neural2-A` vs `en-IN-Wavenet-A` vs `en-IN-Standard-A`).
- **Actual webhook round-trip latency in production** — the webhook test is local; Meta's webhook delivery can be 1–5s with bursts.
- **Multi-tenant data isolation in production** — code looks correct, but no fuzz tests are present.
- **S3 storage driver** — config is wired but the S3 code path is not exercised by CI; needs verification.
- **Sentry / OpenTelemetry** — neither is wired; only Winston console logger is used.
- **GDPR/DPDP DPA workflows** — only an "export JSON" endpoint and a "log a delete request" stub exist; no automated purge job.

---

## 3. Glossary

| Term | Definition (in this product) |
| --- | --- |
| **WABA** | WhatsApp Business Account. The container that owns phone numbers, templates, billing. Stored as `whatsappNumber.wabaId`. |
| **BMID** | Business Manager ID. Optional reference for the Business that owns the WABA. Stored as `whatsappNumber.businessId`. |
| **Phone number ID** | Meta's internal numeric ID for a WABA's phone number. Distinct from the E.164 phone number string. Stored as `whatsappNumber.phoneNumberId`. |
| **PIN** | Two-factor PIN for Meta Embedded Signup. Not currently stored — this audit's product flow does not require a separate PIN. |
| **Quality rating** | Meta's GREEN / YELLOW / RED quality score for a WABA phone number, plus a "Messaging Limit Tier" (1k / 10k / 100k / UNLIMITED unique customers per 24h). Not currently polled. |
| **Conversation tier** | Marketing, Utility, Authentication, or Service. Meta charges per *opened* conversation in tier order. Service conversations are free inside the 24h customer service window. |
| **24-hour window** | Window opened by an inbound customer message. Free-form text/media replies are allowed only inside it. Outside it, only approved templates can be sent. Enforced in `inbox/routes.ts` via `isWithin24HourWindow()` and in `messages/send.service.ts`. |
| **Template** | Pre-approved message format (header / body / footer / buttons) created in Meta Business Manager, sent via `MetaWhatsAppService.sendMessage(..., type: 'template')`. Categories: MARKETING, UTILITY, AUTHENTICATION. |
| **Embedded Signup** | Meta's OAuth-style flow that links a customer's WABA to your app. Implemented in `whatsapp/routes.ts` (`/connect-url`, `/connect/callback`, `/connect/select`). |
| **Webhook verification** | Meta `GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=…` handshake. Implemented in `whatsapp/routes.ts`. |
| **HMAC SHA-256** | `X-Hub-Signature-256` header used by Meta to sign every webhook POST. Verified in `MetaWhatsAppService.verifyWebhookSignature()`. |
| **Org** / **Organization** | A tenant. All queries scope by `organizationId`. The root entity in the Prisma schema. |
| **Membership** | `OrganizationUser` row connecting a `User` to an `Organization` with a role (`OWNER/ADMIN/SUPERVISOR/AGENT`). |
| **Flow** | A multi-step WhatsApp automation built in the Flow Builder. Stored as `Flow` (with `nodes` JSON + `triggerType`). Executed by `flows/engine.ts`. |
| **Conversation** | A thread between a contact and a WhatsApp number belonging to an org. Has a status (`OPEN/PENDING/CLOSED`), an assigned agent, and an `activeBotId`. |
| **Active Bot / Handoff** | An org can have multiple `AiBot` records. A conversation has at most one `activeBotId`. When the bot cannot answer, `botHandoffAt` is set and a human agent is assigned. |
| **Service window** | Computed client-side from the last INBOUND message; UI shows a banner if the 24h window has expired. |
| **Conversation-based pricing** | Meta bills per *opened* conversation, with the category of the first template sent determining the tier. Marketing > Utility > Authentication > Service. See §8. |
| **Per-template fee** | Some templates in some regions incur an additional utility/authentication fee on top of the conversation fee. Verify on Meta's pricing page for your region. |
| **Quality-rating multiplier** | Meta has historically charged a "penalty" tier (e.g., 2× or more on utility/marketing conversations) for numbers with YELLOW/RED quality. Behavior varies by region and year — verify on Meta pricing page. |
| **BullMQ** | Redis-backed job queue used for webhooks, message send retries, campaign batches, automation/AI debouncing, flow delays. Defined in `config/queues.ts`. |
| **Socket.IO rooms** | `org:<orgId>`, `user:<userId>`, `conversation:<id>`. Defined in `realtime.ts`. |
| **SDP** | Session Description Protocol — used for WebRTC call signaling between agent browser, the @roamhq/wrtc bridge, and Meta. Defined in `calling/webrtc-bridge.ts`. |

---

## 4. Module-by-module inventory

The following is a server-module-by-module walk-through. Each section: purpose · key files · key routes · current state · citations.

### 4.1 `auth` — Authentication and sessions
- **Purpose**: register / login / refresh / forgot-password / reset / logout; tracks refresh tokens in DB; supports TOTP 2FA at login.
- **Key files**: `server/src/modules/auth/routes.ts`, `server/src/middleware/auth.ts`, `server/src/utils/jwt.ts`.
- **Key routes**:
  - `POST /api/auth/register` — creates user + org + OWNER membership atomically.
  - `POST /api/auth/login` — supports `totpCode` if `twoFactorEnabled`.
  - `POST /api/auth/refresh`, `POST /api/auth/logout`.
  - `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` — sends email via `services/email.service.ts` if SMTP configured.
  - `GET /api/auth/me` — current user.
- **State**: **smooth**. JWT signing/verifying, bcrypt (cost 12), `RefreshToken` table with revocation, IP/UA captured.
- **Notes**: Email flow requires `SMTP_*` env vars. The .env.example has empty SMTP host/port — defaults to no email (forgot-password returns success without sending). The forgot/reset response does **not** leak whether the email exists (good).

### 4.2 `whatsapp` — Meta Cloud API connection
- **Purpose**: Embedded Signup flow, webhook verification, send/receive plumbing, template CRUD, media metadata.
- **Key files**: `server/src/modules/whatsapp/routes.ts`, `meta.service.ts`, `context.ts`, `connect-pending.ts`, `src/workers/webhook.processor.ts`.
- **Key routes**:
  - `GET /api/whatsapp/connect-url` — build FB OAuth URL.
  - `POST /api/whatsapp/connect/callback` — exchange code for long-lived token, list WABA phone numbers, save `WhatsappNumber`.
  - `POST /api/whatsapp/connect/select` — finalize when org has multiple numbers.
  - `POST /api/whatsapp/connect` — manual connect (rarely used).
  - `DELETE /api/whatsapp/numbers/:id` — soft disconnect (clears related conversations' `whatsappNumberId`).
  - `GET /api/whatsapp/webhook` (verify), `POST /api/whatsapp/webhook` (queue).
  - `GET /api/whatsapp/webhook-status`, `POST /api/whatsapp/setup-webhook`.
- **State**: **smooth for connection; rough for multi-WABA orgs**. `getOrgWhatsappContext` returns the most-recently-updated number — fine for one-number orgs, but campaigns trying to send from a *specific* number need to pass `whatsappNumberId` explicitly (already supported in `campaigns/service.ts`).
- **Security notes**: Webhook signature verification uses `META_APP_SECRET` (HMAC SHA-256, constant-time compare). Token is stored AES-encrypted with `ENCRYPTION_KEY` from env (`utils/crypto.ts`).
- **Risk**: `META_VERIFY_TOKEN` defaults to `whatsapp_verify_token` in code. Must be overridden in production.

### 4.3 `inbox` — Shared team inbox
- **Purpose**: list conversations, get/create conversations, send messages, mark read, assign agents, internal notes, 24h window check.
- **Key files**: `server/src/modules/inbox/routes.ts`, `message-parser.ts`.
- **Key routes**:
  - `GET /api/inbox` — paginated list with `status/search/assignedTo` filters.
  - `POST /api/inbox/start` — open a chat with a phone number.
  - `GET /api/inbox/:id`, `GET /api/inbox/:id/messages`, `POST /api/inbox/:id/messages`.
  - `PATCH /api/inbox/:id/assign`, `PATCH /api/inbox/:id/bot`, `PATCH /api/inbox/:id/status`.
  - `POST /api/inbox/:id/notes`, `GET /api/inbox/messages/:messageId/media` (auth-gated).
- **State**: **smooth**. 24h window is enforced for TEXT/INTERACTIVE/media. Templates can be sent anytime. Service-window info is returned to the client to drive the UI banner.
- **Caveat**: `media` upload in the POST body is base64 — for files >5MB this is inefficient. Production should use presigned S3 URLs (storage abstraction exists in `media/storage-adapter.ts` but not yet a separate upload endpoint).

### 4.4 `messages` — Outbound send pipeline
- **Purpose**: cross-cutting send logic; called by inbox, automation engine, flow engine, AI bot, missed-call follow-up, missed-call flow.
- **Key files**: `server/src/modules/messages/routes.ts`, `service.ts`, `send.service.ts`, `interactive.ts`.
- **Key routes**:
  - `POST /api/messages/send` — direct send to a phone (utility for the in-conversation flow that needs to bypass the 24h window with a template).
- **State**: **smooth**. Sends go through `deliverOutboundMessage()` → `MetaWhatsAppService.sendMessage()` → on failure, retries via `messageQueue` (4 attempts with exponential backoff 10s/30s/2m/10m per `retryDelays`). Status updates flow back through the webhook.

### 4.5 `contacts` — Contact book
- **Purpose**: CRUD contacts, import/export, tags, bulk ops, contact detail with conversation history.
- **Key files**: `server/src/modules/contacts/routes.ts`, `service.ts`.
- **Key routes**: `GET/POST/PATCH/DELETE /api/contacts`, `POST /api/contacts/import`, `POST /api/contacts/bulk`, `GET /api/contacts/tags`, `POST /api/contacts/tags/rename`, `DELETE /api/contacts/tags/:tag`, `GET /api/contacts/export`, `GET /api/contacts/:id`, `GET /api/contacts/:id/detail`.
- **State**: **smooth**. Phone numbers are normalized via `utils/phone.ts`. Import is sequential (no batching) — for >1k contacts this is slow; needs background job.

### 4.6 `campaigns` — Template-driven broadcasts
- **Purpose**: DRAFT / SCHEDULED / RUNNING / PAUSED / COMPLETED / FAILED / CANCELLED broadcast campaigns with audience resolution, batching, retries.
- **Key files**: `server/src/modules/campaigns/routes.ts`, `service.ts`, `recipients.ts`, `template-params.ts`, `types.ts`, `quota.ts`, `audit.ts`, `validation.test.ts`.
- **Key routes**: `GET /api/campaigns`, `POST /api/campaigns`, `GET /api/campaigns/quota`, `POST /api/campaigns/preview-audience`, `GET /api/campaigns/:id`, `PATCH /api/campaigns/:id`, `DELETE /api/campaigns/:id`, `POST /api/campaigns/:id/send`, `POST /api/campaigns/:id/test`, `POST /api/campaigns/:id/pause`, `POST /api/campaigns/:id/resume`, `POST /api/campaigns/:id/cancel`, `POST /api/campaigns/:id/retry-failed`, `POST /api/campaigns/:id/duplicate`, `GET /api/campaigns/:id/stats`, `GET /api/campaigns/:id/analytics`, `GET /api/campaigns/:id/export`, `POST /api/campaigns/process-scheduled`.
- **State**: **smooth for the main loop; rough for edge cases**.
  - Audience types: `MANUAL`, `TAGS`, `CONTACTS`, `ALL_OPTED_IN`. `requireOptIn` defaults to true (good).
  - Daily quota enforced by `quota.ts` (`assertDailySendQuota`).
  - Batches of 50 by default (`getCampaignSettings` → `batchSize`); batches spaced 1s by default.
  - Webhook status callbacks update `CampaignRecipient` and aggregate counts.
  - "Stuck" recovery: `recoverStuckCampaign` flips PENDING → FAILED after 6h.
- **Caveat**: When the broadcaster uses a different WABA than the audience's `contact.optedIn` was collected under, you still send — opt-in is per-org, not per-WABA. This is acceptable for a single-brand per-org product, but multi-brand orgs will need a `wabaId` on `Contact`.

### 4.7 `automation` — Rule-based + AI fallback
- **Purpose**: keyword replies, welcome, away/business-hours, lead-capture, AI chatbot.
- **Key files**: `server/src/modules/automation/routes.ts`, `engine.ts`, `analytics.ts`, `conflicts.ts`.
- **Key routes**: `GET/POST/PATCH/DELETE /api/automations`, `GET /api/automations/analytics`, `GET /api/automations/conflicts`.
- **State**: **smooth** for static automations; AI bot is queue-debounced 1.5s and 1-message-per-conversation via `withAiBotConversationLock`.
- **Conflicts**: `detectAutomationConflicts` flags overlapping keyword triggers and provides a UI banner. Good.

### 4.8 `flows` — Visual flow builder
- **Purpose**: Node-based automations with 24+ node types (`message`, `buttons`, `list`, `question`, `tag`, `remove_tag`, `set_variable`, `condition`, `handoff`, `ai`, `template`, `delay`, `schedule`, `media`, `webhook`, `ab_split`, `language`, `assign`, `request_callback`, `location`, `contact_card`, `wa_flow`, `goto_flow`, `goto_step`, `end`).
- **Key files**: `server/src/modules/flows/routes.ts`, `engine.ts`, `flow-state.ts`, `lock.ts`, `validation.ts`, `versioning.ts`, `analytics.ts`, `language.ts`, `simulate.ts`, `types.ts`, plus tests.
- **Key routes**: `GET /api/flows/templates`, `GET /api/flows`, `POST /api/flows`, `POST /api/flows/validate`, `POST /api/flows/simulate`, `GET/POST/PATCH/DELETE /api/flows/:id`, `POST /api/flows/from-template/:templateId`, `GET /api/flows/:id/versions`, `POST /api/flows/:id/publish`, `POST /api/flows/:id/restore/:version`, `POST /api/flows/:id/duplicate`, `POST /api/flows/:id/schedule`, `GET /api/flows/:id/analytics`.
- **State**: **smooth**. Triggers: `WELCOME`, `KEYWORD`, `ANY_MESSAGE`, `BUSINESS_HOURS`, `OFF_HOURS`, `CONTACT_TAG`, `SEGMENT`, `MISSED_CALL`, `CAMPAIGN_REPLY`, `CALL_COMPLETED`. Iteration limit 50 (loop guard). Per-conversation lock to prevent concurrent execution.
- **Frontend** (`client/src/pages/FlowBuilderPage.tsx` + `client/src/components/flows/*`) uses `@xyflow/react` for the canvas.

### 4.9 `ai` and `ai-bot` — LLM chatbot
- **Purpose**: multi-bot configuration, knowledge base (FAQ / URL / PDF), per-org Azure OpenAI config, versioning, audit, usage logs, rate limit, guardrails.
- **Key files**: `server/src/modules/ai/{azure-openai.service,bot.service,chatbot.service,embeddings.service,guardrails,knowledge.service,knowledge-ingest.service,org-ai.service,rate-limit.service,versioning.service,handoff.service,ingest.service,types}.ts`, `server/src/modules/ai-bot/routes.ts`.
- **Key routes**: `GET /api/ai-bot/status`, `GET/POST/PATCH/DELETE /api/ai-bot`, `GET /api/ai-bot/:id`, `POST /api/ai-bot/:id/test`, `GET /api/ai-bot/:id/analytics`, `GET /api/ai-bot/:id/versions`, `GET /api/ai-bot/:id/audit`, `POST /api/ai-bot/:id/restore/:version`, `POST /api/ai-bot/:id/faq`, `PATCH /api/ai-bot/:id/faq/:faqId`, `DELETE /api/ai-bot/:id/faq/:faqId`, `POST /api/ai-bot/:id/ingest/url`, `POST /api/ai-bot/:id/ingest/pdf`.
- **State**: **smooth**, with caveats:
  - Guardrails include prompt-injection detection, content sanitization, low-confidence handoff, blocked-content handoff.
  - Monthly token quota per org (`monthlyTokenLimit`).
  - **No fallback provider** — if Azure OpenAI is down, the bot returns a fallback message and hands off. Acceptable.
  - Knowledge base is a single bot, with semantic search via Azure OpenAI embeddings. The embedding model is `text-embedding-ada-002` by default; verify this is still available in your Azure resource (newer deployments should use `text-embedding-3-small/large`).
  - Test mode: `POST /api/ai-bot/:id/test` lets you sample the bot without affecting a conversation.
  - Versioning + restore is a nice-to-have.

### 4.10 `calling` — WhatsApp voice calls
- **Purpose**: business-initiated and user-initiated voice calls via Meta Calling API, agent pickup via WebRTC, AI voice agent with Deepgram STT + Google TTS, missed-call auto-reply, recording consent, call analytics.
- **Key files**: `server/src/modules/calling/{routes,meta-calling.service,call.processor,call-session.manager,webrtc-bridge,ai-voice-agent,deepgram.stt,google-tts.service,settings.service,agent-call.service,missed-call.service,routing.service,session-store,analytics,types,calling-settings.types}.ts`.
- **Key routes**: `GET /api/calling/status`, `GET/PATCH /api/calling/settings`, `POST /api/calling/enable`, `POST /api/calling/disable`, `GET /api/calling`, `GET /api/calling/:id`, `PATCH /api/calling/:id` (notes), `POST /api/calling/:id/terminate`, `POST /api/calling/:id/accept`, `POST /api/calling/:id/decline`, `GET /api/calling/:id/signaling`, `POST /api/calling/callback` (outbound), `GET /api/calling/analytics`.
- **State**: **functional but rough**.
  - Three routing modes: `ai_only`, `agents_first`, `ai_then_agents`. Plus an `afterHoursMode: ai | message | missed`.
  - Agent ring timeout is configurable 10–120s; if no agent picks up, falls back to AI.
  - WebRTC bridge uses `@roamhq/wrtc` — verify the fork is still maintained.
  - Requires Meta Calling API eligibility: Cloud API (not On-Premises), payment method on the WABA, ≥2k unique customers per day, app webhook subscribed to `calls` field.
  - "Calling prerequisites" hints are surfaced in the UI when Meta rejects enablement.

### 4.11 `billing` — Subscription management
- **Purpose**: plans, current plan, Razorpay order + verify + webhook, manual plan switch.
- **Key files**: `server/src/modules/billing/{routes,plans,razorpay.service}.ts`.
- **Key routes**: `GET /api/billing`, `POST /api/billing/create-order`, `POST /api/billing/verify`, `POST /api/billing/webhook` (Razorpay), `PATCH /api/billing/plan`.
- **State**: **smooth for INR, shallow for global**.
  - Plans: Starter (free, 5 seats), Growth (₹3,999/mo, 15 seats), Business (₹11,999/mo, 50 seats), Enterprise (custom).
  - Razorpay flow tested with the example keys in `.env.example` (test mode).
  - **No Stripe, no PayPal, no multi-currency.**
  - **No automatic dunning for failed payments beyond the webhook updating `PaymentOrder.status` to `FAILED`.**
  - No invoice numbering beyond what Razorpay generates.
  - No tax handling.
- **Caveat**: The dev .env exposes Razorpay *test* credentials in plain text in the repo. This is acceptable for the example file but should be rotated before any production deployment.

### 4.12 `integrations` — Outbound webhooks and API keys
- **Purpose**: org-owned API keys (for sending messages programmatically) and outgoing webhooks (`message.received`, `message.sent`, `conversation.assigned`, `conversation.closed`, `sla.breached`).
- **Key files**: `server/src/modules/integrations/{routes,dispatch}.ts`.
- **Key routes**: `GET/POST/DELETE /api/integrations/api-keys`, `GET/POST/PATCH/DELETE /api/integrations/webhooks`.
- **State**: **smooth** for surface; **incomplete** for production.
  - API key auth middleware exists at `server/src/middleware/api-key.ts` but is **not actually mounted on any route** in `index.ts`. So API keys can be created and revoked, but they cannot be used. (This is a critical gap — see §10.)
  - Outgoing webhooks are fire-and-forget with HMAC SHA-256 signature in `X-Webhook-Signature`. No retry queue, no dead-letter, no delivery log. Failed deliveries only emit a warning log.
  - **No incoming webhook receiver** (e.g., to receive messages from a third-party service for ingestion).
  - Five event types are exposed; conversation.closed is referenced but **never emitted** in the codebase (search confirms — only `conversation:assigned`, `conversation:bot`, `conversation:handoff` are emitted).

### 4.13 `compliance` — GDPR/DPDP exports and deletion
- **Purpose**: org-level data export, deletion request, SLA stats (which logically belongs in `sla`).
- **Key files**: `server/src/modules/compliance/routes.ts`.
- **Key routes**: `GET /api/compliance/export` (downloads JSON), `POST /api/compliance/delete-request` (logs an intent), `GET /api/compliance/sla`.
- **State**: **rough**.
  - Export includes org metadata, contacts, conversations (top 500 with last 100 messages each), campaigns.
  - **No scheduled purge job** — the delete request only writes to `audit_logs`.
  - **No retention policy** — messages and contacts are kept forever.
  - **No DPIA / DPA flow**, **no opt-in/opt-out API for individual contacts** (the `Contact.optedIn` field exists but is only set in a few code paths; there's no UI/API to update it from a contact-initiated "STOP" message).

### 4.14 `canned-replies` — Canned response library
- **Purpose**: per-org shortcuts → canned responses, surfaced in the Inbox composer as a `/` slash-command menu.
- **Key routes**: `GET/POST/PATCH/DELETE /api/canned-replies`.
- **State**: **smooth**.

### 4.15 `templates` — Template management
- **Purpose**: list/get/create/delete/resubmit Meta message templates, upload header media, list Meta's template library, test-send a template to your own number, retrieve template usage analytics.
- **Key files**: `server/src/modules/templates/{routes,builder,analytics,types}.ts`.
- **Key routes**: `GET /api/templates`, `GET /api/templates/library`, `GET /api/templates/:name`, `GET /api/templates/:name/usage`, `POST /api/templates/upload-header`, `POST /api/templates`, `POST /api/templates/from-library`, `POST /api/templates/:name/test-send`, `POST /api/templates/:name/resubmit`, `DELETE /api/templates/:name`.
- **State**: **smooth**. Header media limit 16 MB. Resubmit deletes and re-creates the template (correct Meta behavior for editing).

### 4.16 `labels` — Conversation labels
- **Purpose**: color-coded labels attachable to conversations.
- **State**: **smooth**.

### 4.17 `sla` — First-response-time SLA
- **Purpose**: compute `slaDueAt` on inbound messages, mark `firstResponseAt` on outbound, alert on breach.
- **Key files**: `server/src/modules/sla/service.ts`, `server/src/workers/alert.worker.ts` (runs every 30s by default).
- **State**: **smooth** for tracking; **silent** for alerting — `sla:breach` event is emitted to the org's socket room but **no email notification is sent**. (See §10.)

### 4.18 `analytics` — Dashboard & reports
- **Purpose**: `/api/analytics/overview` for the dashboard hero metrics; `/api/analytics/reports` for the full Reports page (agent performance, AI token usage, call counts, campaign aggregates).
- **State**: **smooth**. Time window 7–90 days. Per-agent performance is N+1 (one query per member); for large teams, batch this.

### 4.19 `team` — Team management
- **Purpose**: org roles, departments, invites, audit log, sessions/revocation, 2FA, agent assignment, agent metrics, shift schedule, handoff picker (least-load / round-robin).
- **Key files**: `server/src/modules/team/{routes,types,assignment,audit,metrics,totp}.ts`.
- **State**: **smooth**. `assignment.ts` has both LEAST_LOAD and ROUND_ROBIN strategies. `pickAgentForHandoff` filters by `handoffOnlyOnline` and `respectShiftSchedule` org settings. `TeamAuditLog` captures 16+ actions.

### 4.20 `settings` — Workspace settings
- **Purpose**: business hours, AI settings (org-level Azure config, embedding deployment, monthly token limit), campaign settings (daily send limit, batch size, batch delay), calling settings (delegated to `calling/settings.service.ts`).
- **State**: **smooth**. Settings are stored in `Organization.settings` (JSON) and sanitized before client read.

### 4.21 `media` — File storage
- **Purpose**: local filesystem (`./uploads/media/<orgId>/<file>`) by default, S3 driver supported via `STORAGE_DRIVER=s3` + `S3_*` env. Auth-gated download at `/api/inbox/messages/:id/media`, **public** download at `/api/media/public/:orgId/:filename` (the latter is used for outbound media to send to Meta).
- **State**: **rough**.
  - `media/public.routes.ts` is intentionally unauthenticated for outbound media accessibility. Path-traversal protection is in place (`filename.includes('..')` check), but any URL like `/api/media/public/<anyOrgId>/<knownFile>` is publicly readable. Acceptable for *Meta* to call, risky if filenames leak.
  - S3 path is configured but **never tested in CI**. Verify the S3 code path before depending on it.
  - **No media lifecycle** — no TTL, no archival. Local disk will fill forever.

### 4.22 Client pages
- **`DashboardPage`** — hero stats, performance rings, quick actions. Calls `analyticsApi.overview()`.
- **`InboxPage`** — conversation list, search, status/agent filters, message thread, template composer, media viewer, context menu, AI bot on/off per conversation, calling handoff. The single most complex page.
- **`AutomationsPage`** — list + create + analytics + conflict banner.
- **`FlowBuilderPage`** — `@xyflow/react` canvas (route `:id`).
- **`AiBotPage`** — bot CRUD, FAQ, URL/PDF ingest, test playground, version history, audit log.
- **`CallsPage`** — calling setup wizard, call list, live transcript, terminate, notes. (Two routes: `/calls` and `/calls/:callId`.)
- **`CampaignsPage`** — list, create wizard (audience, template, schedule), send, pause/resume/cancel/duplicate/retry-failed, analytics panel.
- **`ContactsPage`** — list, import, export, bulk, tag management.
- **`TemplatesPage`** — template list, library browser, create form, header media upload, test-send.
- **`TeamPage`** — members, departments, invites, audit, settings, 2FA.
- **`SettingsPage`** — sidebar with panels: WhatsApp, business hours, AI, calling, integrations, GDPR, readiness banner.
- **`BillingPage`** — current plan hero, plan cards (Razorpay checkout).
- **`ReportsPage`** — full analytics with agent performance.
- **Auth pages** — Login, Register, ForgotPassword, ResetPassword, AcceptInvite, WhatsappCallback.

All client pages have skeleton/empty/loading states. Form validation is via zod schemas shared with the server (when applicable).

---

## 5. External integrations map

| Service | Used for | First called in | Cost (2025–2026) | Current state |
| --- | --- | --- | --- | --- |
| **Meta WhatsApp Cloud API (v21.0)** | Send/receive messages, templates, calls, webhooks | `modules/whatsapp/meta.service.ts` (and worker `webhook.processor.ts`) | Conversation-based pricing, see §8. Service conversations free inside 24h window. Marketing ~$0.025 IN / $0.050 EU / $0.099 BR. Utility ~$0.004 IN / $0.010 EU. **Verify on Meta pricing page for current region.** | Active. Token encrypted at rest. Webhook signed. |
| **Meta Embedded Signup (FB OAuth)** | Link a customer's WABA to the app | `whatsapp/routes.ts` (`/connect-url`, `/connect/callback`) | Free | Active. |
| **Azure OpenAI** | AI chatbot completions, embeddings | `modules/ai/azure-openai.service.ts`, `modules/ai/embeddings.service.ts` | Pay per token. `gpt-35-turbo` ~$0.0005/1K input, ~$0.0015/1K output (verify). `text-embedding-ada-002` ~$0.0001/1K tokens (verify). **Verify on Azure pricing page for the region/deployment.** | Optional, configurable per org. |
| **Deepgram** | Streaming STT for voice calls | `modules/calling/deepgram.stt.ts` | Per audio minute. Nova: ~$0.0043/min (verify on Deepgram pricing). | Optional. |
| **Google Cloud Text-to-Speech** | TTS for AI voice agent | `modules/calling/google-tts.service.ts` | Per character. Neural2 voices ~$16/1M chars (verify on GCP pricing). | Optional. |
| **Razorpay** | INR subscription payments, webhooks | `modules/billing/razorpay.service.ts` | Per-transaction fee, e.g., 2% for cards. Verify on Razorpay pricing page. | Active. Test keys in .env.example. **No Stripe / multi-currency.** |
| **SMTP (Nodemailer)** | Password reset, team invites | `services/email.service.ts` | Free if self-hosted; ~$0–$10/mo on managed (SendGrid, SES, Mailgun). | Optional. Env-empty in .env.example. |
| **S3 (optional media driver)** | Outbound media, KB PDF/URL fetch (in future) | `modules/media/storage-adapter.ts` (S3 branch) | ~$0.023/GB-mo + requests (verify on AWS S3 pricing). | Configured but unverified path. |
| **PostgreSQL 16** | Primary store | everywhere | Self-hosted (~$0), or managed RDS/Cloud SQL ~$15–$200+/mo. | Active via `docker-compose.yml`. |
| **Redis 7** | BullMQ queue backend, call session store | `config/queues.ts`, `calling/session-store.ts` | Self-hosted (free) or managed ~$5–$50+/mo. | Active. |
| **ngrok / Cloudflare quick tunnel** (dev only) | Expose webhook locally | `RUN-LOCALLY.md` | Free tier available. | Dev only. |
| **Socket.IO** | Realtime UI updates | `src/index.ts`, `realtime.ts` | Self-hosted (free). | Active. |
| **@roamhq/wrtc** (npm) | WebRTC stack for agent browser | `calling/webrtc-bridge.ts` | Free. Unofficial fork. **Verify licensing and maintenance status.** | Active. |
| **pdf-parse** | PDF text extraction for KB | `modules/ai/knowledge-ingest.service.ts` | Free (MIT). | Active. |
| **Vitest** | Tests | `server/src/modules/**/​*.test.ts` | Free. | 10 test files. |
| **Winston** | Logging | `utils/logger.ts` | Free. | Console only — no log shipping. |

**No direct Google/Outlook calendar integration, no Zapier/Make, no Twilio/Vonage, no Shopify/WooCommerce, no HubSpot/Salesforce, no CRM sync.** All of those are typical "next-layer" integrations for a platform of this kind; consider them in the roadmap.

---

## 6. Current architecture

### 6.1 System context (C4-ish)

```mermaid
flowchart LR
    customer[Customer on WhatsApp]
    meta[Meta WhatsApp Cloud API]
    waba[Customer's WABA]
    saas[Palerma]
    operator[Operator Dashboard]
    saasWorker[BullMQ Workers]
    redis[Redis]
    pg[PostgreSQL]
    azure[Azure OpenAI]
    deepgram[Deepgram]
    gtts[Google TTS]
    razorpay[Razorpay]
    smtp[SMTP]
    s3[(S3 optional)]
    local[(Local FS u2261 default)]

    customer -- messages --> meta
    meta -- webhooks --> saas
    meta -- calls SDP --> saas
    waba -- owned by --> meta
    saas --> waba
    operator -- browser --> saas
    saas --> saasWorker
    saasWorker --> redis
    saas --> pg
    saas --> azure
    saas --> deepgram
    saas --> gtts
    saas --> razorpay
    saas --> smtp
    saas -- media --> s3
    saas -- media --> local
```

### 6.2 Inbox send/receive

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Meta as Meta Cloud API
    participant Express as Express /api/whatsapp/webhook
    participant Queue as webhook-queue (BullMQ)
    participant Worker as webhook worker
    participant DB as PostgreSQL
    participant IO as Socket.IO
    participant Browser as Agent UI

    Customer->>Meta: Send message
    Meta->>Express: POST /api/whatsapp/webhook (HMAC signed)
    Express->>Express: Verify X-Hub-Signature-256
    Express-->>Meta: 200 EVENT_RECEIVED
    Express->>Queue: enqueue { payload }

    Queue->>Worker: processWebhookPayload
    Worker->>DB: upsert Contact
    Worker->>DB: create/upsert Conversation
    Worker->>DB: create Message
    Worker->>DB: dispatch automations / flow
    Worker->>IO: emit message:new, conversation events
    IO->>Browser: real-time update
```

### 6.3 Automation trigger (rule → AI fallback)

```mermaid
flowchart TD
    A[Inbound message] --> B{Static rule matches?}
    B -- yes --> C[Send canned reply]
    C --> D{Tag/handoff configured?}
    D -- tag --> E[Add tag to contact]
    D -- handoff --> F[assignAgentOnHandoff]
    B -- no --> G{Business-hours flow or keyword flow matches?}
    G -- yes --> H[Run flow engine]
    H --> I[Send flow message]
    G -- no --> J{AI bot enabled and not handed off?}
    J -- yes --> K[queueAiBotProcessing (debounced 1.5s)]
    K --> L[Azure OpenAI completion]
    L --> M[Guardrail checks]
    M -- ok --> N[Send reply]
    M -- blocked / low confidence --> O[performHandoff]
    J -- no --> P[No auto reply]
```

### 6.4 Campaign dispatch

```mermaid
flowchart TD
    UI[UI: POST /api/campaigns/:id/send] --> A[queueCampaignSend]
    A --> B[Validate template approved]
    B --> C[Ensure WABA subscribed]
    C --> D[Calculate batches size 50 default]
    D --> E1[broadcastQueue batch 1]
    D --> E2[broadcastQueue batch 2]
    D --> EN[broadcastQueue batch N]

    E1 --> W[broadcast-queue Worker]
    W --> W1[Re-validate campaign status RUNNING]
    W1 --> W2[Re-check opt-in per recipient]
    W2 --> W3[Build template components]
    W3 --> W4[MetaWhatsAppService.sendMessage]
    W4 -- success --> S1[update CampaignRecipient.status = SENT]
    W4 -- failure --> S2[update status = FAILED, increment failedCount]
    W --> W5[emitToOrg campaign:progress]
    W5 --> Client[Socket.IO: real-time progress]

    W -.-> final{finalizeCampaignIfDone?}
    final -- all SENT/DELIVERED/READ --> C1[Status = COMPLETED]
    final -- any PENDING left --> C2[Wait for next batch]
    final -- all FAILED --> C3[Status = FAILED]
```

### 6.5 Voice call (inbound → AI agent)

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Meta as Meta Calling API
    participant Express
    participant Worker as call.processor
    participant Routing as routing.service
    participant Redis as Redis session-store
    participant Agent as Agent browser
    participant Bridge as webrtc-bridge
    participant DG as Deepgram
    participant GTTS as Google TTS
    participant Azure as Azure OpenAI

    Customer->>Meta: Voice call
    Meta->>Express: webhook (event=connect, sdp)
    Express->>Worker: processCallWebhookPayload
    Worker->>Routing: decideCallRoute (ai_only / agents_first / ai_then_agents)
    alt ring agents first
        Worker->>Redis: storePendingCall
        Worker-->>Agent: call:ring (socket)
        Agent->>Bridge: SDP answer via /accept
        Worker->>Meta: call action: accept
    else AI first / ring timeout
        Worker->>Worker: startAiSession
        Worker->>Meta: pre_accept (sdp answer from webrtc-bridge)
        loop while call active
            Customer->>Meta: audio
            Meta->>Worker: media stream
            Worker->>DG: STT
            DG-->>Worker: transcript
            Worker->>Azure: chat completion
            Azure-->>Worker: reply text
            Worker->>GTTS: synthesize
            GTTS-->>Worker: audio
            Worker->>Meta: send audio frame
        end
        Customer->>Meta: hangup
        Meta->>Worker: webhook (event=terminate)
        Worker->>Worker: endCallSession, persist transcript, finalize
    end
```

### 6.6 AI bot processing

```mermaid
flowchart TD
    Inbound[Inbound message] --> Lock[withAiBotConversationLock]
    Lock --> Resolve[resolveBotForConversation]
    Resolve --> KB[searchKnowledgeBase semantic]
    KB --> HandoffKW{Handoff keyword?}
    HandoffKW -- yes --> H1[performHandoff USER_REQUEST]
    HandoffKW -- no --> Build[buildConversationMessages]
    Build --> Azure[Azure OpenAI chat completion]
    Azure --> Guard[validateOutboundReply + isLowConfidenceReply]
    Guard -- safe --> Send[deliverOutboundMessage]
    Guard -- blocked --> H2[performHandoff BLOCKED_CONTENT]
    Guard -- low conf --> H3[performHandoff LOW_CONFIDENCE]
    Azure -- error --> H4[performHandoff ERROR fallback message]
    Send --> Log[logAutomationRun]
    H1 --> Log
    H2 --> Log
    H3 --> Log
    H4 --> Log
```

### 6.7 Webhook processing (messages)

```mermaid
flowchart TD
    Meta[Meta POST /api/whatsapp/webhook] --> Sig[Verify HMAC SHA-256]
    Sig -- invalid --> R401[401]
    Sig -- valid --> Ack[200 EVENT_RECEIVED]
    Ack --> Q[webhookQueue.add]
    Q --> W[webhook worker processWebhookFields]
    W --> F1{field = messages?}
    W --> F2{field = calls?}
    F1 -- yes --> P[processWebhookPayload]
    F2 -- yes --> C[processCallWebhookPayload]
    P --> P1[Statuses update Message + CampaignRecipient]
    P --> P2[New messages create Contact + Conversation + Message]
    P2 --> P3[Download + persist media]
    P3 --> P4[Dispatch automations / flows]
    P4 --> P5[emit message:new to org room]
    P5 --> P6[dispatchOrgWebhook to configured URLs]
```

### 6.8 Billing checkout (Razorpay)

```mermaid
sequenceDiagram
    autonumber
    actor Operator
    participant UI as BillingPage
    participant API as /api/billing
    participant DB
    participant RP as Razorpay
    participant WH as Razorpay webhook
    Operator->>UI: Choose plan
    UI->>API: POST /create-order
    API->>RP: orders.create
    RP-->>API: order id, amount
    API->>DB: PaymentOrder status=CREATED
    API-->>UI: {orderId, keyId}
    UI->>RP: openCheckout
    Operator->>RP: pay
    RP-->>UI: success → POST /api/billing/verify
    UI->>API: verify (razorpay_order_id, payment_id, signature)
    API->>API: verifyPaymentSignature
    API->>DB: PaymentOrder status=CAPTURED
    API->>DB: Organization.plan = planId, planExpiresAt = +30d
    RP-->>WH: payment.captured event
    WH->>API: POST /api/billing/webhook
    API->>API: verifyWebhookSignature
    API->>DB: confirm CAPTURED + activatePlan
```

### 6.9 Integration dispatch (outbound webhooks)

```mermaid
flowchart TD
    Event[Server emits e.g. message.received] --> Lookup[webhookEndpoint.findMany enabled + event]
    Lookup -- empty --> End[No-op]
    Lookup -- endpoints --> Sign[HMAC SHA-256 sign body with endpoint.secret]
    Sign --> Send[Promise.allSettled fetch POST to each endpoint]
    Send -- ok --> Done[Log nothing]
    Send -- non-2xx or throw --> Warn[warn log only]
    Warn -.-> Future[Future: needs retry queue + delivery log]
```

---

## 7. Current flow and current cost (per journey)

All costs are **2025–2026 public estimates** for the **Meta WhatsApp Cloud API conversation-based pricing model**. They are **not** the operator's actual cost. **Verify on `developers.facebook.com/docs/whatsapp/pricing/` for the current region and rate card.** Free, marketing, utility, authentication, and service refer to Meta's conversation categories; the category of the first template sent in a conversation determines the tier.

| Conversation category | Approx. cost (IN) | Approx. cost (EU) | Approx. cost (BR) | Approx. cost (US) | Notes |
| --- | --- | --- | --- | --- | --- |
| **Service (free)** | $0 | $0 | $0 | $0 | Triggered when a customer messages you and the agent replies in any category inside the 24h window. No template sent. |
| **Marketing** | ~$0.025 | ~$0.050 | ~$0.099 | ~$0.025–$0.090 | Newsletters, promos, offers. |
| **Utility** | ~$0.004 | ~$0.010 | ~$0.030 | ~$0.004–$0.025 | Order updates, appointment reminders. |
| **Authentication** | ~$0.003 | ~$0.008 | ~$0.025 | ~$0.003–$0.015 | OTP, account verification. |
| **Per-template fee** | varies | varies | varies | varies | Some regions add a per-template utility/auth fee. Verify on Meta pricing page. |
| **Phone-number quality multiplier** | varies | varies | varies | varies | YELLOW/RED numbers historically pay 2× or more for utility/marketing. Verify on Meta pricing page. |

**Other costs (estimates, verify on vendor pricing pages):**

| Vendor | Item | Approx. cost | Notes |
| --- | --- | --- | --- |
| **Deepgram** | Streaming STT | ~$0.0043/min (Nova) | Per-second billing. |
| **Google Cloud TTS** | Neural2 voices | ~$16/1M characters | Per character. |
| **Azure OpenAI** | `gpt-35-turbo` | ~$0.0005/1K input, ~$0.0015/1K output | Region/deployment dependent. |
| **Azure OpenAI** | `text-embedding-ada-002` | ~$0.0001/1K tokens | Used for KB semantic search. |
| **Razorpay** | Card payment | ~2% per transaction | Plus GST. |
| **AWS S3** | Storage | ~$0.023/GB-mo | Plus egress. |
| **PostgreSQL (managed)** | db.t3.medium | ~$30–$50/mo | Or self-host on VPS. |
| **Redis (managed)** | small | ~$10–$30/mo | Or self-host. |

### 7.1 Cost attribution per user journey

| Journey | Meta cost | Palerma infra cost | What counts |
| --- | --- | --- | --- |
| **Inbound → agent reply (free text in 24h window)** | $0 (service conversation) | Standard server + DB | Customer-initiated. The 24h window is opened by the customer. |
| **Inbound → AI bot reply (free text in 24h window)** | $0 (service conversation) | + Azure OpenAI tokens | Service conversation but tokens are still billed. |
| **Outbound template (marketing)** | ~$0.025 IN per recipient | + standard | First template sent opens the conversation. Subsequent templates in the same 24h do not open a new conversation. |
| **Outbound template (utility)** | ~$0.004 IN per recipient | + standard | Cheaper; preferred for order updates, OTPs, etc. |
| **Outbound template (authentication)** | ~$0.003 IN per recipient | + standard | Reserved for OTP-style flows. |
| **Campaign send to 10,000 opted-in contacts (utility template)** | ~$40 IN | + batched BullMQ work + DB writes + (optional) S3 storage | Customers in the same conversation window reduce cost. |
| **AI voice call (5 min)** | Free (Meta Calling API does not charge per-minute; phone-number minutes may apply on the customer's carrier) | + Deepgram ~$0.02 + Google TTS ~$0.05–$0.10 + Azure OpenAI tokens | Voice is **not** a Meta-billed conversation. |
| **Missed call follow-up (auto-reply text)** | $0 (inside the 24h window) or template cost (outside) | + standard | Decide before sending. |
| **API call from org's own backend** | Same as UI | Standard | Webhook dispatch is free; outbound message cost depends on tier. |

**Cost surprises to flag with customers:**
1. A 10,000-contact marketing campaign at ~$0.025/conversation ≈ $250 in Meta fees alone. The product does **not** warn the operator about this.
2. Hitting a **YELLOW/RED quality rating** can double the per-conversation cost for utility/marketing. The product does **not** poll the quality rating.
3. AI voice cost is dominated by TTS if the bot speaks a lot. Default settings (`maxTokens: 500` for the chatbot) are reasonable.

---

## 8. What is missing or needs improvement

Each item: **Problem · Evidence · Impact · Effort · Suggested fix**.

### 8.1 Small (≤ 1 day)

| # | Problem | Evidence | Impact | Effort | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| S1 | **Forgot-password and team-invite emails silently no-op** when SMTP is unset | `services/email.service.ts` logs but `RUN-LOCALLY.md` does not warn | Users never get reset links or invites | 0.5 d | If `SMTP_HOST` is empty, surface a banner in the admin UI ("Email is not configured — invite links must be shared manually"). |
| S2 | **`getOrgWhatsappContext` returns the most-recently-updated number** for an org | `whatsapp/context.ts:9` (`orderBy: { updatedAt: 'desc' }`) | In a multi-WABA org, you may not know which number is "primary" | 0.25 d | Add a `isDefault` flag to `WhatsappNumber` and use it in `getOrgWhatsappContext`. |
| S3 | **API keys can be created but cannot be used** | `middleware/api-key.ts` exists; not mounted in `index.ts` | Customers pay for a feature that doesn't work | 0.5 d | Add `app.use('/api/messages/send', apiKeyOrJwt, ...)` and similar for `/api/contacts`, `/api/campaigns`. |
| S4 | **Outbound webhook deliveries are fire-and-forget** with no retry | `integrations/dispatch.ts:24` uses `Promise.allSettled`, logs only on failure | Customer integrations silently break | 0.5 d | Add a `WebhookDelivery` table and a BullMQ `webhook-dispatch` queue with 4 retries. |
| S5 | **`conversation.closed` event is referenced in `WEBHOOK_EVENTS` but never emitted** | grep in `server/src` shows only `conversation:assigned`, `conversation:bot`, `conversation:handoff` | Customer integrations receive no close events | 0.25 d | Emit `conversation:closed` on `PATCH /api/inbox/:id/status` when status → CLOSED. |
| S6 | **Encryption key defaults are weak** if env var is missing | `config/index.ts:26` (`encryptionKey: process.env.ENCRYPTION_KEY || ''`) | Every org's tokens become un-decryptable across restarts if env is not set | 0.25 d | Fail fast in production if `ENCRYPTION_KEY` is empty. |
| S7 | **`Razorpay` test keys are committed in `server/.env.example`** | `server/.env.example:85-87` | Documented dev keys, but they expire / leak | 0.25 d | Move real test keys to `server/.env.test` (gitignored) and document how to obtain them. |
| S8 | **`Sentry` / log shipping is absent** | `utils/logger.ts` writes to console only | Production debugging impossible | 0.5 d | Add Sentry SDK to the Express app + workers, with PII redaction. |
| S9 | **`META_VERIFY_TOKEN` defaults to a guessable value** | `config/index.ts:21` | Anyone can complete the webhook verification handshake | 0.25 d | Fail fast if `META_VERIFY_TOKEN` is the default in non-dev. |
| S10 | **`Conversation.lastMessageAt` is set on outbound messages but not on inbound at the message level** | `webhook.processor.ts:127` does set it | Inbox ordering should already be fine — verify | 0.25 d | Verify ordering under load. |

### 8.2 Medium (1–5 days)

| # | Problem | Evidence | Impact | Effort | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| M1 | **No conversation-cost or per-WABA usage telemetry** | No `prisma.conversationCharge` model; no `waba.usage` polling | Operators cannot forecast spend, cannot detect anomalies | 3 d | (a) Add a daily cron that pulls per-WABA conversation counts from Meta's `/{waba-id}/conversation_analytics` endpoint; (b) store in a new `ConversationCharge` table; (c) show in `/api/billing` and the Dashboard. |
| M2 | **No phone-number quality rating displayed** | Not in `meta.service.ts` | Quality drops go unnoticed → costs double or more | 1 d | Add `GET /phone_numbers/{id}/quality` polling, surface in Settings and Alerts. |
| M3 | **No template-rejection / paused alerts** | `templates/routes.ts` has no status-change subscriber | Operators only learn when they try to send | 1 d | Periodic poll of `message_templates` for `REJECTED/PAUSED` → email + dashboard banner. |
| M4 | **Stripe is missing** | `billing/routes.ts` only knows Razorpay | EU/US/UK customers cannot pay | 3 d | Add `billing/stripe.service.ts` mirroring `razorpay.service.ts`; switch by `BILLING_PROVIDER` env. |
| M5 | **Multi-currency and tax handling missing** | `plans.ts` hard-codes INR; `PaymentOrder.currency: 'INR'` | Global customers will balk at "₹3,999/mo" with no VAT | 3 d | Multi-currency plans; tax (GST/VAT) line items; localized plan display. |
| M6 | **Webhook signature optional** | `whatsapp/routes.ts:367` (`if (signature && config.meta.appSecret)`) | If the customer forgets to set `META_APP_SECRET`, signatures are skipped silently | 0.5 d | Fail fast if `config.meta.appSecret` is empty in production. |
| M7 | **No `DPDP` (India Digital Personal Data Protection) flow** | Compliance module only does GDPR-shaped export/delete | Indian customers (a major target) need explicit consent capture, retention disclosure, and grievance officer | 3 d | Add per-org consent banner config, contact opt-in/opt-out endpoints, retention setting. |
| M8 | **S3 media driver is unverified** | `media/storage-adapter.ts` is referenced but no test exercises it | Outbound media in production depends on filesystem availability | 2 d | Add integration test that writes to S3, generates presigned URLs. |
| M9 | **Outbound media in POST body is base64** | `inbox/routes.ts:413` and the client `fileToBase64` | Memory + payload bloat for images and videos | 2 d | Add `POST /api/media/upload-url` (presigned S3) and update client to upload directly. |
| M10 | **Calling eligibility check is incomplete** | `meta-calling.service.ts:170` parses only the high-level "pre-requisite" string | Operators see cryptic Meta errors | 1 d | Map `error.error_user_title` and `error.error_user_msg` to friendly onboarding hints. |
| M11 | **Calling requires a separate media transport** | `@roamhq/wrtc` and agent SDP exchange | A real product should probably use Daily/Twilio Voice or LiveKit for resilience | 5 d | Evaluate and migrate to a managed voice SDK; keep `webrtc-bridge.ts` as fallback. |
| M12 | **No dead-letter queue or job inspector UI** | `config/queues.ts` removes jobs after 100/500 | Operators cannot see why a campaign failed for a recipient | 2 d | Bull Board UI mounted at `/admin/queues` (gated to OWNER). |
| M13 | **`recoverStuckCampaign` is the only safety net** | `service.ts:80` flips PENDING to FAILED after 6h | Long campaigns can lose hours of work | 2 d | Add a heartbeat (`updatedAt` per recipient) and a "resume from last successful offset" feature. |
| M14 | **No rate limiting on outbound sends per phone number** | `send.service.ts` has no per-recipient throttle | High-volume recipients can trigger Meta's "spam" protection | 1 d | Add a per-`to` 1-message-per-second throttle inside `deliverOutboundMessage`. |
| M15 | **Compliance `/delete-request` does nothing** | `compliance/routes.ts:80` only writes to `audit_logs` | Operators must manually purge — error-prone | 2 d | Add a scheduled job (cron via `setInterval` similar to alerts) that processes pending delete requests. |
| M16 | **`@roamhq/wrtc` is a community fork** | `package.json:23` | Licensing and maintenance risk | 2 d | Pin a version; document fallback strategy. |
| M17 | **No status page** | Absent | Customer trust | 1 d | Spin up Statuspage / BetterUptime; subscribe to /health endpoint. |
| M18 | **Local media has no retention / archival** | `media/storage.ts` writes to `uploads/media` forever | Disk fills | 1 d | Scheduled job that purges media older than N days, unless referenced by an active conversation. |
| M19 | **`STORAGE_DRIVER=local` in .env.example is the default** | `server/.env.example:74` | S3 is never the default; local is the only CI-tested path | 1 d | Default to S3 in production; document migration. |
| M20 | **No automated database backup** | `docker-compose.yml` has a named volume but no backup | Data loss on disk failure | 2 d | Cron + `pg_dump` to S3 with 30-day retention. |

### 8.3 Large (> 5 days)

| # | Problem | Evidence | Impact | Effort | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| L1 | **No production observability stack** | Winston console only | Cannot diagnose latency, errors, SLO breaches | 7 d | OpenTelemetry traces; Prometheus metrics; Sentry; structured logs to Loki or CloudWatch. |
| L2 | **Single-region, single-host deployment** | `RUN-LOCALLY.md` describes a single VPS | Outage-prone; no failover; no read replicas | 14 d | Managed Postgres (RDS/Neon) + Redis (Upstash/ElastiCache); horizontal API + workers; CDN for media. |
| L3 | **No multi-region support for customer data** | Single Postgres | Latency and data-residency concerns (EU/IN data) | 21 d | Region-pinned tenants; replica reads; per-region Postgres. |
| L4 | **No disaster-recovery runbook** | Absent | Recovery time unknown | 5 d | Documented RTO/RPO; cross-region backups; tested restore. |
| L5 | **Secret rotation policy missing** | `ENCRYPTION_KEY`, `META_APP_SECRET`, `JWT_SECRET` have no rotation | Leaked secret = full compromise; no re-key path | 7 d | Key versioning; encrypt tokens with current key id; re-encrypt on rotation. |
| L6 | **No marketplace or app store for templates / bots** | Absent | Cannot scale user-generated content | 21 d | Out of scope for v1; design and prototype. |
| L7 | **No native mobile app** | Web only | Some workflows (calling, push) are awkward on mobile | 30 d | React Native shell or PWA. |
| L8 | **No AI evaluation / regression tests** | `ai/guardrails.test.ts` exists but is small | AI quality drifts unnoticed | 14 d | Golden set of conversations; offline + online evals; LLM-as-judge. |
| L9 | **No per-tenant feature flags** | Plan features are hard-coded | Hard to test / ramp | 7 d | Add `OrgFeatureFlag` model and middleware check. |
| L10 | **No localization** | Strings hard-coded in English in components | EU/IN/Brazil users | 14 d | i18n framework (i18next or react-intl) + RTL. |

---

## 9. User-facing problems users will face (and mitigations)

Each problem → user impact → concrete mitigation.

1. **Onboarding friction on Embedded Signup**
   - *User impact*: Customer signs up, sees "connect WhatsApp", gets bounced through 4–6 screens on Meta's side, returns confused about which number to select.
   - *Mitigation*: Replace `WhatsappCallbackPage` with a step-by-step wizard; capture the state param and resume on return; pre-check `meta.appId/secret/redirectUri` server-side and tell the operator *before* they click. Add a "Test connection" button.

2. **Webhook never reaches the server**
   - *User impact*: Messages stop arriving in the inbox. Operator blames the platform.
   - *Mitigation*: Add a "Webhook health" panel (already partly in `routes.ts` as `/webhook-status`); surface last delivery time, subscribed fields, and a "test webhook" button that posts a synthetic event.

3. **Quality rating drops silently**
   - *User impact*: A few weeks in, Meta flags the number YELLOW. Costs double for marketing templates. The user only notices when their bill is 3×.
   - *Mitigation*: Daily poll of Meta's quality endpoint; banner + email when rating changes; guidance on Meta's quality requirements (template quality, opt-in, frequency caps).

4. **Templates get rejected on first use**
   - *User impact*: Marketing campaign fails to send, the operator edits the template on Meta's UI, and the local copy is out of sync.
   - *Mitigation*: Show template status (APPROVED/REJECTED/PAUSED) in the Templates page with a "Sync from Meta" button and a "Why was it rejected?" hint based on `rejected_reason`.

5. **24h window expiration surprises agents**
   - *User impact*: Agent types a long reply, gets a 400 "24-hour window expired". Frustrating.
   - *Mitigation*: The UI already shows a `ServiceWindowBanner` — verify it appears at 23h. Add a "Use template" quick switch when the window is closed.

6. **Campaigns to opted-out contacts silently fail**
   - *User impact*: Operator imports 10k contacts, sends a campaign, 4k fail with "Contact has not opted in". Operator did not set `optedIn: true` during import.
   - *Mitigation*: On import, require explicit "I confirm these contacts opted in" checkbox; show a per-recipient preview of opt-in status before send.

7. **Calling prerequisites missing**
   - *User impact*: User enables calling, gets a cryptic 422 from Meta, gives up.
   - *Mitigation*: `CALLING_ENABLE_HINTS` already exist; surface them in a side panel with a "View Meta checklist" link.

8. **AI bot goes rogue on a weird input**
   - *User impact*: Bot replies with hallucinated pricing or PII from a competitor.
   - *Mitigation*: Guardrails (already implemented) are good. Add a "Stop bot and notify supervisor" rule when the bot's reply is blocked or low-confidence for N consecutive messages.

9. **Billing surprise in INR**
   - *User impact*: Customer on Growth plan, sees ₹3,999 charged, plus hundreds in failed payment retries.
   - *Mitigation*: Annual plan option, prorated upgrades, automatic downgrade on payment failure (with grace period and clear email).

10. **Multi-number confusion**
    - *User impact*: Two WABAs, conversations from both go to the same inbox, hard to tell which number replied.
    - *Mitigation*: Add a "WABA filter" in the inbox; tag conversations with the source number; show number badge on each conversation.

11. **GDPR / DPDP export is too large to download**
    - *User impact*: 1M contacts, 10M messages, the JSON export is gigabytes and times out.
    - *Mitigation*: Stream the export as a downloadable zip; async generation; email link when ready.

12. **Webhooks to customer's server break silently**
    - *User impact*: Customer's CRM stops receiving events. They don't notice for weeks.
    - *Mitigation*: Add a "delivery log" in Settings → Integrations; failed deliveries highlighted; auto-disable endpoint after N consecutive failures.

13. **Calling audio echoes / dropouts**
    - *User impact*: Agent and customer hear each other twice or the call drops mid-sentence.
    - *Mitigation*: Document supported browsers; add a "Test mic" button; surface audio device picker.

14. **Slow campaign resume after pause**
    - *User impact*: Operator pauses a 50k-recipient campaign, fixes the template, hits resume — nothing happens for 30 seconds.
    - *Mitigation*: Pre-compute the resume batches; show "Queued" feedback immediately; add a "Resume now" hotkey.

15. **The org has multiple admins but only one owner**
    - *User impact*: Owner leaves the company → org is locked; no escalation path.
    - *Mitigation*: Allow transfer-ownership flow (UI + audit log entry); allow 2+ OWNERs.

16. **Excess templates cost**
    - *User impact*: User creates 200 templates (free), then realizes their use case could be 20. Templates can be deleted but UI is sparse.
    - *Mitigation*: Group templates by category; show "unused for 60 days" badge; bulk delete.

17. **Calling minutes in an after-hours region**
    - *User impact*: US number, IN customers, AI bot answers 3am their time. Customer annoyed.
    - *Mitigation*: Per-WABA timezone; `afterHoursMode: ai|message|missed` already exists; surface clearly in `CallsPage`.

18. **The team page is overwhelming**
    - *User impact*: 5-seat org gets the same team UI as a 50-seat org. Tabs (Members, Departments, Invites, Audit, Settings, Security) crowd the page.
    - *Mitigation*: Progressive disclosure: collapse Security and Audit behind a "Advanced" toggle.

19. **The 24h window indicator is per-conversation but not per-message**
    - *User impact*: Agent is mid-typing when the window closes. The send fails after they hit "Send".
    - *Mitigation*: Track `lastInboundAt` in the composer; show a countdown badge near the send button.

20. **AI bot's "knowledge" goes stale**
    - *User impact*: Bot answers with last quarter's pricing because the FAQ was last edited 6 months ago.
    - *Mitigation*: Surface "knowledge base last updated X days ago" in the bot settings; bulk re-ingest on URL/PDF refresh.

---

## 10. What we need to ship and operate professionally

A prioritized operational checklist. Items in **bold** are blockers for paid pilots.

### 10.1 CI / CD
- **CI must run real migrations, not just `db push`.** Replace `npx prisma db push` in `ci.yml` with a real `prisma migrate deploy` against an ephemeral database.
- **Add a security scan step** (`npm audit --production` or Snyk) to `ci.yml`.
- **Add a deploy job** to `ci.yml` (build a Docker image, push to GHCR, trigger a rolling deploy).
- **Add a migration-check job** that fails CI if `prisma migrate diff` detects schema drift.

### 10.2 Backups & DR
- **PostgreSQL**: nightly `pg_dump` to S3 with 30-day retention. Verify with a monthly restore drill.
- **Redis**: enable AOF persistence; daily RDB snapshot.
- **Media**: enable S3 versioning + cross-region replication. Local-only deployments need an off-host backup of `uploads/media`.
- **Document an RTO of 4 hours and RPO of 1 hour** in a `RUNBOOK.md`.

### 10.3 Monitoring, logging, SLOs
- **Latency SLOs**:
  - `POST /api/inbox/:id/messages` < 500 ms p95.
  - `GET /api/inbox/:id/messages` < 200 ms p95.
  - Webhook → first message in DB < 2 s p95.
  - Outbound `MetaWhatsAppService.sendMessage` < 1.5 s p95.
- **Error SLOs**: < 0.5% webhook processing failures per hour.
- **Alerts**:
  - Webhook 5xx rate > 1% for 5 min.
  - SLA breach rate > 5% in 15 min.
  - Queue depth > 1000 for 5 min.
  - Calling STT error rate > 10% for 15 min.
  - AI token usage > 80% of monthly limit.
- **Structured logs** (JSON) shipped to a centralized store (Loki, CloudWatch, Datadog).
- **Distributed tracing** (OpenTelemetry) for the request path: HTTP → worker → Meta API → webhook.

### 10.4 Secret management
- Use a secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) for: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `ENCRYPTION_KEY`, `AZURE_OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS` (the JSON), `RAZORPAY_*`, `SMTP_PASS`.
- **Rotate `ENCRYPTION_KEY`** at least every 12 months; re-encrypt all stored `accessToken`s and `OrgAiSettings.apiKeyEncrypted` after rotation. Implement `keyVersion` on `WhatsappNumber.accessToken`.
- **Rotate `JWT_SECRET`** with overlap window (old key valid for 1h after rotation) and force a refresh-token rotation.

### 10.5 Multi-tenant isolation
- All queries already filter by `organizationId`. **Add a regression test** that asserts no cross-tenant leaks.
- **Add a pre-commit hook** that flags any new Prisma query without an `organizationId` filter.
- **Add a per-tenant rate limit** (default 100 req/s; configurable per plan).

### 10.6 Data retention
- **Default retention**: messages 365 days, contacts 365 days after `optedIn=false`, media 180 days, audit logs 730 days.
- **Configurable per org** in Settings.
- **Background purge job** that runs daily.
- **Export on purge** for compliance evidence (write to `audit_logs` before deleting).

### 10.7 Compliance
- **GDPR**: export, delete, retention, DPA template, sub-processor list.
- **DPDP (India)**: explicit consent capture, grievance officer contact, data principal rights.
- **CCPA (California)**: "Do Not Sell" link (currently the entire premise is B2B — not always required — but verify).
- **SOC 2**: if selling to enterprises, plan for Type II within 12 months. Start with: access logs, change management, incident response policy, vendor risk reviews.
- **WhatsApp Commerce Policy + Business Policy**: review for any feature (e.g., the bot's prompts) that could be construed as deceptive.

### 10.8 Status page & support
- **Public status page** (e.g., statuspage.io or BetterUptime) linked from the footer.
- **Support email + form**, SLA per plan (Starter: 48h, Growth: 24h, Business: 8h, Enterprise: 1h).
- **In-app feedback widget** (e.g., Canny, Featurebase) so operators can request features.

### 10.9 Key rotation playbook
- Document how to rotate:
  - **JWT secrets** (overlap 1h).
  - **Encryption key** (re-encrypt all tokens; can take hours for large tenants).
  - **Meta app secret** (also requires updating the Meta console; will re-trigger webhook verification).
  - **Razorpay webhook secret** (re-issue and re-deploy webhook URL).
  - **Azure OpenAI key** (re-roll in Azure portal; re-deploy env).
  - **Deepgram / Google credentials** (re-issue; re-deploy env).

### 10.10 Observability of the AI
- **Track every LLM call's** prompt tokens, completion tokens, latency, and bot id.
- **Track KB retrieval quality** (was the retrieved chunk actually used in the final answer? — needs an LLM-as-judge on a sample).
- **Weekly human review** of 10 random bot conversations per org.

---

## 11. Recommended roadmap (Now / Next / Later)

Acceptance criteria are testable. Effort is rough (1 d ≈ 1 person-day).

### 11.1 Now (next 2 sprints, ~4 weeks) — ship-blockers

| # | Task | Acceptance criteria | Effort |
| --- | --- | --- | --- |
| 1 | **Conversation-cost telemetry** | New `ConversationCharge` table populated daily from Meta; `/api/billing/usage` returns per-org total + per-category breakdown for the last 30/60/90 days. | 3 d |
| 2 | **Quality-rating polling** | `GET /phone_numbers/{id}/quality` polled nightly; UI banner when GREEN→YELLOW or YELLOW→RED. | 1 d |
| 3 | **Webhook delivery log + retry** | New `WebhookDelivery` table; failed deliveries retried 4× with exponential backoff; visible in Settings → Integrations. | 3 d |
| 4 | **API key auth mounted on `/api/messages/send`, `/api/contacts`, `/api/campaigns`** | `X-Api-Key` header works; documented in `docs/API.md`; rate limit per key. | 1 d |
| 5 | **Sentry + structured logs** | Sentry receives unhandled errors; logs are JSON; `/health` returns DB + Redis + queue health. | 2 d |
| 6 | **Production deployment runbook** | `RUNBOOK.md` with `docker compose` prod profile, Nginx, Let's Encrypt, PM2, backups, restore drill. | 3 d |
| 7 | **Postgres backup + restore drill** | Nightly `pg_dump` to S3; monthly restore to a scratch instance; document the RTO/RPO. | 2 d |
| 8 | **Pre-commit hook to flag Prisma queries without `organizationId`** | Lint rule + tests that fail if a new query leaks. | 1 d |
| 9 | **S3 media driver integration test** | Test that writes and reads a file via S3 in CI (using a test bucket or LocalStack). | 2 d |
| 10 | **Stripe + multi-currency** | `/api/billing` accepts USD/EU/UK; `PaymentOrder.currency` reflects the plan; webhook switches on `BILLING_PROVIDER`. | 5 d |

### 11.2 Next (sprints 3–6, ~12 weeks) — hardening

| # | Task | Acceptance criteria | Effort |
| --- | --- | --- | --- |
| 11 | **Status page** | statuspage.io (or equivalent) subscribed to `/health`; public URL. | 1 d |
| 12 | **Per-tenant feature flags** | New `OrgFeatureFlag` model; default values seeded from plan. | 3 d |
| 13 | **DPDP consent flow** | `Contact.consentSource`, `ConsentLog` table; opt-in/opt-out endpoints; UI banner. | 5 d |
| 14 | **GDPR/DPDP scheduled purge** | Cron that honors `Organization.retentionDays`; audit entry on each delete. | 2 d |
| 15 | **Calling: live-call debug view** | Show packet loss, jitter, current SDP; surface Meta's call events. | 3 d |
| 16 | **AI evaluation harness** | Golden set of 100 conversations; offline eval; weekly regression report. | 7 d |
| 17 | **Webhook receiver endpoint** | `POST /api/integrations/inbound` (per-org HMAC-verified) for ingestion of third-party messages (e.g., email-to-chat). | 5 d |
| 18 | **i18n** | i18next + `en`, `es`, `pt-BR`, `hi`. RTL safe. | 7 d |
| 19 | **Multi-region (EU) tenant pin** | `Organization.dataRegion`; per-region Postgres + Redis. | 14 d |
| 20 | **Migration from `db push` to `prisma migrate`** | First production migration applied; CI uses `migrate deploy`. | 2 d |

### 11.3 Later (sprints 7+, ~6 months) — growth

| # | Task | Acceptance criteria | Effort |
| --- | --- | --- | --- |
| 21 | **App marketplace** | Third-party templates, bots, integrations. | 21 d |
| 22 | **Native mobile app** | React Native shell; push notifications; biometric 2FA. | 30 d |
| 23 | **CRM integrations** | HubSpot, Salesforce, Zoho bi-directional contact sync. | 21 d |
| 24 | **Calendar integration** | Google Calendar, Outlook for booking flows. | 14 d |
| 25 | **Voice: PSTN fallback** | Twilio Voice fallback when WebRTC is unsupported (Safari iOS). | 14 d |
| 26 | **SOC 2 Type II** | Audit-ready controls + evidence collection. | 60 d |
| 27 | **Multi-product tenant** | Same org can run two distinct workspaces (e.g., "Sales" vs "Support"). | 30 d |
| 28 | **Public API for developers** | OAuth2 + OpenAPI spec + rate limits + sandbox. | 21 d |

---

## 12. Risks and open questions

### 12.1 Risks (top 5)

1. **Cost blindness** — the product has no Meta conversation counter, no daily send budget, no template-cost estimator. A user could trigger a ₹100,000 INR marketing campaign without warning.
2. **Quality rating is invisible** — Meta can double the per-conversation cost with a YELLOW rating, and the user has no way to know until the bill arrives.
3. **Calling prerequisites are not communicated** — Voice is gated by Meta eligibility (≥2k unique customers/day, payment method, Cloud API not On-Premises). The UI surfaces hints but not a "you'll qualify in N days" projection.
4. **Single-host deployment assumption** — `docker-compose.yml` is laptop-grade; no production deployment artifact (Dockerfile for the server, Dockerfile for the worker, nginx config, systemd units) is committed.
5. **S3 media driver is unverified** — outbound media in production depends on a code path that is never exercised by CI. Likely fine; but the failure mode would be silent (media URLs 404).

### 12.2 Open questions (for the team)

1. **Is the Meta App approved for `whatsapp_business_management` and `whatsapp_business_messaging`?** If not, Embedded Signup will fail for production WABAs.
2. **Is the operator's region IN, EU, BR, or another Meta rate card?** All §7/§8 numbers are estimates; the actual rate card must be plugged into the new `ConversationCharge` model.
3. **Is the `ENCRYPTION_KEY` value committed to the repo** (e.g., in a `.env` file accidentally committed) or a real 32-byte secret? Confirm.
4. **Which Azure OpenAI deployment is the default in production** — `gpt-35-turbo` is in the .env.example; newer deployments may want `gpt-4o-mini` for cost/quality.
5. **Is the AI voice calling eligible on the operator's WABA today?** If not, this whole subsystem is dormant.
6. **Are you intending to sell outside INR markets** in the next 6 months? This determines Stripe priority.
7. **Will operators ever have multiple WABAs per org** (e.g., one for marketing, one for support)? This affects the `isDefault` change in `WhatsappNumber` and contact scoping.
8. **Are you storing PII in `InternalNote`?** If yes, that field needs redaction in the GDPR export and the AI log.
9. **Is the `pdf-parse` dependency actively maintained** — recent versions moved to a class-based API; verify.
10. **Are you on the new Meta rate card (per-conversation) or the legacy per-template-notification model** — the user UI assumes the new model.

### 12.3 Items marked "needs verification" in this audit

- S3 storage driver behavior under load.
- `@roamhq/wrtc` maintenance status and licensing.
- The `META_API_VERSION` constant in `.env.example` is `v21.0`; verify Meta's current Graph version for new apps.
- `pdf-parse` (now `pdf-parse` v2) — confirm the import path works on the deployed Node version.
- The exact Webhook round-trip latency in production (likely 1–5s; verify with real traffic).
- The Meta Calling API's eligibility check thresholds (verify against your WABA's actual usage tier).

---

## 13. Appendix

### 13.1 File index (every file cited)

**Server entry & shared**
- `server/src/index.ts`
- `server/src/realtime.ts`
- `server/src/config/index.ts`
- `server/src/config/queues.ts`
- `server/src/config/database.ts`
- `server/src/errors/index.ts`
- `server/src/middleware/auth.ts`
- `server/src/middleware/permissions.ts`
- `server/src/middleware/api-key.ts`
- `server/src/utils/jwt.ts`
- `server/src/utils/crypto.ts`
- `server/src/utils/logger.ts`
- `server/src/utils/phone.ts`
- `server/src/utils/response.ts`
- `server/src/services/email.service.ts`
- `server/src/workers/index.ts`
- `server/src/workers/webhook.processor.ts`
- `server/src/workers/alert.worker.ts`
- `server/prisma/schema.prisma`
- `server/.env.example`
- `server/package.json`

**Server modules**
- `server/src/modules/auth/routes.ts`
- `server/src/modules/whatsapp/routes.ts`
- `server/src/modules/whatsapp/meta.service.ts`
- `server/src/modules/whatsapp/context.ts`
- `server/src/modules/whatsapp/connect-pending.ts`
- `server/src/modules/inbox/routes.ts`
- `server/src/modules/inbox/message-parser.ts`
- `server/src/modules/messages/routes.ts`
- `server/src/modules/messages/service.ts`
- `server/src/modules/messages/send.service.ts`
- `server/src/modules/messages/interactive.ts`
- `server/src/modules/contacts/routes.ts`
- `server/src/modules/contacts/service.ts`
- `server/src/modules/campaigns/routes.ts`
- `server/src/modules/campaigns/service.ts`
- `server/src/modules/campaigns/recipients.ts`
- `server/src/modules/campaigns/template-params.ts`
- `server/src/modules/campaigns/types.ts`
- `server/src/modules/campaigns/quota.ts`
- `server/src/modules/campaigns/audit.ts`
- `server/src/modules/campaigns/validation.test.ts`
- `server/src/modules/automation/routes.ts`
- `server/src/modules/automation/engine.ts`
- `server/src/modules/automation/analytics.ts`
- `server/src/modules/automation/conflicts.ts`
- `server/src/modules/flows/routes.ts`
- `server/src/modules/flows/engine.ts`
- `server/src/modules/flows/flow-state.ts`
- `server/src/modules/flows/lock.ts`
- `server/src/modules/flows/validation.ts`
- `server/src/modules/flows/validation.test.ts`
- `server/src/modules/flows/versioning.ts`
- `server/src/modules/flows/analytics.ts`
- `server/src/modules/flows/analytics.test.ts`
- `server/src/modules/flows/simulate.ts`
- `server/src/modules/flows/types.ts`
- `server/src/modules/flows/language.ts`
- `server/src/modules/flows/language.test.ts`
- `server/src/modules/ai/azure-openai.service.ts`
- `server/src/modules/ai/chatbot.service.ts`
- `server/src/modules/ai/bot.service.ts`
- `server/src/modules/ai/embeddings.service.ts`
- `server/src/modules/ai/guardrails.ts`
- `server/src/modules/ai/guardrails.test.ts`
- `server/src/modules/ai/knowledge.service.ts`
- `server/src/modules/ai/knowledge-ingest.service.ts`
- `server/src/modules/ai/ingest.service.ts`
- `server/src/modules/ai/ingest.test.ts`
- `server/src/modules/ai/org-ai.service.ts`
- `server/src/modules/ai/handoff.service.ts`
- `server/src/modules/ai/rate-limit.service.ts`
- `server/src/modules/ai/versioning.service.ts`
- `server/src/modules/ai/types.ts`
- `server/src/modules/ai/analytics.ts`
- `server/src/modules/ai/lock.ts`
- `server/src/modules/ai-bot/routes.ts`
- `server/src/modules/calling/routes.ts`
- `server/src/modules/calling/meta-calling.service.ts`
- `server/src/modules/calling/call.processor.ts`
- `server/src/modules/calling/call-session.manager.ts`
- `server/src/modules/calling/webrtc-bridge.ts`
- `server/src/modules/calling/ai-voice-agent.ts`
- `server/src/modules/calling/deepgram.stt.ts`
- `server/src/modules/calling/google-tts.service.ts`
- `server/src/modules/calling/settings.service.ts`
- `server/src/modules/calling/agent-call.service.ts`
- `server/src/modules/calling/missed-call.service.ts`
- `server/src/modules/calling/routing.service.ts`
- `server/src/modules/calling/session-store.ts`
- `server/src/modules/calling/analytics.ts`
- `server/src/modules/calling/types.ts`
- `server/src/modules/calling/calling-settings.types.ts`
- `server/src/modules/billing/routes.ts`
- `server/src/modules/billing/plans.ts`
- `server/src/modules/billing/razorpay.service.ts`
- `server/src/modules/integrations/routes.ts`
- `server/src/modules/integrations/dispatch.ts`
- `server/src/modules/compliance/routes.ts`
- `server/src/modules/canned-replies/routes.ts`
- `server/src/modules/templates/routes.ts`
- `server/src/modules/templates/builder.ts`
- `server/src/modules/templates/analytics.ts`
- `server/src/modules/templates/types.ts`
- `server/src/modules/labels/routes.ts`
- `server/src/modules/sla/service.ts`
- `server/src/modules/analytics/routes.ts`
- `server/src/modules/team/routes.ts`
- `server/src/modules/team/assignment.ts`
- `server/src/modules/team/audit.ts`
- `server/src/modules/team/metrics.ts`
- `server/src/modules/team/totp.ts`
- `server/src/modules/team/types.ts`
- `server/src/modules/settings/routes.ts`
- `server/src/modules/settings/business-hours.ts`
- `server/src/modules/media/public.routes.ts`
- `server/src/modules/media/storage.ts`
- `server/src/modules/media/storage-adapter.ts`
- `server/src/modules/media/upload.service.ts`
- `server/src/modules/media/download.service.ts`

**Client**
- `client/src/App.tsx`
- `client/src/pages/DashboardPage.tsx`
- `client/src/pages/InboxPage.tsx`
- `client/src/pages/CallsPage.tsx`
- `client/src/pages/AiBotPage.tsx`
- `client/src/pages/AutomationsPage.tsx`
- `client/src/pages/FlowBuilderPage.tsx`
- `client/src/pages/CampaignsPage.tsx`
- `client/src/pages/ContactsPage.tsx`
- `client/src/pages/TemplatesPage.tsx`
- `client/src/pages/TeamPage.tsx`
- `client/src/pages/SettingsPage.tsx`
- `client/src/pages/BillingPage.tsx`
- `client/src/pages/ReportsPage.tsx`
- `client/src/pages/LoginPage.tsx`
- `client/src/pages/RegisterPage.tsx`
- `client/src/pages/ForgotPasswordPage.tsx`
- `client/src/pages/ResetPasswordPage.tsx`
- `client/src/pages/AcceptInvitePage.tsx`
- `client/src/pages/WhatsappCallbackPage.tsx`
- `client/src/components/Layout.tsx`
- `client/src/components/ProtectedRoute.tsx`
- `client/src/components/ErrorBoundary.tsx`
- `client/src/components/dashboard/*`
- `client/src/components/inbox/*`
- `client/src/components/calls/*`
- `client/src/components/ai-bot/*`
- `client/src/components/automations/*`
- `client/src/components/flows/*`
- `client/src/components/campaigns/*`
- `client/src/components/contacts/*`
- `client/src/components/templates/*`
- `client/src/components/team/*`
- `client/src/components/billing/*`
- `client/src/components/settings/*`
- `client/src/components/reports/*`
- `client/src/components/ui/*`
- `client/src/components/layout/*`
- `client/package.json`

**Repo root**
- `package.json`
- `docker-compose.yml`
- `README.md`
- `RUN-LOCALLY.md`
- `.github/workflows/ci.yml`

### 13.2 Environment variables (from `server/.env.example`)

| Group | Var | Default | Notes |
| --- | --- | --- | --- |
| Server | `PORT` | 5000 | |
| | `NODE_ENV` | development | |
| | `LOG_LEVEL` | debug | |
| | `CLIENT_URL` | http://localhost:5173 | CORS allow-list (single origin). |
| Database | `DATABASE_URL` | postgresql://postgres:postgres@localhost:5432/whatsapp_platform | |
| Redis | `REDIS_URL` | redis://localhost:6379 | |
| JWT | `JWT_SECRET` | change-me | **Replace in prod.** |
| | `JWT_REFRESH_SECRET` | change-me-another | **Replace in prod.** |
| | `JWT_EXPIRES_IN` | 15m | |
| | `JWT_REFRESH_EXPIRES_IN` | 7d | |
| Meta | `META_APP_ID` | — | |
| | `META_APP_SECRET` | — | Required for HMAC verify. |
| | `META_VERIFY_TOKEN` | whatsapp_verify_token | **Replace in prod.** |
| | `META_API_VERSION` | v21.0 | |
| | `META_REDIRECT_URI` | http://localhost:5173/settings/whatsapp/callback | |
| | `META_WEBHOOK_URL` | (empty) | Public HTTPS URL. |
| Crypto | `ENCRYPTION_KEY` | 64 hex chars | 32 bytes. **Replace; never commit the real one.** |
| Azure OpenAI | `AZURE_OPENAI_ENDPOINT` | — | |
| | `AZURE_OPENAI_API_KEY` | — | |
| | `AZURE_OPENAI_DEPLOYMENT` | gpt-35-turbo | |
| | `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | text-embedding-ada-002 | |
| | `AZURE_OPENAI_API_VERSION` | 2024-12-01-preview | |
| Calling | `DEEPGRAM_API_KEY` | — | |
| | `DEEPGRAM_LANGUAGE` | hi | |
| | `DEEPGRAM_SAMPLE_RATE` | 48000 | |
| | `GOOGLE_APPLICATION_CREDENTIALS` | key.json | Path to GCP service account JSON. |
| | `GOOGLE_TTS_VOICE` | en-IN-Neural2-A | |
| | `GOOGLE_TTS_LANGUAGE` | en-IN | |
| | `CALLING_AI_AUTO_ANSWER` | true | |
| | `CALLING_AI_GREETING` | Hello! Thank you for calling... | |
| Email | `EMAIL_FROM` | noreply@whatsapp-platform.local | |
| | `SMTP_HOST` | (empty) | |
| | `SMTP_PORT` | 587 | |
| | `SMTP_USER` | (empty) | |
| | `SMTP_PASS` | (empty) | |
| | `SMTP_SECURE` | false | |
| Storage | `STORAGE_DRIVER` | local | or `s3` |
| | `S3_BUCKET` | (empty) | |
| | `S3_REGION` | us-east-1 | |
| | `S3_ACCESS_KEY` | (empty) | |
| | `S3_SECRET_KEY` | (empty) | |
| | `S3_PUBLIC_URL` | (empty) | |
| Server URL | `SERVER_URL` | http://localhost:5000 | Used for media public URLs. |
| Razorpay | `RAZORPAY_KEY_ID` | rzp_test_SvXh... | Test key in example. |
| | `RAZORPAY_KEY_SECRET` | (example) | |
| | `RAZORPAY_WEBHOOK_SECRET` | rzp_whsec_... | |
| Alerts | `ALERT_CHECK_INTERVAL_MS` | 30000 | |
| | `DEFAULT_SLA_MINUTES` | 15 | |

### 13.3 Route table (REST surface)

**Auth** — `POST /api/auth/{register,login,refresh,logout,forgot-password,reset-password}`, `GET /api/auth/me`
**WhatsApp** — `GET /api/whatsapp/connect-url`, `POST /api/whatsapp/connect/callback`, `POST /api/whatsapp/connect/select`, `POST /api/whatsapp/connect`, `DELETE /api/whatsapp/numbers/:id`, `GET /api/whatsapp/numbers`, `GET /api/whatsapp/webhook`, `POST /api/whatsapp/webhook`, `GET /api/whatsapp/webhook-status`, `POST /api/whatsapp/setup-webhook`
**Inbox** — `GET /api/inbox`, `POST /api/inbox/start`, `GET /api/inbox/:id`, `GET /api/inbox/:id/messages`, `POST /api/inbox/:id/messages`, `PATCH /api/inbox/:id/assign`, `PATCH /api/inbox/:id/bot`, `PATCH /api/inbox/:id/status`, `POST /api/inbox/:id/notes`, `GET /api/inbox/messages/:messageId/media`
**Messages** — `POST /api/messages/send`
**Contacts** — `GET/POST /api/contacts`, `POST /api/contacts/import`, `POST /api/contacts/bulk`, `GET /api/contacts/tags`, `POST /api/contacts/tags/rename`, `DELETE /api/contacts/tags/:tag`, `GET /api/contacts/export`, `GET /api/contacts/:id`, `GET /api/contacts/:id/detail`, `PATCH /api/contacts/:id`, `DELETE /api/contacts/:id`
**Campaigns** — `GET /api/campaigns`, `GET /api/campaigns/quota`, `POST /api/campaigns/preview-audience`, `POST /api/campaigns`, `GET /api/campaigns/:id`, `GET /api/campaigns/:id/recipients`, `PATCH /api/campaigns/:id`, `DELETE /api/campaigns/:id`, `POST /api/campaigns/:id/send`, `POST /api/campaigns/:id/test`, `POST /api/campaigns/:id/pause`, `POST /api/campaigns/:id/resume`, `POST /api/campaigns/:id/cancel`, `POST /api/campaigns/:id/retry-failed`, `POST /api/campaigns/:id/duplicate`, `GET /api/campaigns/:id/stats`, `GET /api/campaigns/:id/analytics`, `GET /api/campaigns/:id/export`, `POST /api/campaigns/process-scheduled`
**Automations** — `GET /api/automations`, `POST /api/automations`, `PATCH /api/automations/:id`, `DELETE /api/automations/:id`, `GET /api/automations/analytics`, `GET /api/automations/conflicts`
**Flows** — `GET /api/flows/templates`, `GET /api/flows`, `POST /api/flows`, `POST /api/flows/validate`, `POST /api/flows/simulate`, `GET /api/flows/:id`, `GET /api/flows/:id/analytics`, `GET /api/flows/:id/versions`, `POST /api/flows/:id/duplicate`, `POST /api/flows/:id/publish`, `POST /api/flows/:id/restore/:version`, `POST /api/flows/from-template/:templateId`, `PATCH /api/flows/:id`, `POST /api/flows/:id/schedule`, `DELETE /api/flows/:id`
**AI Bots** — `GET /api/ai-bot/status`, `GET/POST /api/ai-bot`, `GET /api/ai-bot/:id`, `POST /api/ai-bot/:id/test`, `GET /api/ai-bot/:id/analytics`, `GET /api/ai-bot/:id/versions`, `GET /api/ai-bot/:id/audit`, `POST /api/ai-bot/:id/restore/:version`, `PATCH /api/ai-bot/:id`, `DELETE /api/ai-bot/:id`, `POST /api/ai-bot/:id/faq`, `PATCH /api/ai-bot/:id/faq/:faqId`, `DELETE /api/ai-bot/:id/faq/:faqId`, `POST /api/ai-bot/:id/ingest/url`, `POST /api/ai-bot/:id/ingest/pdf`
**Calling** — `GET /api/calling/status`, `GET /api/calling`, `GET /api/calling/analytics`, `GET/PATCH /api/calling/settings`, `POST /api/calling/enable`, `POST /api/calling/disable`, `GET /api/calling/:id`, `PATCH /api/calling/:id`, `POST /api/calling/:id/terminate`, `POST /api/calling/:id/accept`, `POST /api/calling/:id/decline`, `GET /api/calling/:id/signaling`, `POST /api/calling/callback`
**Billing** — `GET /api/billing`, `POST /api/billing/create-order`, `POST /api/billing/verify`, `POST /api/billing/webhook`, `PATCH /api/billing/plan`
**Integrations** — `GET/POST/DELETE /api/integrations/api-keys`, `GET/POST/PATCH/DELETE /api/integrations/webhooks`
**Compliance** — `GET /api/compliance/export`, `POST /api/compliance/delete-request`, `GET /api/compliance/sla`
**Canned replies** — `GET/POST/PATCH/DELETE /api/canned-replies`
**Templates** — `GET /api/templates`, `GET /api/templates/library`, `GET /api/templates/:name`, `GET /api/templates/:name/usage`, `POST /api/templates/upload-header`, `POST /api/templates`, `POST /api/templates/from-library`, `POST /api/templates/:name/test-send`, `POST /api/templates/:name/resubmit`, `DELETE /api/templates/:name`
**Labels** — `GET/POST/PATCH/DELETE /api/labels`, `POST /api/labels/conversations/:conversationId`, `DELETE /api/labels/conversations/:conversationId/:labelId`
**Team** — `GET /api/team/agents`, `GET /api/team/settings`, `PATCH /api/team/settings`, `POST /api/team/heartbeat`, `PATCH /api/team/me/availability`, `GET /api/team/departments`, `POST /api/team/departments`, `PATCH /api/team/departments/:id`, `DELETE /api/team/departments/:id`, `GET /api/team/invites`, `POST /api/team/invites`, `DELETE /api/team/invites/:id`, `GET /api/team/invites/token/:token`, `POST /api/team/invites/accept`, `GET /api/team/audit`, `GET /api/team/sessions`, `DELETE /api/team/sessions/:id`, `DELETE /api/team/sessions`, `POST /api/team/me/2fa/setup`, `POST /api/team/me/2fa/enable`, `POST /api/team/me/2fa/disable`, `GET /api/team`, `GET /api/team/:id`, `POST /api/team`, `PATCH /api/team/:id`, `POST /api/team/:id/reassign`, `DELETE /api/team/:id`
**Settings** — `GET /api/settings`, `GET /api/settings/ai/usage`, `PATCH /api/settings/business-hours`, `PATCH /api/settings/ai`, `GET /api/settings/ai`, `PATCH /api/settings/campaigns`
**Analytics** — `GET /api/analytics/overview`, `GET /api/analytics/reports`
**Public media** — `GET /api/media/public/:orgId/:filename`
**Health** — `GET /health`

### 13.4 Prisma data model overview (35+ models)

- **Identity & tenancy**: `User`, `Organization`, `OrganizationUser`, `TeamDepartment`, `TeamInvite`, `TeamAuditLog`, `PasswordResetToken`, `RefreshToken`, `ApiKey`, `WebhookEndpoint`, `CannedReply`, `PaymentOrder`
- **WhatsApp**: `WhatsappNumber`, `Contact`, `Conversation`, `Message`, `InternalNote`, `Label`, `ConversationLabel`
- **Calling**: `Call`
- **Automation**: `Automation`, `AutomationLog`
- **Flows**: `Flow`, `FlowVersion`
- **AI**: `AiBot`, `AiBotVersion`, `AiBotAuditLog`, `AiUsageLog`, `KnowledgeBaseItem`
- **Campaigns**: `Campaign`, `CampaignRecipient`
- **Audit**: `AuditLog`

Enums cover: `UserRole`, `OrgRole`, `AgentAvailability`, `TeamInviteStatus`, `TeamAuditAction`, `ConversationStatus`, `ContactSource`, `MessageDirection`, `MessageType`, `MessageStatus`, `CallDirection`, `CallStatus`, `CallHandler`, `TriggerType`, `FlowTriggerType`, `FlowStatus`, `CampaignStatus`, `KnowledgeSourceType`, `PaymentStatus`.

Key relations: every model is scoped to `organizationId` (except `User`, which is global). Conversations own Messages, Notes, Labels, Calls. Calls reference Contact, Conversation, WhatsappNumber, AiBot, User(agent). AiBot has many `KnowledgeBaseItem`, `AiBotVersion`, `AiBotAuditLog`. Flow has many `FlowVersion`. Campaign has many `CampaignRecipient` with status mirrors of `MessageStatus`. Audit logs are written for team actions (`TeamAuditLog`) and for automation runs (`AutomationLog`); a top-level `AuditLog` exists for compliance events.

### 13.5 Data model risks

- `ApiKey.keyHash` is `sha256(plaintext)` — fine for verification, but rotation means revoking + re-issuing. No key versioning.
- `WhatsappNumber.accessToken` is encrypted with a single env-derived key. Rotation requires re-encrypting every record.
- `AiUsageLog.totalTokens` is not constrained by org plan at write time — only `checkOrgTokenQuota` blocks new completions when the limit is reached. Old usage is never re-billed.
- `CampaignRecipient.variables` (JSON) is used to template the message body — a malicious user could put any string in there. Validation is `string[]` only. Verify the template renderer is safe.
- `Message.metadata` is `Json?` — free-form. No schema. Cross-module coupling is via this column (template params, button reply IDs, etc.).
- `Conversation.botState` is `Json?` — used to persist flow state. No schema versioning; schema changes are migration-by-convention.
- `Organization.settings` (Json) is a grab-bag of `businessHours`, `team`, `ai`, `campaigns`, `calling`. Schema drift risk.

---

*End of audit.*
