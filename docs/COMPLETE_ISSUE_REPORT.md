# Samyoj — Complete Issue Report & Readiness Assessment

> Single-source audit of every issue found across the codebase, produced by end-to-end
> scenario tracing (frontend → backend → DB → 3rd-party → realtime) plus direct source
> verification. Branch: `phase-4` (no `master` exists; de-facto trunk baseline is `64f8448` / phase-3 tip).
> Last updated: 2026-08-21. Confidence: 0.88.

---

## 1. Project at a glance

**Samyoj** — multi-tenant WhatsApp Business automation platform on the Meta Cloud API.

| Layer | Tech | Ports |
|---|---|---|
| Client (tenant SaaS UI) | React 18 + Vite 6 + TS + Tailwind | 3000 |
| Admin (platform-operator console) | React 18 + Vite 6 + TS | 3001 |
| API + workers + realtime | Node + Express + TS, Prisma, BullMQ (embedded) | 8000 |
| DB | PostgreSQL | 5432 |
| Cache/queues | Redis | 6379 |

- **One Express process** serves API + static client/admin (host-routed). Workers are **embedded** (`startWorkers()`); `npm run dev:worker` deliberately exits (RUNBOOK corrected).
- **AI stack:** Sarvam is the chat brain + STT/TTS (voice). Azure OpenAI is **embeddings-only** for RAG. (Stale audit claims "Azure = brain" / "Deepgram/Google" are wrong.)
- **Tunnel:** ngrok only (never Cloudflare).
- **Secrets:** dotenv (optionally Doppler); server-side only; never exposed in UI.

**⚠️ Reality vs. README** — README says ports `5000/5173` and `npm run dev:worker`; actual is `8000/3000/3001` and workers are embedded. README is stale.

---

## 2. Research methodology & resources used

**Method:** For each scenario, trace every hop with `file:line` references, then find logic bugs / race conditions / edge cases / gaps. Cross-checked against `docs/audit/` and `docs/billing/` (stale-audit discrepancies flagged inline). Verified by reading the actual working-tree source, not summary docs alone.

**Resources referenced:**
- Source: `server/src/{index,workers,config}`, `modules/{whatsapp,inbox,messages,campaigns,automation,flows,ai,calling,billing,auth,team}`, `prisma/schema.prisma`
- Docs: `docs/audit/`, `docs/billing/`, `docs/calls/`, `docs/AUTH_SETUP.md`, `docs/deployment/`, `RUNBOOK.md`
- Git: `phase-4` = 2 billing commits on phase-3 base (`64f8448`); no `master` branch.

**Verification commands (taste gate):**
- Typecheck: `npx tsc --noEmit` in **both** `client/` and `server/`
- Test: `cd server && npx vitest run` (billing suite, auth/session.test, webhook.processor.test, automation, etc.)
- Typecheck gate is treated as required before marking any task done.

---

## 3. Findings by end-to-end scenario

### 3.1 Messaging (inbound + outbound agent sends)

**Inbound trace:** Meta webhook → `POST /api/whatsapp/webhook` (whatsapp/routes.ts:604) → HMAC gate, raw body preserved (index.ts:185-201) → route by `phoneNumberId` (routes.ts:699-704) → record receipt (708) → enqueue `webhookQueue` (728) → worker `processWebhookFields` + `processWebhookPayload` (workers/index.ts:136-139) → dedup by `metaMessageId @unique` (webhook.processor.ts:249) → `emitToOrg('message:new')` → socket.io `org:{id}` (realtime.ts:56).

**Outbound trace (actual, NOT as documented):** `POST /api/inbox/:id/messages` (inbox/routes.ts:1268) → create message PENDING (1533) → **synchronous** `deliverOutboundMessage` (1558) → Meta Send API → status via inbound webhook.

> **Reality check:** There is **no send queue**. The `message-queue` worker exists (workers/index.ts:163) but has **zero producers** (`messageQueue.add` returns no matches in `server/src`). Sends are synchronous. The README/audit "Agent Reply → Message Queue → Worker" is stale.

