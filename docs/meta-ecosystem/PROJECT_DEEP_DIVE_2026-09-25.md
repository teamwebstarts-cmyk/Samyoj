# Samyoj Platform — Full Project Deep Dive

**Date:** 25 Sep 2026
**Branch:** `v8.5.0-phase0-ecosystem`
**Scope:** Complete repo walkthrough — architecture, stack, every module, Meta ecosystem (Ads + Leadgen POC), security, and current branch state.

---

## 1. Executive Summary

Samyoj (internal name: `whatsapp-platform`) is a **multi-tenant social commerce + customer communication SaaS** for small businesses. It started as a WhatsApp Business automation platform and has grown into a full Meta ecosystem product: WhatsApp + Facebook Messenger + Instagram (DMs, comments, lead ads) + read-only Ads insights, with AI bots, campaigns, flows, commerce, and billing.

- **3 apps:** `client` (customer SaaS UI), `admin` (platform operator UI), `server` (Express API + embedded workers).
- **Stack:** React 18 + Vite + TS + Tailwind / Express + TS / Prisma + PostgreSQL 16 / Redis + BullMQ / Socket.IO.
- **Scale:** ~1,500 indexed files, 477 files in `server/src/modules` alone, 252 test files. Server suite: 187 files / 1,181 tests; client suite: 46 files / 206 tests.
- **Current phase:** Phase 0–5 Meta ecosystem complete at code level; live-Meta proof (App Review, real accounts) pending.

---

## 2. Repository Layout

```
├── client/          # Customer SaaS frontend (React + Vite + Tailwind)
├── admin/           # Platform operator frontend (same stack, subdomain-served)
├── server/          # Express API + Socket.IO + embedded BullMQ workers
│   ├── src/
│   │   ├── index.ts             # App bootstrap, route mounting, CSP, CORS
│   │   ├── modules/             # 30+ feature modules (477 files)
│   │   ├── workers/             # BullMQ processors (embedded in API process)
│   │   ├── middleware/          # auth, rbac, plan-guard, csrf, api-key
│   │   ├── services/            # shared services
│   │   ├── integrations/        # openapi, zapier, google-sheets, inbound
│   │   ├── config/              # database, cors, csp, sentry, telemetry
│   │   └── prisma/              # schema.prisma + migrations
│   └── scripts/                 # migrate-safe, backup, audit, webhook setup
├── scripts/         # dev-tunnel.sh, public-dev-url.sh, ngrok helpers
├── config/          # ecosystem.config.js (PM2), .env.sample
├── docs/meta-ecosystem/   # Phase plans, audits, implementation docs
├── docker-compose.yml     # postgres:16 + redis:7 (local dev)
├── start.sh / setup.sh    # one-command bootstrap
└── RUNBOOK.md             # ops runbook
```

---

## 3. Tech Stack (verified from package.json)

| Layer | Technology | Evidence |
|-------|-----------|----------|
| Frontend | React 18.3, React Router 7.1, Vite 6, Tailwind 3.4, lucide-react, react-select, @xyflow/react (flow builder), @tanstack/react-virtual, socket.io-client, axios, react-hot-toast | `client/package.json` |
| Admin frontend | Same stack as client | `admin/package.json` |
| Backend | Express 4.21, TypeScript 5.7, Zod 3.24 (validation), jsonwebtoken 9, bcryptjs, helmet 8, cors, express-rate-limit 7 | `server/package.json` |
| Database | PostgreSQL 16 via Prisma 6.3 (`@prisma/client`) | `docker-compose.yml`, `server/package.json` |
| Cache/Queue | Redis 7 (ioredis 5.4) + BullMQ 5.34 | `docker-compose.yml`, `server/package.json` |
| Realtime | Socket.IO 4.8 (path `/api/socket.io`, JWT-authenticated handshake) | `server/src/index.ts:66-72` |
| AI | OpenAI SDK 7.3 (root dep), Sarvam chat service, embeddings | `package.json`, `server/src/modules/ai/` |
| Media | sharp (optional), ffmpeg-static, pdfkit, pdf-parse | `server/package.json` |
| Observability | Sentry 10.74, Winston 3.19, custom telemetry | `server/src/config/` |
| Testing | Vitest (server + client + admin), Supertest | all `package.json` |
| Email | Nodemailer 9.1 | `server/package.json` |
| Calling | @roamhq/wrtc (WebRTC) | `server/package.json` |

