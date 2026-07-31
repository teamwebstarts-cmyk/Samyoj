# Features 6-10 — Deep Security & Architecture Review

> Reviewed: 2026-07-31  
> Features: WhatsApp Connection, Inbox & Messaging, Automations, Flow Builder, AI Bot  
> Method: Code review + Web research (Meta docs, Azure OpenAI docs, OWASP, RFCs)  
> Reviewers: 5 parallel subagents with senior engineer persona

---

## Overall Scores

| Feature | Score | Verdict |
|---------|-------|---------|
| WhatsApp Connection | 5.0/10 | Needs work before production |
| Inbox & Messaging | 7.7/10 | Good, needs retry logic |
| Automations | 6.1/10 | Solid foundation, needs hardening |
| Flow Builder | 6.1/10 | Good engine, needs cycle detection |
| AI Bot | 6.2/10 | Good foundation, needs RAG + retry fixes |
| **Average** | **6.0/10** | **Moderate — production possible with fixes** |

---

## FEATURE 6: WHATSAPP CONNECTION (Meta Embedded Signup + Webhooks)

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| Embedded Signup flow | 3/10 | Uses deprecated v2/v3 — breaks Oct 15, 2026 |
| Webhook verification | 6/10 | Signature verification fragile |
| Webhook processing | 7/10 | Good event handling |
| Message sending | 7/10 | Correct API, no retry logic |
| Token management | 2/10 | Access token exposed in frontend JWT |
| Multi-number support | 8/10 | Good isolation |
| Error handling | 4/10 | No exponential backoff on rate limits |
| Security | 3/10 | Multiple issues |
| **Overall** | **5.0/10** | |

### Bugs Found

**BUG-1: OAuth Flow Uses Deprecated v2/v3 (CRITICAL)**
Meta is deprecating Embedded Signup v2/v3 on **October 15, 2026**. The code uses `/dialog/oauth` server-side redirect, but Meta v4 requires the JavaScript SDK with `config_id`.

**BUG-2: Access Token in Frontend JWT (CRITICAL)**
The `pendingToken` mechanism embeds the Meta access token in a JWT sent to the browser (readable via base64 decoding). Access tokens should stay server-side.

**BUG-3: Webhook Signature Verification Fragile (HIGH)**
Falls back to `JSON.stringify(payload)` if `req.rawBody` is undefined, which may not match the original bytes Meta signed.

**BUG-4: No Token Refresh Logic (HIGH)**
Long-lived tokens eventually expire. No refresh mechanism exists.

**BUG-5: No Rate Limit Error Handling (MEDIUM)**
Meta API returns specific rate limit error codes (130429, 131056, 4). No exponential backoff retry.

### Security Issues

1. Webhook signatures skipped in non-production environments
2. No per-number webhook secret (field exists in schema but never populated)
3. Same JWT secret used for OAuth state and user auth
4. Access token stored in frontend-accessible JWT

### Web Research Comparison

| Aspect | Samyoj | Meta Docs (2026) | Gap |
|--------|--------|------------------|-----|
| Embedded Signup | v2/v3 (deprecated) | v4 (JS SDK) | CRITICAL — breaks Oct 2026 |
| Token storage | Frontend JWT | Server-side + encrypt | CRITICAL |
| Webhook verification | Fragile | `express.raw()` body | HIGH |
| Token refresh | None | Long-lived → refresh | HIGH |
| Rate limit retry | None | Exponential backoff | HIGH |

### Recommendations (Priority)

1. **[P0] Migrate to Embedded Signup v4** before October 2026
2. **[P0] Store access tokens server-side** (Redis) instead of frontend JWTs
3. **[P0] Add exponential backoff** for rate limit errors (130429, 131056, 4)
4. **[P1] Fix webhook signature verification** with `express.raw()` body parser
5. **[P1] Add token refresh logic** for long-lived tokens
6. **[P2] Add per-number webhook secret** and verify in webhook processor

---