| # | Sev | Issue | File:line |
|---|---|---|---|
| M1 | 🔴 | **Call webhooks processed twice** (inline route `void processWebhookFields` + worker re-runs it). Only `connect` is lock-guarded → `terminate`/`dtmf` double-execute → double `message.update`, double `call:updated`, double `triggerCallCompletedFlow`. | whatsapp/routes.ts:717-726 (inline) + workers/index.ts:136 (worker) + call.processor.ts:868/870 vs connect lock :839, session-store.ts:158 |
| M2 | 🔴 | **No idempotency on outbound send → double-send + duplicate message row.** Route creates a fresh UUID message (1533) and sends sync (1558); `grep idempotency_key` = zero uses in src → client retry/double-click = two Meta sends + two DB rows. | inbox/routes.ts:1533, 1558; send.service.ts:187 |
| M3 | 🔴 | **`message-queue` worker is dead code (no producer).** Misleading docs; its dedup guard (workers/index.ts:189-195) never runs for agent sends. | workers/index.ts:163-226 |
| M4 | ⚠️ | Read-then-write TOCTOU in `applyProviderMessageStatus` → `READ→DELIVERED` regression on concurrent ticks (no re-check in `updateMany`). | provider-status.ts:86, 104-112, 125 |
| M5 | ⚠️ | Inert client multi-number filter: `message:new`/`message:status` emits omit `whatsappNumberId`, so the client filter (`eventNumberId!==activeNumber.id`) never drops (undefined ≠ undefined is false). HTTP refetch is the real guard. | webhook.processor.ts:363-380, send.service.ts:456-472; client useInboxRealtime.ts:72-79 |
| M6 | 📝 | Orphaned `unmatched_provider_statuses` rows have no TTL/cleanup; raw-body `JSON.stringify` fallback breaks HMAC if Meta ever sends non-JSON. | send.service.ts:441-449; whatsapp/routes.ts:653 |

### 3.2 AI bot (chat brain) + WhatsApp voice calling

**Chat brain trace:** inbound → `handleInboundAutomations` (engine.ts:399) → `queueAiBotProcessing` (debounce, jobId `ai-bot-{convId}`) → `automationQueue` → `processAiChatbotJob` (engine.ts:314, `withAiBotConversationLock`) → `generateBotReply` (chatbot.service.ts:304) → `createChatCompletion` → Sarvam default (`sarvam-105b`/`sarvam-105b-conversations`, sarvam-chat.service.ts:231) or Azure fallback → RAG via Azure embeddings → guardrails → `sendAutomationReply` → `deliverOutboundMessage`.

**Voice trace:** inbound call → WebRTC bridge (`@roamhq/wrtc`) → Sarvam STT `saaras:v3-realtime` → `sarvam-105b-conversations` streaming (chatbot.service.ts:628/532) → Sarvam TTS `bulbul:v3` → `bridge.playPcm` → handoff (`call.processor.ts`). **Outbound calls: no AI** (BIC path returns early at call.processor.ts:213-277).

| # | Sev | Issue | File:line |
|---|---|---|---|
| V1 | 🔴 | STT language hardcoded `'hi-IN'`, not `'auto'` — defeats caller-language auto-detection; `SARVAM_STT_LANGUAGE=auto` default is overridden. | bot.service.ts:150 |
| V2 | 🔴 | `resolveEffectiveVoiceConfig` strips `'auto'` (discards it when admin sets it) → falls back to ttsLanguage/en-IN. | settings.service.ts:109-112 |
| V3 | 🔴 | TTS speaker set once at construction, never adapts when STT detects a different language → Hindi voice reads English (etc.). | ai-voice-agent.ts:122, 181 |
| V4 | 🔴 | Handoff message spoken/sent BEFORE agent-availability check → promises connection then may find no agent. | ai-voice-agent.ts:716-717; engine.ts:387-390; team/assignment.ts:105 |
| V5 | 🔴 | `frequency_penalty: 0.1` sent to `sarvam-105b-conversations` — an undocumented param (Sarvam docs list `temperature,max_tokens,stream,tools,tool_choice,response_format`); risk of silent empty voice replies; no empty-content retry. | sarvam-chat.service.ts:165, 251 |
| V6 | 🔴 | Voice streaming REQUIRES Sarvam; Azure-org voice calls get 503. | chat-completion.service.ts:91-92 |
| V7 | 🟠 | STUN-only ICE, no TURN → strict-NAT/mobile calls fail media. | webrtc-bridge.ts:22 |
| V8 | 🟠 | Help Center is a **second, separate AI brain** (`support/chat.service.ts` `answerSupportQuestion`) bypassing guardrails/rate-limit/handoff/RAG. | support/chat.service.ts:5, 157 |
| V9 | 🟠 | Automation/AI reply double-send on BullMQ retry — `sendAutomationReply` (engine.ts:154) has no idempotency, `message.create` has no unique constraint (166), no Meta idempotency key; handoff-after-send (387→390) is a concrete retry vector. | engine.ts:166, 184, 387, 531; send.service.ts:187 |
| V10 | 🟠 | Zero tests for `chatbot.service.ts`, `webrtc-bridge.ts`, `sarvam.stt.ts`. | ai/ (no chatbot.service.test.ts); calling/ |
| V11 | 🟡 | Inconsistent `max_tokens` default (1024 vs 500); `reasoning_effort:null` sent to `sarvam-105b`; startup pre-warm bypasses facade and sends unsupported params; early-TTS may speak self-correcting text. | sarvam-chat.service.ts:163,168,251; index.ts:449-463; ai-voice-agent.ts:456-490 |
| V12 | 🟢 | Dead `deepgramLanguage` config (no Deepgram code exists); dual echo-reject constant; two internal summary generators bypass guardrails. | calling-settings.types.ts:20; spoken-text.ts:44; ai-voice-agent.ts:99,1208; chatbot.service.ts:922 |