**Key architectural fact:** Workers are **embedded in the API process** (`workers/index.ts`). `npm run start:worker` deliberately exits with an error: *"Workers are embedded in the API. Do not start a second consumer."*

---

## 4. Server Bootstrap Flow (`server/src/index.ts`, 492 lines)

1. **Sentry init** → **config validation** → **Express app** + HTTP server.
2. **Two CORS delegates:** `customerCors` (client origins) and `platformCors` (admin subdomain) — host-based multi-app routing.
3. **Socket.IO** mounted at `/api/socket.io` with `socketAuthMiddleware` (JWT + org membership), rooms `org:{id}` and `user:{id}`, presence sweeper, membership re-guard (kicks removed members).
4. **Webhook raw-body parsers** registered for Meta/WhatsApp endpoints (`express.raw` 1–10 MB) before `express.json({ limit: '10mb' })`.
5. **35 route mounts** under `/api/*` (full list in §6).
6. **Admin/client static serving** in production: `express.static(adminDist)` guarded by platform-host check, then client `dist`/`public`.
7. **Global error handler** + ops error file transport.

---

## 5. All API Route Mounts (verified at `index.ts:247-281`)

| Mount | Module | Purpose |
|-------|--------|---------|
| `/api/media/public` | media | Public media (signed) |
| `/api/media` | media | Org media, image-optimize pipeline |
| `/api/auth` | auth | Register/login/JWT/session/cookies/OAuth |
| `/api/whatsapp` | whatsapp | Cloud API numbers, templates, webhooks |
| `/api/facebook` | facebook | Page connect, Messenger inbox, **Ads (read-only)**, leadgen |
| `/api/instagram` | instagram | IG inbox, comments, private replies |
| `/api/inbox` | inbox | Unified inbox, presence |
| `/api/automations` | automation | Keyword/auto-reply rules |
| `/api/flows`, `/api/flows-assets` | flows | Flow builder engine + assets |
| `/api/settings` | settings | Org settings |
| `/api/campaigns` | campaigns | Bulk messaging campaigns |
| `/api/contacts` | contacts | Contact CRM |
| `/api/analytics` | analytics | Dashboards, overview-period |
| `/api/templates` | templates | WhatsApp template CRUD/submit |
| `/api/messages` | messages | Send service, idempotency, leases |
| `/api/team` | team | Members, invites, roles |
| `/api/ai-bot` | ai-bot | AI bot config, training |
| `/api/calling` | calling | Voice calling (WebRTC) |
| `/api/labels`, `/api/canned-replies` | inbox tools | Tagging, canned responses |
| `/api/billing` | billing | Plans, Razorpay, invoices, AI credits |
| `/api/compliance` | compliance | Opt-in/consent |
| `/api/integrations` | integrations | Zapier, Google Sheets, inbound webhooks, OpenAPI |
| `/api/onboarding` | onboarding | Readiness checks |
| `/api/wa-forms` | wa-forms | WhatsApp form builder |
| `/api/catalog`, `/api/commerce` | commerce | Product catalog, orders |
| `/api/content-studio` | content-studio | Composer, library, calendar, approvals, brand kit, images, videos, voices |
| `/api/v1` | public-api | Public REST API (API-key auth) |
| `/api/leads` | leads | Lead CRM incl. `META_ADS` source |
| `/api/tickets` | tickets | Support tickets |
| `/api/support` | support | AI support chat, knowledge |
| `/api/platform` | platform | Operator platform admin (separate host) |

---

## 6. Multi-Tenancy & Auth Model

