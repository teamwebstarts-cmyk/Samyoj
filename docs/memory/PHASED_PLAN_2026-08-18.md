# Phased Plan — Remaining Work (2026-08-18)

All items from `audit/FULL_REVIEW_2026-08-18.md`, `docs/memory/AUDIT_REMAINING_2026-08-18.md`, and `docs/memory/STATUS_AND_FUTURE.md`. Every claim verified against actual repo.

---

## P1 = Critical (ALREADY DONE — skip)

All P1 items are complete or verified. See `STATUS_AND_FUTURE.md` for the full list.

---

## P2 = High Priority (security, data loss, reliability)

Items here affect security posture, data integrity, or system reliability. Code-only fixes that don't need live testing.

### P2-1. Remove dead AI bot routes — cleanup

**Effort:** S | **Can do now:** Yes | **Jira:** Comment on SAMYOJ-8

| What | Where | Status |
|------|-------|--------|
| `GET /:id/versions` | `ai-bot/routes.ts:344-355` | Dead — no UI caller (flow versions are separate) |
| `GET /:id/audit` | `ai-bot/routes.ts:357-368` | Dead — `AiBotAuditPanel` never imported |
| `POST /:id/restore/:version` | `ai-bot/routes.ts:370-384` | Dead — no UI caller |
| `listBotVersions` | `ai/versioning.service.ts:58-64` | Only used by dead routes |
| `listBotAuditLogs` | `ai/versioning.service.ts:66-72` | Only used by dead routes |
| `restoreBotVersion` | `ai/versioning.service.ts:74-113` | Only used by dead routes |
| `AiBotAuditPanel.tsx` | `client/src/components/ai-bot/AiBotAuditPanel.tsx` | Never imported |
| `aiBotApi.audit()` | `client/src/services/api.ts:459` | Never called |

**NOT dead (keep):** `logBotAudit`, `createBotVersion` — used by active create/update routes. `ingest.service.ts`, `business-context.ts`, `lock.ts` — all actively imported.

### P2-2. Auth middleware tests

**Effort:** M | **Can do now:** Yes | **Jira:** Comment on SAMYOJ-8

| Function | File | Current coverage |
|----------|------|-----------------|
| `authenticate()` | `middleware/auth.ts:16-29` | **0 tests** — JWT Bearer verification |
| `loadOrgRole()` | `middleware/auth.ts:62-86` | **0 tests** — membership + role loading |
| `requireOrgRole()` | `middleware/auth.ts:88-95` | **0 tests** — role gate |
| `requireOrg()` | `middleware/auth.ts:46-60` | 3 tests in `auth.membership.test.ts` |

**Fix:** Add test file covering: valid token, missing header, expired token, malformed token, non-member org access, role gating.

### P2-3. Auth routes integration tests

**Effort:** M | **Can do now:** Yes | **Jira:** Comment on SAMYOJ-8

| Endpoint | File | Current coverage |
|----------|------|-----------------|
| `POST /register` | `auth/routes.ts:58-141` | **0 tests** |
| `POST /login` | `auth/routes.ts:143-243` | **0 tests** |
| `POST /refresh` | `auth/routes.ts:245-265` | **0 tests** |
| `POST /logout` | `auth/routes.ts:311-320` | **0 tests** |
| `POST /forgot-password` | `auth/routes.ts:322-351` | **0 tests** |
| `POST /reset-password` | `auth/routes.ts:353-393` | **0 tests** |

**Fix:** Add integration tests with mocked Prisma and Redis. Cover: happy path, duplicate email, rate limiting, invalid credentials, 2FA flow, refresh rotation.

### P2-4. Message sending service tests

**Effort:** M | **Can do now:** Yes | **Jira:** Comment on SAMYOJ-8

| Function | File | Current coverage |
|----------|------|-----------------|
| `recordOutboundInConversation()` | `messages/service.ts:34-135` | **0 tests** |
| `sendDirectMessage()` | `messages/service.ts:137-270` | **0 tests** |
| `deliverOutboundMessage()` | `messages/send.service.ts` | **0 tests** |

**Fix:** Add tests with mocked Prisma, WhatsApp service, and emitToOrg. Cover: phone validation, contact upsert, conversation creation, CSW enforcement, template vs text.

### P2-5. Document Meta token-exchange constraint

**Effort:** S | **Can do now:** Yes | **Jira:** N/A (doc fix)

The `GET /oauth/access_token?client_secret=...` is Meta's API design — POST would be a contract change. Document this in `docs/AUTH_SETUP.md` or `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md`.

### P2-6. Leftover org App Secret one-shot cleanup

**Effort:** S | **Can do now:** Yes | **Jira:** Comment on SAMYOJ-8

`stripLeftoverOrgMetaCredentials` runs lazily on Connect + GET `/meta-config`. Add a startup migration or npm script that strips all orgs' leftover `metaAppId`/`metaAppSecret` in one pass. Low urgency but good hygiene.