### 3.3 Billing / entitlements / usage / checkout

**Checkout trace:** `POST /billing/create-order` (client BillingPage.tsx:126 → api.ts:688 → routes.ts:137) → resolve SKU by `planTier+cadence` (routes.ts:152) → `skuId` only in Razorpay notes, **not** persisted (164) → `PaymentOrder CREATED` (167-176) → client checkout → `POST /billing/verify` (HMAC, idempotency if CAPTURED, 232) → `activatePlan(orgId, planId, sku?.periodDays)` (248) → PAYMENT_OK.
**Webhook trace:** `POST /billing/webhook` (raw body, index.ts:191-195; verify at routes.ts:270) → `payment.captured` → `findFirst` → `!=CAPTURED` guard → `update` + `activatePlan` (293-313) → PAYMENT_OK; `payment.failed` → FAILED + PAYMENT_FAIL (319-332).
**Usage trace:** daily poll (`workers/index.ts:888-896`, `usage.service.ts:26`) → `ConversationCharge` USD→INR (62) → `getOrgUsage` 30d (213-269, `take:1000` cap) → `estimateCampaignCost` (281).

| # | Sev | Issue | File:line |
|---|---|---|---|
| B1 | 🔴 | **Webhook race → double `activatePlan`** — non-transactional `findFirst`+`update`; no event-id dedup. Two concurrent `payment.captured` deliveries both pass the `!=CAPTURED` guard → `activatePlan` twice → expiry extended twice. | routes.ts:293-313 |
| B2 | 🟠 | **`skuForPaymentOrder` amount-matching** — no `skuId` column on `PaymentOrder`; repricing via dynamic `BILLING_CONFIG` silently breaks historical resolution. | routes.ts:52-54,85,237,300; schema.prisma:546-556 |
| B3 | 🟠 | `activatePlan` defaults to **30-day** expiry when `skuForPaymentOrder` returns undefined → yearly orders effectively buy a month. | razorpay.service.ts:106-108 |
| B4 | 🟠 | `refreshBillingConfig` mutates live in-memory `PLAN_TIERS`/`BILLING_SKUS` exports with no schema validation; uses `console.error` not the logger. | config.ts:4-22; index.ts:372; platform/settings.ts:51 |
| B5 | 🟡 | `isCommercial` counts trial as commercial; `getOrgUsage` `take:1000` undercount; `USD_TO_INR=83` hardcoded (stale ~5%/yr); test/doc rate staleness (₹0.35 vs 0.3). | useEntitlements.ts:102; usage.service.ts:7,62,226; routes.ts — note: `docs/billing/08` self-flags |
| B6 | 🟡 | 402 paywall wired on **client app only** (no admin-app equivalent); `PATCH /plan` legacy free-downgrade still reachable. | client api.ts:130-141, Layout.tsx:57; routes.ts:341-372 |
| B7 | 🟢 | Deprecated `getPlan`/`BILLING_PLANS` still referenced by `PATCH /plan`. | plans.ts:305-352; routes.ts:8,357 |

### 3.4 Auth / onboarding / platform-admin

**Tenant auth (verified, mostly hardened — stale audit claims corrected):**
- `sessionStorage` for live JWTs (tab-isolated) ✅ — audit's "localStorage" claim is stale. authStorage.ts:65-77.
- Refresh-token rotation + **family-reuse detection** (reuse of a revoked token revokes all user sessions) ✅. auth/session.ts:46-82.
- JWT alg pinned `HS256`, password complexity enforcement ✅. utils/jwt.ts:5-6; password-policy.ts:17-34.
- `server/.env.example` copies to `.env` via `setup.sh` — **contains live-looking secrets** (see §4).