- **Tenant = Organization.** Every table keys on `organizationId`.
- **Auth chain:** `authenticate` (JWT in HttpOnly cookie, Path=/api) → `requireOrg` → `loadOrgRole` → `requireOrgRole('OWNER','ADMIN',...)`.
- **Plan guard:** `requireActiveCommercial()` gates expensive Meta features (connect URL issuance, ad account selection).
- **CSRF:** `requireTenantCsrf` for cookie-auth mutations; platform host has its own `x-platform-csrf-token`.
- **Socket auth:** same JWT + membership; periodic `startMembershipGuard` disconnects revoked users.
- **API keys:** `middleware/api-key.ts` + `authenticate-jwt-or-api-key.ts` for public API and Zapier.
- **Secrets:** channel tokens stored **AES-GCM encrypted** (`MetaWhatsAppService.decryptToken`), never sent to client.

---

## 7. Meta Ecosystem — The Core Differentiator

### 7.1 Channel Model

One org → connected channels:

| Platform | Ingest file | Inbox routes | Features |
|----------|------------|--------------|----------|
| WhatsApp (WA) | whatsapp webhook processor | inbox | Templates, campaigns, flows, catalog, forms |
| Facebook (FB) | `messenger-ingest.ts`, `leadgen-ingest.ts` | `messenger-inbox.routes.ts` | Messenger text/media, **Ads read**, Lead Ads |
| Instagram (IG) | `ingest.ts`, `comment-ingest.ts` | `inbox.routes.ts`, `comments.routes.ts` | DMs, comments, hide, private replies |

All Meta channels ride on **one OAuth grant** — `FACEBOOK_PAGE_LEADGEN_SCOPES` (`connect-oauth-state.ts:74-85`):

```text
pages_show_list, pages_manage_metadata, pages_read_engagement,
pages_messaging, leads_retrieval,
instagram_basic, instagram_manage_messages, instagram_manage_comments,
ads_read          ← READ ONLY. ads_management deliberately absent.
```

### 7.2 Facebook Page Connect Flow (verified in `routes.ts`)

1. `GET /api/facebook/connect-url` (admin + commercial plan) → signed JWT state (HS256, 30-min TTL, audience `samyoj-oauth-state`), redirect URI validated against allowlist (`/settings/facebook/callback[/popup]`).
2. OAuth dialog (`auth_type=rerequest`) → user grants scopes.
3. `POST /connect/callback` → code exchange → `listManagedPages(userToken)`:
   - `/me/accounts` → fallback `/me`-as-Page (Facebook Login for Business) → fallback **Business Manager scan** (`/me/businesses` → `owned_pages` + `client_pages`) with per-page token fill.
   - 1 page → auto-save; multiple → `pendingToken` + picker (`POST /connect/select`).
4. `saveFacebookPageChannel` → Channel row (encrypted token) + `subscribePageWebhooks` (`subscribed_fields: 'leadgen,messages'`).
5. `POST /disconnect` → channel teardown.

### 7.3 Facebook Ads Read — Feature Deep Dive (the POC)

**Philosophy:** *show Meta's numbers, never mutate ads, never invent data.* Verified end-to-end.

#### Data flow

```
Meta Graph API (ads_read)
   ↓  page-client.ts
   ├─ listAdAccountsForPage():  GET /{pageId}/assigned_ad_accounts  → fallback /me/adaccounts
   │                            (limit 10, account_status mapped, code-100/10/200/190 handling)
   └─ fetchAdAccountInsights(): GET /act_{id}/insights
                                ?fields=spend,impressions,clicks,actions,date_start,date_stop
                                &date_preset=last_7d&level=account
                                &action_attribution_windows=["7d_click","1d_view"]
   ↓  ads-insights.ts (~330 lines)
   ├─ parseInsightsBody(): zero-safe parse; spend→money string
   ├─ leadCountFromActions(): prefers action_type 'lead', else 'onsite_conversion.lead_grouped';
   │                           sums 7d_click + 1d_view (attribution-aware), else unwindowed value
   ├─ cplFromSpend(): integer-cents math (no float drift)
   ├─ pickAdAccount(): preferred ID → first accountStatus===1 → first row
   └─ upsert MetaAdsSnapshot (ONE row per org — organizationId @unique, intentional)
   ↓
PostgreSQL meta_ads_snapshots
   ↓                          ↓
GET /api/facebook/ads-summary   workers/index.ts:932-955
(readAdsSummary: cache ≤ 20h,   (boot refresh + 24h setInterval pollMetaAdsSnapshots)
 else refreshOrgAdsSnapshot)
   ↓
client: FacebookAdsPage.tsx (244 lines) + MetaAdsRecap.tsx (56 lines, dashboard)
```