---

## P3 = Medium Priority (UX gaps, missing features)

Items here need product decisions, live testing, or are blocked on external dependencies.

### P3-1. HttpOnly cookies for customer auth — SAMYOJ-3

**Effort:** L | **Can do now:** No — needs product pick | **Jira:** [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3)

Cookies are browser-wide (breaks tab-scoped multi-account from SAMYOJ-49). Needs explicit product decision: accept single-session-per-browser or keep sessionStorage and document XSS tradeoff. Platform admin already has HttpOnly cookies — pattern exists.

### P3-2. Email verification theater — SAMYOJ-3 (subset)

**Effort:** M | **Can do now:** No — needs product decision | **Jira:** Part of SAMYOJ-3

`emailVerifiedAt: new Date()` set immediately on register (`routes.ts:78`). Either implement real verification (send link, gate login) or remove the theater. Not blocking test-deploy.

### P3-3. Inbound webhook proof — SAMYOJ-2

**Effort:** S (manual test) | **Can do now:** No — needs live test | **Jira:** [SAMYOJ-2](https://teamwebstarts.atlassian.net/browse/SAMYOJ-2)

Run `bash start.sh` → verify ngrok → send new phone reply → check `totalReceived > 0`. Code is correct; infra proof is missing.

### P3-4. Barge-in live test

**Effort:** S (manual test) | **Can do now:** No — needs live call | **Jira:** N/A

Make one AI call, interrupt mid-sentence. If echo triggers too easily, raise threshold. If user can't interrupt, lower it.

### P3-5. CSW enforcement verification — SAMYOJ-5 (remaining)

**Effort:** S (manual test) | **Can do now:** No — needs verification | **Jira:** [SAMYOJ-5](https://teamwebstarts.atlassian.net/browse/SAMYOJ-5)

Pause is fixed. Verify that non-template outbound messages respect the 24-hour customer service window. Code looks correct (`deliverOutboundMessage` blocks non-TEMPLATE sends).

### P3-6. Billing — SAMYOJ-35

**Effort:** XL | **Can do now:** No — user said don't implement | **Jira:** [SAMYOJ-35](https://teamwebstarts.atlassian.net/browse/SAMYOJ-35)

TARGET spec in `docs/billing/`. Razorpay Subscriptions + GST invoices + dunning. Do not implement unless user asks.

### P3-7. Live voice transfer — SAMYOJ-12

**Effort:** L | **Can do now:** No — WebRTC not ready | **Jira:** [SAMYOJ-12](https://teamwebstarts.atlassian.net/browse/SAMYOJ-12)

Forced `message_only` in settings. Stub `handleLiveTransfer()`. WebRTC media transfer not production-ready.

### P3-8. Phase C automations — SAMYOJ-26

**Effort:** XL | **Can do now:** No — user said don't start | **Jira:** [SAMYOJ-26](https://teamwebstarts.atlassian.net/browse/SAMYOJ-26)

Tickets/SLA, catalog, NL generate-flow, form-builder merge, goto_flow stack, wait-for-media.

### P3-9. SAMYOJ-57 remaining slices

**Effort:** L | **Can do now:** No — user hasn't asked | **Jira:** [SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57)

TARGET billing (35), STT/TTS ledger (56), impersonation, WhatsApp outreach. First release is in code. Do not rebuild A-D.

---

## P4 = Low Priority (polish, nice-to-haves)

### P4-1. Reports page Health score

**Effort:** S | Dashboard Health removed (51). Reports page kept it. Not a new ticket unless asked.

### P4-2. Nested widget skeletons

**Effort:** S | Some nested widgets still show spinner instead of skeleton. Not a product miss.

### P4-3. Speaker outside four voices

**Effort:** S | Calling UI offers Shubh / Ratan / Priya / Ishita only. Other Sarvam speakers not in picker.

### P4-4. Pickup save vs bot Save footer

**Effort:** S | "When they call" pickup can save separately from bot editor Save footer. Honest UX leftover.

### P4-5. Train Ready needs Azure embeddings

**Effort:** S | Vector Ready is Azure-only. No embeddings key → training stays Learning.

---

## Summary

| Phase | Items | Effort | Can do now? |
|-------|-------|--------|-------------|
| P1 | All done | — | — |
| P2 | 6 items | S-M each | **Yes** (code-only) |
| P3 | 9 items | S-XL | No (needs live test / product pick / user approval) |
| P4 | 5 items | S each | Optional polish |

**P2 implementation order:**
1. P2-1: Remove dead AI bot routes + code
2. P2-2: Auth middleware tests
3. P2-3: Auth routes tests
4. P2-4: Message sending tests
5. P2-5: Meta token-exchange docs
6. P2-6: App Secret cleanup script

---

*Plan created 2026-08-18. All code claims verified against actual repo files with exact paths and line numbers.*