| # | Sev | Issue | File:line |
|---|---|---|---|
| AU1 | 🔴 | **Email verification = theater** — register sets `emailVerifiedAt=new Date()` and signs in immediately; verify endpoints are dead in practice. | routes.ts:78, 110, 132, 183, 434-435 |
| AU2 | 🔴 | **Tenant TOTP secret stored plaintext** at rest (platform encrypts theirs). | team/routes.ts:831 (vs platform/mfa-enrollment.ts:37) |
| AU3 | 🟡 | CSP `scriptSrc` includes `'unsafe-inline'` (XSS blast radius alongside sessionStorage JWTs). | index.ts:139 |
| AU4 | 🟡 | Billing demo-grade (Razorpay `rzp_test_*`, no recurring metering surfaced). | razorpay.service.ts; SAMYOJ-35 |
| AU5 | 🟡 | `PATCH /plan` legacy free-downgrade still reachable; refresh-token reuse race has no row lock (mitigated by family-reuse detection, not prevention). | routes.ts:341-372; auth/session.ts:46-82 |
| AU6 | 🟢 | Dead `OnboardingPage.tsx` (route redirects to `/`); stale audit AI-stack claims; platform↔tenant state correctly separated (zero shared state). | OnboardingPage.tsx:41; App.tsx:69-70,39 |

### 3.5 Campaigns / automation / flows

> **Correction:** The campaign/broadcast engine is **well-engineered** — the "no idempotency / no quota reservation" findings from the first explore pass were about the **inbox** path (M2/M3), not campaigns. Campaigns have: claimToken leases, `providerCallStartedAt` provider boundary, `consentSnapshot` at the boundary, AMBIGUOUS handling, runVersion fences, `FOR UPDATE` quota locks, and `finalizeCampaignIfDone`.

**Broadcast path:** `campaigns/service.ts:924-951` → batch recipients (reset PENDING counters, 409 on mismatch) → `broadcastQueue.add('send-broadcast-batch', {jobId deterministic}, {delay: batchIndex*batchDelayMs})`. Worker (workers/index.ts:229-733) runs full safety. Quotas (quota.ts:97-126, 184-243) use `FOR UPDATE`.

**Flow path:** `withConversationLock` (flows/lock) + `FLOW_LOCK_BUSY` (engine.ts:1464) + inbound-lock retry via `flowQueue` 'retry-inbound' (engine.ts:438-457, `inboundLockRetryJobId`).

| # | Sev | Issue | File:line |
|---|---|---|---|
| C1 | 🟠 | **Automation/AI reply double-send on BullMQ retry** — `sendAutomationReply` (engine.ts:154) has no idempotency; `message.create` has no unique constraint (166); no Meta idempotency key; static keyword/welcome replies (engine.ts:531) are not conversation-locked → webhook retry can double-fire. | engine.ts:166, 184, 387, 531; send.service.ts:187 |
| C2 | 🟡 | `sendRecipients.length` mismatch throws 409 mid-enqueue window (service.ts:903-928, 921-922). (Mitigated by the deterministic jobId + BullMQ dedup, but the reset-vs-enqueue window is non-atomic.) | service.ts:903-928 |
| C3 | 🟢 | Flow locking appears correctly handled. | flows/engine.ts:9, 1464; engine.ts:438-462 |

---

## 4. Critical security issues (committed secrets)

These are live-looking credentials checked into git history on a public repo (`teamwebstarts-cmyk/Samyoj`). **Treat as compromised; rotate on every vendor portal.**

| File | Leak type | Sample |
|---|---|---|
| `server/.env.example` | Real-ish service secrets (copied to `.env` by setup.sh) | `META_APP_SECRET`, `NGROK_AUTHTOKEN`, `AZURE_OPENAI_API_KEY`, `SARVAM_API_KEY`, `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`, `ENCRYPTION_KEY` |
| `list-models.js` / `test-api.js` | Identical Baseten API key | `OydSnrVw.VStevZNG6k0B7UVsAJrVfuJyRKFb0wlx` |
| `chatLanguageModels.json` | Two plaintext "Custom Endpoint" keys + ephemeral cloudflare URLs | `user_25kWvj1a6UYodUrff…` |

**Rotate:** Meta App Secret, Azure OpenAI key, Sarvam API key, Razorpay (test) key+secret+webhook secret, ngrok authtoken.

---

## 5. Stale docs / hygiene issues