#### Routes (all verified in `routes.ts`)

| Method | Path | Guard | Purpose |
|--------|------|-------|---------|
| GET | `/api/facebook/ads-summary` | auth + org | Cached snapshot or on-demand refresh; 5 statuses |
| GET | `/api/facebook/ads-accounts` | auth + org | Account list + selection state |
| POST | `/api/facebook/ads-account` | **OWNER/ADMIN + commercial plan** | Select active ad account → stored in `organization.settings.meta.adsAccountId` → immediate refresh |

#### Status machine (honest empty states)

| Status | Server cause | UI behaviour |
|--------|-------------|--------------|
| `ready` | snapshot upserted | Spend tile + 4 facts (Impressions/Clicks/Leads/CPL) + account picker (only if >1) + Ads Manager deep link |
| `no_page` | no active FB channel | "Connect a Facebook Page first" guide + connect button |
| `no_account` | no ad accounts shared to Page | Guide + link to Meta Business Settings — **no fake ₹0** |
| `needs_permission` | Graph code 10/200/190 or /permission\|ads_read/ | "Ads read not granted" guide + reconnect |
| `error` | refresh threw, no cached snapshot | Retry button |

Snapshot gone on channel loss: `readAdsSummary` clears `MetaAdsSnapshot` when no channel exists — `no_page` never shows stale numbers.

#### Design guarantees (test-enforced)

- `ads-insights.test.ts:86-98`: routes match **no** `/ads-(create|pause|resume|delete)`; OAuth contains `ads_read` and **not** `ads_management`; no `activatePlan` call (spend never touches billing).
- Empty insights → real zeros, not crash (zero-delivery day is a valid state).
- Token never leaves server; account names rendered as `<option>` text (no HTML injection).
- `MetaAdsRecap` renders **only** when `status==='ready' && snapshot` — dashboard shows nothing rather than zeros. Same endpoint as Ads page → single source of truth.

#### Ads Manager link

`adsManagerUrl()` → `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act={id}` (strips `act_`, URL-encoded). All actions happen in Meta's UI, not ours.

### 7.4 Lead Ads (Leadgen) — the Ads companion POC

`leadgen-ingest.ts` — *"Upsert Lead from a claimed leadgen webhook. Does not create Conversations."*

1. Webhook `leadgen` field → `claimPageChannel()` → `ingestLeadgenForChannel({ organizationId, channelId, pageAccessToken, leadgenId })`.
2. `fetchLeadgenLead()` → `GET /{leadgenId}?fields=id,created_time,form_id,ad_id,adset_id,campaign_id,field_data`.
3. `mapLeadgenFields()` → name (first/last/full variants), phone (phone_number/phone/mobile…), email (email/email_address).
4. **Idempotent upsert** of `Lead` with `source='META_ADS'` + `metaLeadId/metaFormId/metaAdId/metaAdSetId/metaCampaignId` — duplicate webhook deliveries create ONE row.
5. Phone + consent + approved template → WhatsApp follow-up attempt, **fail-closed** (no consent → no message).
6. No `Conversation` created — Lead Ads are separate from Messenger inbox threads.

`subscribePageToLeadgen()` keeps `subscribed_fields: 'leadgen,messages'` — Instant Forms never dropped when Phase 3 added messaging.

### 7.5 Instagram surface (context)