## FEATURE 7: INBOX & MESSAGING

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| 3-Panel Layout | 8/10 | Good UX, responsive |
| Real-time Messaging | 7/10 | Socket.IO works, race conditions |
| Message Sending | 7/10 | All types, no retry logic |
| Service Window (24h) | 9/10 | Correctly calculated |
| Conversation Mgmt | 8/10 | Assignment, labels, snooze |
| Media Handling | 7/10 | Upload works, no scanning |
| Error Handling | 5/10 | No retry on Meta API errors |
| **Overall** | **7.7/10** | |

### Bugs Found

**BUG-1: No Retry Logic for Failed Messages (CRITICAL)**
Production systems need exponential backoff for Meta API rate limits (429). Currently fails silently.

**BUG-2: Service Window Race Condition (HIGH)**
Concurrent requests could compute different window times.

**BUG-3: Message Duplication (HIGH)**
Socket events + API responses could duplicate messages in UI.

**BUG-4: Media Path Traversal (MEDIUM)**
Media download path not fully validated.

### Pros

1. Service window (24h) correctly implemented
2. Interactive messages (buttons, lists, CTA) fully supported
3. 3-panel layout is intuitive
4. Template messages work
5. Media upload/download flow correct
6. Conversation management (assignment, labels, notes) complete

### Cons

1. No retry logic for failed messages
2. No optimistic UI updates
3. Socket.IO race conditions on rapid messages
4. No typing indicator
5. Poor error messages to user
6. No message search

### Recommendations

1. **[P0] Add retry logic** with exponential backoff for Meta API calls
2. **[P1] Fix service window race condition** (add DB-level locking)
3. **[P1] Fix message deduplication** (track `metaMessageId` in UI)
4. **[P2] Add optimistic UI** for message sending
5. **[P2] Add typing indicator** for bot/agent typing
6. **[P2] Add message search** (full-text search in conversation)

---

## FEATURE 8: AUTOMATIONS

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| Engine Design | 6/10 | Good structure, race conditions |
| Trigger Types | 8/10 | All 6 types work |
| Conflict Detection | 4/10 | Basic, misses several types |
| Analytics | 5/10 | Hard-capped at 5000 |
| Frontend UX | 9/10 | Excellent UI |
| Missing Features | 5/10 | No time-based, no frequency cap |
| **Overall** | **6.1/10** | |

### Bugs Found

**BUG-1: Dead Code in Engine (CRITICAL)**
Some trigger types have code paths that never execute.

**BUG-2: Race Condition on Concurrent Triggers (HIGH)**
Multiple automations matching same message could execute simultaneously.

**BUG-3: Analytics Hard-Capped at 5000 (MEDIUM)**
`prisma.automationLog.findMany({ take: 5000 })` — not paginated.

**BUG-4: Keyword Matching Too Simple (MEDIUM)**
Exact match only, no regex support, no case-insensitive option.

### Missing Conflict Detections

1. Two automations with same keyword trigger
2. Welcome + keyword on first message
3. Away + business hours overlap
4. Multiple AI chatbot automations

### Pros

1. Clean engine design with trigger → action pattern
2. All 6 trigger types implemented
3. Conflict detection UI (basic)
4. Analytics dashboard
5. Excellent frontend UX

### Cons

1. No retry logic for failed actions
2. No time-based triggers (specific time of day)
3. No frequency capping (automation can fire every message)
4. No webhook action (trigger external URL)
5. No Slack/email notification action
6. Analytics not paginated

### Recommendations

1. **[P0] Fix race condition** in automation engine (add DB-level locking)
2. **[P1] Improve conflict detection** (add all 4 missing types)
3. **[P1] Remove analytics hard cap** (add pagination)
4. **[P1] Add regex support** for keyword triggers
5. **[P2] Add time-based triggers**
6. **[P2] Add frequency capping** (max N times per conversation)
7. **[P2] Add webhook action** (call external URL)
8. **[P2] Add notification actions** (Slack, email)

---