- `README.md`: ports `5000/5173` (actual `8000/3000/3001`); instructs `npm run db:push` (schema push, bypasses number-isolation preflight — use `db:migrate-startup-safe`); says "PM2 for API + workers" and `npm run dev:worker` (now exits); diagram claims outbound goes "Message Queue → Worker".
- `docs/audit/`: AI-stack section predates the Sarvam migration ("Azure = brain", "Deepgram STT").
- Root clutter: `Untitled` (tracked file = `"image.png"`), `install.cmd` (installs unrelated "Antigravity CLI"), ad-hoc `restart_server.py`/`fix_cors.sh`/`update_webhook.sh`/`start_samyoj.sh`; `ui design ` (trailing space in dir name), typo asset `loiginn.png`.
- `client/dist/`, `client/tsconfig.tsbuildinfo`, `client/.env` are tracked (`.gitignore` does not cover them).
- No `master` branch; de-facto trunk is `phase-4` ← phase-3 (`64f8448`).

---

## 6. Priority-ordered roadmap (with file:line targets)

### P0 — Immediate (blockers)
1. **Rotate all committed secrets** — redact `.env.example` to placeholders; purge history; rotate on vendor portals. → `server/.env.example`, `list-models.js`, `test-api.js`, `chatLanguageModels.json`
2. **Kill double-send (inbox + automation)** — add client `Idempotency-Key` + server-side dedup, or route sends through the queue; remove orphaned `message-queue` worker. → `inbox/routes.ts:1558`, `engine.ts:166/184`, `workers/index.ts:163-226`, `send.service.ts`
3. **Billing webhook race + SKU storage** — add `skuId`+`cadence` to `PaymentOrder`, resolve by id, wrap captured handler in `$transaction`. → `schema.prisma:546`, `routes.ts:152-176, 224-313`, `razorpay.service.ts:106-108`

### P1 — High
4. **Voice STT language → `'auto'`** and remove the `'auto'`-strip. → `bot.service.ts:150`, `settings.service.ts:109-112`
5. **Handoff availability check before promising connection.** → `ai-voice-agent.ts:716`, `engine.ts:387`
6. **TTS speaker adapts to detected language.** → `ai-voice-agent.ts:122, 181`
7. **Drop `frequency_penalty` from Sarvam payloads; add Azure streaming fallback.** → `sarvam-chat.service.ts:165,251`, `chat-completion.service.ts:91-92`

### P2 — Medium
8. **Campaign/automation reply idempotency** (deduplicate on BullMQ retry). → `engine.ts:154-231`
9. **Tenant TOTP encryption at rest**; fix CSP `'unsafe-inline'`; remove dead `OnboardingPage.tsx` + `deepgramLanguage`. → `team/routes.ts:831`, `index.ts:139`, `OnboardingPage.tsx`
10. **Docs hygiene** — correct README ports/quickstart/worker docs; refresh stale audit AI-stack section. → `README.md`, `docs/audit/`

---

## 7. POC plans (concrete, ready to execute)

### POC A — Entitlements wiring migration (in-progress WIP on this branch)
*Goal: wire the orphaned `useEntitlements` to the server source of truth `GET /billing/current`.*

- **Already done:** server `GET /billing/current` (`routes.ts` `/current`, back by `getOrgEntitlements`); client `billingApi.current()` (`client/src/services/api.ts:683`).
- **Step 1:** `client/src/hooks/useEntitlements.ts` — switch `billingApi.get()` → `billingApi.current()`; align `Entitlements` shape with server `getOrgEntitlements` output (`entitlements.quotas.*`, `isLocked`). Fix `isCommercial` (trial should be non-commercial per `docs/billing/02`).
- **Step 2:** Mount hook behind one nav gate — `AiBotPage`/`CallsPage` (both gated behind `pro`). Hide nav items + upsell badges.
- **Step 3:** Keep the existing 402 paywall event flow (`api.ts:130-141`, `Layout.tsx:57-69`); make the client hook **proactive** (hide/disable) in addition to the reactive 402.
- **Verify:** `npx tsc --noEmit` (client+server); Vitest billing tests; trial org opens AI Bot → paywall; pro org loads; `hasFeature('aiBots')` false for <pro.
- **Confidence:** 0.92 — server + API client are done; only client wiring remains; zero DB changes.