- `page-client.ts`: `sendInstagramTextMessage` (Page-linked IG DM, recipient = IGSID, no `messaging_type`), `sendInstagramPrivateReply` (comment → DM bridge via `recipient: { comment_id }`), `hideInstagramComment`, `subscribeInstagramAccount` (`messages,comments,live_comments`).
- `comment-ingest.ts` / `ingest.ts` handle webhook fan-in; `inbox.routes.ts` + `comments.routes.ts` expose moderation.

### 7.6 Audit Score — the project's own truth tracker

`audit-score.ts` + `audit-score.test.ts` enforce the phase claims with `must`/`mustNot` string checks against real source files:

```text
SCORE done=19 remaining=1 out=5 live_unproven=2   (failures: [])
```

- **19 done:** all inbox features, keyword/WELCOME/AWAY/LEAD_CAPTURE automation, AI bot, bulk, media send, `ADS-readonly`.
- **1 remaining:** SAMYOJ-011 (flow engine on FB/IG).
- **5 out:** template cards, `ADS-unique` (one snapshot per org is intentional), `ADS-create`, IG stories/publish.
- **2 live-unproven:** `ADS-live`, `LEAD-live` — waiting on Meta App Review + real accounts.

---

## 8. AI Layer (`server/src/modules/ai/`, 47 files)

- **Chatbot service** (`chatbot.service.ts`, ~800+ lines): tool use, human-handoff detection (`wantsHumanOnCall`), guardrails, rate limits, reply-repeat suppression, org-specific config resolution (custom endpoint/key/model honored).
- **Knowledge:** `knowledge.service.ts` + `embeddings.service.ts` + `knowledge-ingest.service.ts` (PDF via pdf-parse), preview + versioning services.
- **Personality/training generators**, voice instructions + fallbacks, bot-assignment service.
- **Credits:** billing/ai-credits pool + recurring grants meter AI usage.

---

## 9. Messaging Core

- `messages/send.service.ts` + `send-lease.ts` + `outbound-idempotency.ts` — dedupe keys and leases prevent double-sends on webhook retries.
- `interactive.ts` — buttons/lists; `agent-only.ts` — human-agent restrictions.
- `workers/webhook.processor.ts` — BullMQ processor; contact-creation quota serialized ("all contact creation paths honor this quota").
- Realtime: Socket.IO rooms per org/user; presence sweeper; calling-preview socket handlers.

---

## 10. Billing

- Razorpay service + subscription state machine (`billing-transitions.test.ts`), invoices (pdfkit), payment links.
- `plans.ts` + `entitlements.service.ts` + `usage.service.ts` — plan gates enforced at route level (`requireActiveCommercial()`).
- AI credits: catalog, pool-map, recurring grants.

---

## 11. DevX & Ops

- **Root scripts:** `npm run dev` (concurrently server+client+admin), `build` (client→admin→server), `db:migrate`, `docker:up`.
- **Safe migrations:** `db:migrate` = validate migration chain → preflight WhatsApp-number isolation → `prisma migrate deploy`. Plus `migrate-startup-safe` / `migrate-reconciliation-safe` scripts and DB backup/restore scripts.
- **Tunnels:** `scripts/dev-tunnel.sh`, `public-dev-url.sh`, `ngrok-tunnel.sh` — webhook testing from local.
- **PM2:** `config/ecosystem.config.js`.
- **Webhook tooling:** `setup-webhook.ts`, `test-webhook.sh`, `diagnose-webhook.sh`.
- **Config:** `.env` per app + `.env.example`; secrets via Doppler optional (`dev:doppler`).

---

## 12. Security Posture (Meta surface)