## FEATURE 9: FLOW BUILDER

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| Engine Design | 6/10 | State machine, no cycle detection |
| Node Types | 9/10 | 26/26 implemented |
| Validation | 4.5/10 | No cycle detection |
| Versioning | 9/10 | Draft/publish, restore |
| Simulation | 7/10 | Server-side, not fully accurate |
| Frontend (React Flow) | 7/10 | Good, no undo/redo |
| **Overall** | **6.1/10** | |

### Bugs Found

**BUG-1: No Cycle Detection in Validation (CRITICAL)**
Users can create infinite loops. Validation only checks reachability from start, not cycles.

**BUG-2: `goto_flow` Doesn't Return (HIGH)**
When Flow A calls Flow B, Flow B runs to completion and never returns to Flow A. No flow stack.

**BUG-3: Condition Node Case Inconsistency (MEDIUM)**
`variable_equals` is case-sensitive, `variable_contains` is case-insensitive. Confusing.

**BUG-4: Frontend Re-renders Entire Graph (MEDIUM)**
`FlowCanvas` re-renders on every node position change.

**BUG-5: Webhook Node No Retry (MEDIUM)**
Single attempt, fails silently.

### Node Type Implementation Status

| # | Node Type | In Engine | In UI | Status |
|---|-----------|-----------|-------|--------|
| 1 | `message` | ✅ | ✅ | Complete |
| 2 | `buttons` | ✅ | ✅ | Complete |
| 3 | `list` | ✅ | ✅ | Complete |
| 4 | `question` | ✅ | ✅ | Complete |
| 5 | `tag` | ✅ | ✅ | Complete |
| 6 | `remove_tag` | ✅ | ✅ | Complete |
| 7 | `handoff` | ✅ | ✅ | Complete |
| 8 | `ai` | ✅ | ✅ | Complete |
| 9 | `assign` | ✅ | ✅ | Complete |
| 10 | `condition` | ✅ | ✅ | Complete |
| 11 | `end` | ✅ | ✅ | Complete |
| 12 | `template` | ✅ | ✅ | Complete |
| 13 | `delay` | ✅ | ✅ | Complete |
| 14 | `schedule` | ✅ | ✅ | Complete |
| 15 | `media` | ✅ | ✅ | Complete |
| 16 | `webhook` | ✅ | ✅ | Partial (no retry) |
| 17 | `ab_split` | ✅ | ✅ | Complete |
| 18 | `language` | ✅ | ✅ | Complete |
| 19 | `set_variable` | ✅ | ✅ | Complete |
| 20 | `goto_flow` | ✅ | ✅ | Partial (no return) |
| 21 | `goto_step` | ✅ | ✅ | Complete |
| 22 | `request_callback` | ✅ | ✅ | Complete |
| 23 | `location` | ✅ | ✅ | Complete |
| 24 | `contact_card` | ✅ | ✅ | Complete |
| 25 | `wa_flow` | ✅ | ✅ | Complete |
| 26 | `condition` (webhook_ok) | ✅ | ⚠️ | Partial |

**26/26 node types exist in engine, ~24/26 fully complete.**

### Pros

1. Excellent node type coverage (26 types)
2. Conversation locking prevents race conditions
3. State persistence in `botState` JSON field
4. Good error handling in engine
5. Handoff keywords work
6. Flow recovery for orphaned button taps
7. Versioning with draft/publish
8. Simulation endpoint
9. Analytics tracking
10. React Flow frontend is clean

### Cons

1. No cycle detection in validation (critical)
2. No max flow depth validation
3. `goto_flow` is one-way (no return stack)
4. Frontend no undo/redo
5. Simulation not fully accurate (no delays, webhooks)
6. Condition node inconsistent case handling
7. Webhook node no retry
8. No flow execution timeout
9. Validation warnings don't prevent saving

### Recommendations

1. **[P0] Add cycle detection** to `validation.ts`
2. **[P0] Add flow execution timeout** (auto-expire stuck flows)
3. **[P0] Add SSRF protection** for webhook nodes
4. **[P1] Add `goto_flow` return stack**
5. **[P1] Add regex escape** in `updateContactField` (ReDoS prevention)
6. **[P1] Add flow execution rate limiting**
7. **[P2] Add undo/redo** to FlowCanvas
8. **[P2] Move flow state to Zustand** store
9. **[P2] Improve simulation accuracy**