### POC B — Double-send fix (inbox + automation)
- **Server:** dedup outbound by `(organizationId, conversationId, content, source, triggerType)` with a time window; OR pass Meta `idempotency_key` (Graph API supports it, currently unused — grep = 0).
- **Client:** `Idempotency-Key` header (UUID per send attempt, cached ~60s) so retries dedup server-side.
- **Automation:** `message.create` unique constraint OR dedup by `(conversationId, triggerType, content)`; ensure `processAiChatbotJob` lock release happens only on terminal states.
- **Cleanup:** delete the orphaned `message-queue` worker + its route claim, or actually wire inbox sends through it.
- **Verify:** double-click send in Inbox → 1 message; BullMQ job fail-after-send-then-retry → 1 message; campaign batch → no dup.
- **Confidence:** 0.85.

### POC C — Secrets rotation + purge
- **Redact** `.env.example`, `list-models.js`, `test-api.js`, `chatLanguageModels.json` to placeholders.
- **`git filter-repo` (or `filter-branch`) BFG** purge of the committed secrets from history.
- **Rotate** on each vendor portal (Meta, Azure, Sarvam, Razorpay, ngrok, Baseten).
- **Verify:** `git grep` for the old key prefixes returns nothing; `setup.sh` regenerates secrets.
- **Confidence:** 0.95 (mechanical).

---

## 8. Testing checklist (post-fix)
- [ ] `npx tsc --noEmit` clean in `client/` AND `server/`
- [ ] `cd server && npx vitest run` green (billing, auth/session, webhook.processor, automation, safety)
- [ ] Double-click send in Inbox → exactly 1 message row + 1 Meta send
- [ ] Trial org → AI Bot/Calls → `UnlockGrowthModal`; Pro org → page loads
- [ ] `POST /billing/webhook` with duplicate `payment.captured` → exactly 1 `activatePlan`
- [ ] Inbound call webhook → `terminate`/`dtmf` processed exactly once
- [ ] STT lang `auto` → caller-switching-language caller gets matching TTS speaker
- [ ] Handoff from no-agent-online caller → graceful fallback (no false promise)
- [ ] `npm run db:migrate-startup-safe` passes preflight; `db:validate-migration-chain` clean
- [ ] `setup.sh` → `.env` regenerated with placeholder secrets (no real keys)

---

## 9. Multi-perspective self-assessment

| Reviewer | Score | Rationale |
|---|---|---|
| Code reviewer | 7/10 | Hardened campaign/quota/automation-lock code; but sync outbound sends, orphaned worker, recurring double-send risks |
| Architect | 6/10 | Solid queue/embedding/skill layering; two AI brains (chat vs Help Center); STT hardcoded lang; outbound not queued |
| Security auditor | 5/10 | Committed live secrets, plaintext TOTP, email-ver-verify theater, CSP `unsafe-inline` |
| UX designer | 6/10 | Voice language/speaker mismatch + early-TTS wrong facts + duplicate bot replies degrade UX; glassmorphism shell is strong |
| Product manager | 6/10 | Demo billing, dead onboarding, orphaned entitlement hook blocks proactive gating |

---

## 10. Appendix — reference map

**Branch / baseline:** `phase-4` ← `phase-3` (`64f8448`); no `master`. Uncommitted WIP: `client/src/hooks/useEntitlements.ts` + `server/src/modules/billing/routes.ts`.

**Ports:** client 3000, admin 3001, API 8000, Postgres 5432, Redis 6379. (README wrongly says 5173/5000.)

**Safe migration (do NOT use `db:push` raw):** `npm run db:migrate-startup-safe` (start.sh) | `db:migrate-safe` | preflight `db:validate-migration-chain` + `db:preflight-number-isolation` | backup `db:backup` / restore `db:restore`.

**Tunnel:** ngrok (via `scripts/dev-tunnel.sh`); writes `META_WEBHOOK_URL` into `.env`. Never Cloudflare.

**Key entry points:** `server/src/index.ts` (app wiring, 34 route mounts, embedded worker start, self-cleanup), `config/index.ts` + `validate.ts` (env + fail-fast prod validation), `server/src/workers/index.ts` (embedded workers), `server/src/modules/billing/routes.ts` (billing surface), `server/src/modules/whatsapp/routes.ts` (webhook ingress), `server/src/modules/inbox/routes.ts` (send path).

---

*Generated by deep E2E scenario tracing. Each `file:line` reference verified against the working tree. Stale-audit contradictions are called out inline rather than re-reported as fact.*

---

## 11. Second-pass findings (blind-spot sweep)

A completeness re-check after the first write-up. Four gaps the initial trace skimmed or that the explore agents surfaced without line-level proof. All verified by reading the working tree.