| Concern | Control |
|---------|---------|
| Scope creep | `ads_management` never requested; test-asserted |
| Token theft | AES-GCM encrypted at rest; Bearer headers only (never query string); never returned to client |
| OAuth state forgery | Signed JWT (HS256, 30 min, audience-checked); redirect URI allowlist |
| Cross-tenant reads | Every query filters `organizationId` from session, not request |
| Privilege escalation on account pick | OWNER/ADMIN role + commercial plan gate |
| Billing integrity | No `activatePlan` in ads code path; test-enforced |
| Fake data | Zero-delivery is valid; `no_account` shows guide; recap hidden until snapshot exists |
| XSS | Option/select text nodes; no account-name HTML |
| Webhook forgery | Raw-body signature verification on Meta/WhatsApp endpoints (dedicated raw parsers before JSON) |

Known residuals (low): no per-endpoint Graph rate-limit backoff; no alerting on poll failure; concurrent admin account selection race is benign.

---

## 13. Current Branch — What's Changed (18 files)

Working tree touches (this branch, uncommitted/in-flight):

- **Server Meta modules:** `facebook/routes.ts`, `messenger-inbox.routes.ts`, `messenger-ingest.ts`, `channel-inbox-actions.ts`, `channel-keyword.ts`, `leadgen-ingest.ts`, `instagram/{index,ingest,comment-ingest,inbox.routes}.ts`, `analytics/routes.ts`.
- **Scripts:** `dev-tunnel.sh`, `public-dev-url.sh`, `start.sh`, `server/scripts/migrate-startup-safe.ts`.
- **Docs:** `docs/meta-ecosystem/BRANCH_AUDIT_2026-09-25.md` (today's audit), chat transcript.
- **Infra:** `.devcontainer/devcontainer.json`.

Read of the change set: this branch is the **Phase 0–5 Meta ecosystem consolidation** — hardening Facebook/Instagram ingest + inbox routes, Ads/leadgen wiring, analytics surface, and dev-environment plumbing (tunnels, startup-safe migrations).

---

## 14. Testing & Verification Status

| Suite | Count | Status |
|-------|-------|--------|
| Server (vitest) | 187 files / 1,181 tests | ✅ pass |
| Phase 0–5 gate | 13 files / 78 tests | ✅ pass |
| Client (vitest) | 46 files / 206 tests | ✅ pass |
| Meta client gate (`audit-score.test.ts`) | 4 files / 14 tests | ✅ pass |
| TS checks (server + client) | — | ✅ pass |
| Production builds | — | ✅ pass |

**Not yet proven live (the only gap):**
1. `ads_read` Meta App Review submission/approval.
2. Real ad account shared to a Page → snapshot numbers compared against Ads Manager UI for the same 7-day window.
3. Real Instant Form submit → webhook → Lead row with attribution IDs.
4. Production OAuth callback registration + customer-host inbound proof.

---

## 15. Competitive Positioning (from project docs)

| Capability | Samyoj | AiSensy/Interakt/WATI |
|-----------|--------|----------------------|
| Ads | Honest read-only snapshot + deep link | Full Ads Manager clones (heavier review burden) |
| Empty states | Guides, never fake ₹0 | Often misleading zero tiles |
| Lead capture | Idempotent, attribution-aware | Standard |
| Attribution | `7d_click + 1d_view` lead counting | Often unwindowed totals |
| Inboxes | WA + FB + IG unified shell | Comparable |

Samyoj deliberately trades "Ads Manager clone" breadth for honesty, accuracy, and a lighter Meta App Review load.

---

## 16. Key Takeaways

1. **Monorepo, three apps, one API process** — workers embedded, Socket.IO colocated, host-based client/admin routing.
2. **Meta-first architecture** — one OAuth grant powers WA-adjacent FB/IG/Ads/Leadgen; all channels converge on the unified inbox.
3. **Ads is a read-only POC done right** — attribution-aware CPL, zero-invention UI, admin-gated account selection, cache+poll strategy, test-enforced scope boundaries.
4. **Leadgen closes the loop** — ad → Instant Form → webhook → Lead (idempotent) → optional consent-gated WhatsApp follow-up → funnel into campaigns/AI.
5. **The audit-score system is the source of truth** — every "done" claim is a string check against real code; 19/1/5/2 with zero failures.
6. **Only blocker is live-Meta proof** — everything else is type-checked, tested, and built.