---

## FEATURE 10: AI BOT

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| Azure OpenAI Integration | 4/10 | No retry logic |
| RAG Pipeline | 5/10 | No hybrid search, no reranking |
| Knowledge Ingestion | 6/10 | Naive chunking, no SSRF protection |
| Guardrails & Security | 5/10 | Pattern matching only, not enforced |
| Rate Limiting | 4/10 | Race condition, wrong scope |
| Handoff Flow | 8/10 | Good, just not wired up |
| Versioning | 9/10 | Excellent |
| **Overall** | **6.2/10** | |

### Bugs Found

**BUG-1: No Retry Logic on Azure OpenAI Calls (CRITICAL)**
Raw `fetch()` with zero retries. Azure OpenAI returns 429/5xx. Must retry with exponential backoff + jitter.

**BUG-2: Embeddings Service Also No Retry (CRITICAL)**
Same issue. Embedding calls fail silently.

**BUG-3: Rate Limiter Race Condition (HIGH)**
`INCR` + `EXPIRE` not atomic. Two simultaneous requests can cause permanent block.

**BUG-4: Rate Limit Per-Bot, Not Per-User (HIGH)**
Single chatty customer can exhaust quota for entire org.

**BUG-5: RAG Threshold Hardcoded (MEDIUM)**
0.7 arbitrary. Should be adjustable per bot.

**BUG-6: No Reranking in RAG (MEDIUM)**
Single-stage similarity search. No hybrid search (dense + BM25).

**BUG-7: Chunking Strategy Naive (MEDIUM)**
2000 chars ≈ 500 tokens, no overlap, sentence boundary only at `. `.

**BUG-8: Prompt Injection Not Blocked (HIGH)**
`detectPromptInjection` only logs, doesn't block.

**BUG-9: `performHandoff` Never Called (MEDIUM)**
Function exists but never called from `generateBotReply`.

**BUG-10: No SSRF Protection on URL Ingestion (HIGH)**
Can fetch internal URLs (`169.254.169.254`, `localhost`).

**BUG-11: No PDF Size Limit (MEDIUM)**
100MB PDF → out-of-memory.

**BUG-12: `updateMany` for Single Items (LOW)**
Should use `update` which throws on not-found.

### Security Issues

1. **Prompt injection** — system prompt leakage possible, guardrails not enforced
2. **API key decryption** on every request (performance + security)
3. **Cross-org data isolation** — `searchKnowledgeBase` doesn't filter by `organizationId`
4. **SSRF via URL ingestion** — no URL validation
5. **PDF size limit missing** — OOM attack possible
6. **Guardrails too narrow** — only blocks `sk-` API keys
7. **No rate limit on test endpoint**
8. **Conversation history not filtered** — previous injections persist

### Pros

1. Versioning system excellent (full snapshot, audit, restore)
2. Handoff flow well-designed (keyword, low confidence, blocked content)
3. Lock mechanism prevents concurrent processing
4. Frontend UX polished
5. Token quota tracking per org
6. Graceful degradation (RAG → keyword search)
7. Business hours support
8. `performHandoff` correctly assigns agents

### Cons