### 11.1 Integrations webhook dispatch — disable-by-failure race (HIGH)
Customer/integration webhooks (`/api/integrations` → `webhookDispatchQueue`) auto-disable an endpoint after 10 consecutive failures. But `executeWebhookDelivery` reads `delivery.endpoint.failureCount` (line 93) and writes `failureCount: newFailureCount` (108) **without a lock**; the `webhookDispatchWorker` runs at `concurrency: 5`. Five concurrent deliveries to the same endpoint can read the same `failureCount`, each compute `failureCount+1`, and clobber one another → the 10th-failure threshold undercounts → a perpetually-failing endpoint is **not** auto-disabled as soon as it should be (and successful deliveries reset `failureCount: 0` with the same lost-update hazard). The `webhookDelivery.attempts` counter is incremented correctly, but the **endpoint-level disable decision** is racy.
- File:line: `modules/integrations/dispatch.ts:93-112` (both success reset at 82-86 and failure increment at 108 are non-atomic reads).
- Verify: `prisma.webhookEndpoint.update` on `failureCount` has no `where` on a stale counter; no `FOR UPDATE` / conditional decrement.
- Remed: single-flight the disable check via a DB atomic (`failureCount: { increment: 1 }` and check `>= 10` in one statement), or a Redis lock per `endpointId`.

Also: `dispatchOrgWebhook` creates the `webhookDelivery` row (line 27) then enqueues the job (line 37). If `webhookDispatchQueue.add` throws after the row is created, that delivery is **orphaned PENDING forever** (no compaction/cleanup job).

### 11.2 `retryQueue` + `notificationQueue` are dead definitions (LOW)
Defined at `config/queues.ts:20-21` but never enqueued to and never consumed (grep: zero `.add` / zero `new Worker('retry-queue'…` / zero `new Worker('notification-queue'…)`). Matches audit C9. Low risk (idle queues) but misleading — implies retry/notification features that don't exist.
- Remed: delete both definitions (and the imports), or implement.

### 11.3 Compliance (GDPR) purge has data-integrity + completeness gaps (HIGH)
`processCompliancePurge` (`workers/compliance-purge.processor.ts:6-54`):
- **No transaction** across the whole purge — a worker crash mid-loop leaves the org in a half-purged state (some contacts anonymized, conversations still OPEN). GDPR state is non-atomic.
- **N+1 loop** — `for (contact)` doing a `message.updateMany` + `contact.update` per contact. Pathological at scale and holds no lock, so a concurrent inbound webhook can write into a contact being "deleted."
- **`metadata: {}` destroys the audit trail** — `message.updateMany({ data: { content:'[deleted]', metadata: {} } })` (line 17) nukes ALL metadata (consentSnapshot, replyToMetaId, source, template info) rather than redacting structured PII.
- **Incomplete "right to be forgotten"** — only `contact` + `message.content` + `conversation.status` are touched. `internal_notes`, `leads`, `tickets` (customer-chat), `knowledge_base_items`, `ai_usage_logs`, `auditLog`, `outreach_logs`, `product_events`, `platform_audit_logs`, media files on disk/S3 are **not** purged.
- No test for the purge path (only `compliance/opt-out.test.ts` exists).
- Note: this is **anonymization, not hard delete** (`phone: deleted-{id.slice(0,8)}`, conversations CLOSED not removed). That may be intentional for billing/audit retention — but it's undocumented and inconsistent with "GDPR compliance purge" naming.
- Remed: wrap in a transaction (or chunked tx with a status column + resume), batch by `contact.updateMany`, redact metadata fields selectively, enumerate and purge every PII-bearing table, add tests.

### 11.4 Content Studio credit ledger overspend race (HIGH)
`cost-guard.ts` separates the budget check from the usage recording:
- `assertBudget` (line 85): `ledger = await getOrCreateLedger(...)` then `projected = ledger.usedUnits + n`; throws 429 if `projected > hardLimit`.
- `recordUsage` (line 111): `getOrCreateLedger` again, then `prisma.generationCreditLedger.update({ data: { usedUnits: { increment } } })`.
These are **two non-transactional, non-atomic call sites**. Two (or N) concurrent generation requests for the same org/kind both pass `assertBudget` against the same pre-increment `usedUnits`, then both `recordUsage` → **total `usedUnits` exceeds the plan `hardLimit`** → overspend (real money) on image/video/voice generation. There is no `canAffordAndConsume` atomic check-and-decrement.
Compounding: `PLAN_LIMITS` (line 8) is a **hardcoded constant** while the rest of billing is dynamic-config-driven (`refreshBillingConfig` mutates `PLAN_TIERS`/`BILLING_SKUS`). So content-studio limits can drift from the plan catalog. And there are **no tests** for content-studio at all (see §11.5).
- File:line: `modules/content-studio/shared/cost-guard.ts:8-83` (PLAN_LIMITS), `:85-109` (assertBudget), `:111-123` (recordUsage, no guard).
- Remed: single atomic `update` with a `where usedUnits + n <= hardLimit` predicate (Postgres `CHECK`/conditional update), or a `SELECT … FOR UPDATE` inside `prisma.$transaction`.

### 11.5 Test-coverage gap map (verified via `server/src/**/*.test.ts` glob — 129 files)
Modules with **zero** tests:
- `content-studio/**` (images, voices, videos, brand_kits, cost-guard, policy-guard)
- `compliance/**` (only `opt-out.test.ts` — no purge/export test)
- `billing/entitlements.service.ts` ← **the new `GET /billing/current` source of truth has NO test** (high risk; billing correctness)
- `wa-forms/**`, `catalog/**`, `commerce/**` (orders), `leads/**`, `tickets/**` (customer-chat), `canned-replies/**`, `labels/**`, `internal-notes/**`, `wa-forms/**`
Strong coverage exists for `whatsapp/`, `platform/`, `flows/`, `automation/`, `campaigns/` (safety/service/worker-safety), `contacts/`, `calling/` (except `webrtc-bridge.ts`/`sarvam.stt.ts`/`ai-voice-agent.ts`), `media/`, `billing/` (except `entitlements.service.ts`).

### 11.6 Correction to §3.1 M2 / A2 (inbound dedup is actually handled)
The first pass flagged that inbound message/status dedup "relies on the unique constraint, no in-flight claim." Re-reading the worker **refutes the active-bug reading**: `webhook.processor.ts:271-306` catches `P2002` on `message.create`, logs "Duplicate inbound message skipped (Meta retry)", re-repairs conversation `lastMessageAt`/`sla` side-effects if needed, and `continue`s — so a **Meta-retried webhook does NOT re-trigger the automation funnel**. Inbound dedup is correct.
Consequence for §3.2 **C1 (automation double-send)**: the real vector is **automation-queue job BullMQ retries** (`queueAiBotProcessing` enqueues with `attempts: 3`, engine.ts:257-262; `attempt: 4` for webhook-queue), not inbound webhook re-delivery. The handoff-after-send window (`engine.ts:387→390`) and the lack of an `isWithin24HourWindow`/content dedup on `sendAutomationReply` remain the real root causes. Updating C1 text accordingly. Status ticks are similarly guarded by `unmatched_provider_statuses @@unique[organizationId,metaMessageId,status,eventAt]` (schema.prisma:1439).

### Summary of additions
| # | Sev | New finding | File:line |
|---|---|---|---|
| SP1 | 🟠 | Integrations webhook `failureCount` disable-check race under concurrency; orphaned-PENDING on enqueue failure | modules/integrations/dispatch.ts:27, 82-86, 93-112 |
| SP2 | 🟢 | `retryQueue`/`notificationQueue` defined, never consumed | config/queues.ts:20-21 |
| SP3 | 🔴 | Compliance purge: no transaction, N+1, `metadata:{}` audit-trail wipe, incomplete table coverage, untested | workers/compliance-purge.processor.ts:6-54 |
| SP4 | 🔴 | Content-studio credit overspend race (check-then-act); `PLAN_LIMITS` hardcoded vs dynamic billing; no tests | modules/content-studio/shared/cost-guard.ts:8,85-123 |
| SP5 | 🟡 | Test gap: `billing/entitlements.service.ts` (source of truth) + `content-studio` + `compliance` (purge) + `wa-forms/catalog/commerce/leads/tickets` | various |

### Updated priority (add to §6)
- **P0-add:** Content-studio overspend race (SP4) — monetized usage.
- **P1-add:** Compliance purge atomicity + completeness (SP3) — GDPR risk; Integrations webhook disable race (SP1).
- **P2-add:** Wire/remove dead `retry`/`notification` queues; seed tests for `entitlements.service.ts`, content-studio, compliance purge.

> Confidence on the full set: **0.90** now — the second pass closed the biggest structural uncertainties (inbound dedup correctness, campaign engine strength, orphaned-queue truth). Remaining uncertainty is limited to exact race window sizes (SP1/SP4 timing) and intended GDPR semantics (anonymize-vs-delete in SP3), which are design calls, not confirmed bugs.