1. No retry logic on Azure OpenAI calls
2. RAG pipeline basic (no hybrid search, no reranking)
3. Rate limiting broken (race condition) and wrong scope
4. Prompt injection protection weak
5. No SSRF protection on URL ingestion
6. Chunking strategy naive
7. Embeddings in JSON column (not vector DB — won't scale)
8. `performHandoff` not wired up

### Recommendations

1. **[P0] Add retry logic** with exponential backoff + jitter to Azure OpenAI calls
2. **[P0] Fix rate limiter race condition** (use Lua script)
3. **[P0] Wire up `performHandoff`** in `generateBotReply`
4. **[P0] Add SSRF protection** to `fetchUrlText`
5. **[P0] Scope rate limit per conversation** not per org-bot
6. **[P1] Add `organizationId` filter** to `searchKnowledgeBase`
7. **[P1] Replace guardrails** with input isolation (XML delimiters)
8. **[P1] Add PDF size limit**
9. **[P1] Tune chunking** (512 tokens, 15% overlap)
10. **[P1] Add hybrid search** (BM25 + vector)
11. **[P2] Add reranking** with cross-encoder
12. **[P2] Move embeddings to vector DB** (Pinecone, Qdrant, pgvector)

---

## CONSOLIDATED P0 FIXES (Before Production)

| # | Fix | Feature | Effort |
|---|-----|---------|--------|
| 1 | Migrate to Embedded Signup v4 | WhatsApp | 4h |
| 2 | Store Meta tokens server-side | WhatsApp | 2h |
| 3 | Add retry logic to Azure OpenAI | AI Bot | 2h |
| 4 | Fix rate limiter race condition | AI Bot | 1h |
| 5 | Add cycle detection to flow validation | Flow Builder | 2h |
| 6 | Wire up `performHandoff` in AI Bot | AI Bot | 1h |
| 7 | Add SSRF protection (webhooks + URL ingest) | Flow Builder + AI Bot | 2h |
| 8 | Add retry logic to Meta API calls | Inbox | 3h |
| 9 | Fix automation engine race condition | Automations | 2h |
| 10 | Add per-conversation rate limit (AI) | AI Bot | 1h |

---

## CONSOLIDATED P1 FIXES (This Sprint)

| # | Fix | Feature | Effort |
|---|-----|---------|--------|
| 11 | Add exponential backoff for Meta rate limits | WhatsApp | 2h |
| 12 | Fix webhook signature verification | WhatsApp | 1h |
| 13 | Fix message deduplication in inbox | Inbox | 2h |
| 14 | Improve automation conflict detection | Automations | 3h |
| 15 | Add `goto_flow` return stack | Flow Builder | 4h |
| 16 | Add prompt injection blocking | AI Bot | 3h |
| 17 | Add PDF size limit | AI Bot | 30m |
| 18 | Tune chunking strategy | AI Bot | 2h |
| 19 | Add hybrid search to RAG | AI Bot | 4h |
| 20 | Add regex support to keyword triggers | Automations | 2h |

---

## WEB RESEARCH SOURCES

| Source | URL | Key Finding |
|--------|-----|-------------|
| Meta Embedded Signup | https://developers.facebook.com/docs/whatsapp/embedded-signup | v4 required by Oct 2026 |
| Meta Webhooks | https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks | `express.raw()` for signature |
| Meta Rate Limits | https://developers.facebook.com/docs/whatsapp/cloud-api/rate-limits | Error codes 130429, 131056, 4 |
| Azure OpenAI Retry | https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/quota | Exponential backoff required |
| RAG Best Practices 2026 | https://aifoss.dev/blog/rag-architecture-deep-dive-2026 | Hybrid search + reranking |
| OWASP LLM01:2025 | https://genai.owasp.org/llmrisk/llm01-prompt-injection | Input isolation, not sanitization |
| React Flow Best Practices | https://reactflow.dev/learn | State management, performance |
| ManyChat Flows | https://manychat.com | Competitor feature comparison |
| RFC 9700 | https://tools.ietf.org/html/rfc9700 | Refresh token rotation |

---

## SUMMARY

| Feature | Score | Critical Issues |
|---------|-------|----------------|
| Auth (prev) | 3.2/10 | localStorage, no rotation, no brute force |
| WhatsApp Connection | 5.0/10 | Deprecated OAuth, token exposure |
| Inbox & Messaging | 7.7/10 | No retry logic |
| Automations | 6.1/10 | Race condition, missing conflicts |
| Flow Builder | 6.1/10 | No cycle detection |
| AI Bot | 6.2/10 | No retry, no RAG reranking |
| **Average** | **5.7/10** | |

**Auth is the weakest** (3.2/10). **Inbox is the strongest** (7.7/10).

The platform is **functional** and has good architecture in many areas, but needs **~2-3 weeks of focused security + reliability fixes** before production deployment.
