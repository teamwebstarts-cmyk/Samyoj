# Automation & Workflow — Complete Review

**Date:** 2026-08-14  
**Branch reviewed:** `call-ui-improvemnet`  
**Mode:** Research + code audit only. **No application code was changed.**  
**Audience:** Product + engineering, before any polish / bugfix / feature work.

This document is the working brief for making Automations a production-grade WhatsApp CRM surface: what we already built, how it connects, what Meta actually allows, what competitors do, what is broken or misleading, and what to do next after review.

---

## 1. Verdict

Samyoj already has a **real automation stack**, not a mock. The engine can greet, keyword-match, run multi-step conversation trees, delay, hand off, call AI, send templates/media, and attach Meta in-chat forms.

It is **not production-smooth**. Three different products share the word “flow,” `FEATURE_MATRIX.md` marks almost everything DONE (that is overstated), the 24-hour WhatsApp customer service window is barely enforced in the automation path, opt-out is skipped by the flow engine, and there are **no engine/runtime tests**. Demo-working ≠ user-trustworthy.

**Overall: 5/10** — usable for demos and simple inbound trees; unsafe as a “major CRM pillar” until CSW, opt-out, naming, conflict honesty, campaign wiring, and runtime tests are fixed.

---

## 2. Scores (honest, current code)

| Area | Score | Why |
|------|------:|-----|
| Auto-replies (rule layer) | 6/10 | Keyword / welcome / away / hours / lead capture work. `AI_CHATBOT` enum is a ghost. No frequency cap. Keyword is substring, not word-boundary. |
| Conversation flows (tree engine) | 6/10 | Broad node coverage and locking. Delay swallows inbound. No CSW/opt-out. No cycle detection. `waitingFor: media` unused. |
| Meta WhatsApp Forms | 4/10 | Two backends (`wa-forms` vs `flows-assets`). Orphan builder. Promo CTA opens the wrong product. |
| Cross-module connections | 5/10 | Webhook → engine is real. Calling triggers exist. Campaign reply depends on message metadata (worker does write `campaignId`). Tickets unused. |
| Meta policy / 24h window | 4/10 | Inbound replies are in-window by definition. Delay/schedule/missed-call/template nodes can send **after** the window without a template fallback. Flow engine ignores `optedIn`. |
| UX / naming | 5/10 | Default tab is Auto-replies. Save ≈ Publish. “Turn on” vs `enabled: false`. Three “flows.” |
| Tests | 3/10 | Helper unit tests only. Zero `handleInboundFlow` / `handleInboundAutomations` tests. |
| Docs honesty (`FEATURE_MATRIX`) | 3/10 | Automations 8/8 DONE and Flow Builder 13/13 DONE is false. |

---

## 3. What “Automations” actually is (read this first)

The sidebar item **Automations** is an umbrella. Internally there are **three products**:

| User-facing name | What it really is | Storage | Runtime |
|------------------|-------------------|---------|---------|
| **Auto-replies** | One-shot rules | `Automation` + `TriggerType` | `automation/engine.ts` `processRuleAutomations` |
| **Conversation flows** | Multi-step chat trees (Samyoj-owned) | `Flow` + `FlowVersion` + JSON nodes | `flows/engine.ts` |
| **WhatsApp Forms / Meta Form** | Meta-native in-chat screens (not our canvas) | `FlowAsset` **or** `/api/wa-forms` | Meta client + `nfm_reply` / data endpoint |

**Priority on every inbound WhatsApp message:**

```
1. Conversation Flow  (if a published, enabled flow matches or is already waiting)
2. Auto-reply rule    (KEYWORD → WELCOME → LEAD_CAPTURE → AWAY → BUSINESS_HOURS)
3. AI Bot             (queue, 1.5s debounce, only if bots enabled + botActive + not handed off)
```

Evidence: `handleInboundAutomations` in `server/src/modules/automation/engine.ts` (flow first, then static, then `queueAiBotProcessing`).

This is the correct CRM shape (bot/flow before human, AI as last resort). The product UI does **not** explain it that clearly.

---

## 4. Inventory — what we already built

### 4.1 Database

| Model | Role |
|-------|------|
| `Automation` | Rule: `triggerType`, JSON `config`, `enabled` |
| `Flow` | Tree: `triggerType`, `triggerConfig`, `nodes`, `draftNodes`, `status` DRAFT/PUBLISHED, `enabled`, `priority`, `stats` |
| `FlowVersion` | Snapshots for restore |
| `FlowAsset` | Meta Flow JSON + `metaFlowId` / `metaStatus` |
| `AutomationLog` | Run log for both rules and flows. **No FK** to Automation/Flow/Conversation — orphanable |
| `Conversation.botState` | Live flow state machine (JSON) |
| `Conversation.botActive` / `botHandoffAt` / `assignedAgentId` | Gates that stop automation |

Enums:

- `TriggerType`: `KEYWORD`, `WELCOME`, `AWAY`, `BUSINESS_HOURS`, `LEAD_CAPTURE`, `AI_CHATBOT`
- `FlowTriggerType`: `WELCOME`, `KEYWORD`, `ANY_MESSAGE`, `BUSINESS_HOURS`, `OFF_HOURS`, `CONTACT_TAG`, `SEGMENT`, `MISSED_CALL`, `CAMPAIGN_REPLY`, `CALL_COMPLETED` (**11**, not 10)

### 4.2 Backend files (source of truth)

| Path | Job |
|------|-----|
| `server/src/modules/automation/engine.ts` | Inbound pipeline + static rules + AI queue |
| `server/src/modules/automation/routes.ts` | CRUD, analytics, conflicts |
| `server/src/modules/automation/conflicts.ts` | Overlap banner data |
| `server/src/modules/automation/analytics.ts` | Aggregates `AutomationLog` |
| `server/src/modules/flows/engine.ts` | Full tree runtime |
| `server/src/modules/flows/types.ts` | Node / trigger / template definitions |
| `server/src/modules/flows/routes.ts` | CRUD, validate, simulate, versions, schedule |
| `server/src/modules/flows/validation.ts` | Graph checks (reachability; **no cycle detection**) |
| `server/src/modules/flows/simulate.ts` | Dry-run (no WhatsApp send) |
| `server/src/modules/flows-assets/*` | Meta form assets + encrypted data endpoint + NFM webhook |
| `server/src/workers/webhook.processor.ts` | After persist → `handleInboundAutomations` |
| `server/src/workers/index.ts` | `automation-queue` (`ai-chatbot`), `flow-queue` (`resume-flow`, `start-flow`) |
| `server/src/modules/calling/missed-call.service.ts` | `triggerMissedCallFlow` |
| `server/src/modules/calling/call.processor.ts` | `triggerCallCompletedFlow` |

### 4.3 Frontend files

| Path | Job |
|------|-----|
| `client/src/pages/AutomationsPage.tsx` | Hub: Auto-replies / Conversation flows / Performance. **Default tab = `quick`** |
| `client/src/pages/FlowBuilderPage.tsx` | Canvas builder |
| `client/src/pages/MetaFlowBuilder.tsx` | Orphan Meta form editor (`/automations/meta-flows/:id`) |
| `client/src/components/automations/*` | Cards, conflicts, analytics, tips |
| `client/src/components/flows/*` | Canvas, palette, settings, test, preview, versions, WaFormPicker |
| Inbox | Active-flow notice + “View flow”; message dividers for automation/flow source |

### 4.4 Auto-reply triggers — what actually matches

| Trigger | UI can create? | Engine matches? | Notes |
|---------|----------------|-----------------|-------|
| `KEYWORD` | Yes | Yes | `message.toLowerCase().includes(keyword)` — “hi” matches “this”, “shipping” |
| `WELCOME` | Yes | Yes | Only `isNewConversation` |
| `AWAY` | Yes | Yes | Org business hours = false |
| `BUSINESS_HOURS` | Yes | Yes | Dual message: during vs away |
| `LEAD_CAPTURE` | Yes | Yes | Optional keyword; tags contact; optional handoff |
| `AI_CHATBOT` | **No** (sent to AI Bots page) | **No** | Enum + analytics labels exist. AI is the **fallback queue**, not this row type |

Dead local helper: `isBusinessHours(config)` in `automation/engine.ts` uses weekend + **server local hour**. Live path uses org hours (`getOrgBusinessHours`). Misleading leftover.

### 4.5 Conversation-flow triggers — what actually matches inbound

| Trigger | Inbound match? | How |
|---------|----------------|-----|
| `WELCOME` | Yes | New conversation |
| `KEYWORD` | Yes | includes / exact / regex |
| `ANY_MESSAGE` | Yes | Any content **except** new conversations (welcome can still steal first message) |
| `BUSINESS_HOURS` / `OFF_HOURS` | Yes | Org hours + must have content |
| `CONTACT_TAG` / `SEGMENT` | Yes | Tag on contact — **does not require the message to be about the tag**. Any inbound while tagged can start the flow |
| `CAMPAIGN_REPLY` | Yes if metadata exists | Looks at last 30 outbound messages for `metadata.campaignId`. Campaign worker **does** write `{ templateName, templateLanguage, campaignId }` in `server/src/workers/index.ts` |
| `MISSED_CALL` | **Not inbound** | `triggerMissedCallFlow` from calling |
| `CALL_COMPLETED` | **Not inbound** | `triggerCallCompletedFlow` |

Matching order: `priority desc`, then oldest `createdAt`. First match wins. No “run all matching.”

### 4.6 Node types (26 declared)

Implemented in `executeNode` (engine switch):  
`message`, `buttons` (reply / url / call), `list`, `question`, `tag`, `remove_tag`, `set_variable`, `goto_flow`, `goto_step`, `request_callback`, `assign`, `condition`, `handoff`, `ai`, `end`, `template`, `media`, `delay`, `schedule`, `webhook`, `location`, `contact_card`, `wa_flow`, `ab_split`, `language`.

Honest completeness (not FEATURE_MATRIX “DONE”):

| Node | Real status |
|------|-------------|
| message / buttons / list / question / tag / handoff / end | Solid |
| template | Sends template **without checking CSW**; also interpolates a dummy text body |
| delay / schedule | Queues BullMQ; **while waiting, inbound messages are swallowed** (`waitingFor === 'delay' → return true`) |
| webhook | Single `fetch`, 10s timeout, **no SSRF allowlist**, posts org/conversation/contact ids |
| media | **Sends** media. `waitingFor: 'media'` is typed but **never set** — cannot wait for user to send a photo |
| wa_flow | Sends Meta form interactive; waits `wa_flow` |
| goto_flow | Jumps; **no return stack** |
| goto_step | Can create infinite loops with no validation |
| ab_split | Random; no sticky assignment, so A/B is per-visit not per-contact |
| language | Depends on script detection into `state.variables.language` |
| request_callback | Tag + optional assign — **does not place an actual call** |

---

## 5. Runtime — inbound WhatsApp to outbound

```
Meta webhook (public HTTPS tunnel required)
  → webhook.processor: persist contact / conversation / message, opt-in/out keywords
  → handleInboundAutomations
       ① handleInboundFlow  (Redis lock per conversation)
            skip if botHandoffAt or assigned agent with status ≠ OPEN
            user says human/agent/… → handoff, stop
            if botState waiting delay → swallow message, return handled
            else continue waiting button/text/wa_flow
            else recover recent button tap (24h)
            else matchFlow (published + enabled)
            execute nodes → deliverOutboundMessage (metadata.source = 'flow')
            delay → flow-queue resume-flow
            ai node → clear flow state + automation-queue ai-chatbot
       ② else first matching auto-reply → send (metadata.source = 'automation')
       ③ else queue AI bot
```

**Workers are embedded in the API** (`startWorkers()`). Do not also run `npm run dev:worker`.

**Inbound still requires the ngrok tunnel.** Automations never fire if Meta cannot POST the webhook (`totalReceived: 0`). That is infra, not the Automations page.

---

## 6. Connections to the rest of Samyoj

| Module | Connection today | Gap |
|--------|------------------|-----|
| **WhatsApp / webhooks** | All inbound automations start here | If tunnel/webhook broken, page looks “fine” and nothing runs |
| **Inbox** | Shows active flow; agent send can disable bot; handoff stops flows | Agent vs bot vs flow state is easy to confuse; no “pause this flow” control besides bot toggle |
| **AI Bots** | Flow `ai` node + fallback queue | Duplicate “bot” mental model with auto-replies `AI_CHATBOT` ghost type |
| **Templates** | Flow `template` node loads template list | No check that template is APPROVED / correct category; no CSW-aware “must use template” switch |
| **Campaigns** | Worker writes `metadata.campaignId`; `CAMPAIGN_REPLY` reads it | Settings UI is a **raw campaign ID** text field, not a picker. Easy to misconfigure |
| **Calling** | Missed call + call completed event flows | Missed-call outbound can fire **without a customer message** → outside CSW unless a call itself opens a window (Meta: user **call** also opens CSW). Confirm against current Cloud API; still need template fallback if send fails |
| **Contacts / tags** | Lead capture + tag/remove_tag nodes; CONTACT_TAG trigger | Tag trigger is “any message while tagged,” not “just got this tag” |
| **Tickets** | None | Competitors treat ticket create as a first-class automation action |
| **Business hours** | Org settings | Auto-reply leftover local-hour helper unused; users must set hours in Settings or AWAY never fires |
| **Billing / plans** | Marketing copy lists automations | **No plan enforcement** in these routes |
| **Compliance / opt-out** | Webhook can set `optedIn`; AI queue checks it | **Flow engine does not check `optedIn`** |
| **Analytics** | `AutomationLog` + `Flow.stats` | Stat increment is read-modify-write (race). Analytics UI ignores some API fields (`byAction`, `daily`) |

Auth: `authenticate` + `requireOrg` only. **Any org member can create/delete automations and publish flows.** No OWNER/ADMIN gate.

---

## 7. Meta / WhatsApp research vs our build

Sources (2026):

- [Customer service window / service messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
- [Pricing (CSW, FEP, per-message templates)](https://developers.facebook.com/docs/whatsapp/pricing/)
- [Opt-in requirements](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/)
- [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/)
- [WhatsApp Flows](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows)
- [Flow JSON](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson/)
- Existing internal: `docs/WHATSAPP_API_DOCUMENTATION.md`

### 7.1 Rules that actually govern automation

1. **24-hour customer service window (CSW)**  
   Opens when the **user** messages **or calls**. Resets on each user message/call. Business replies do **not** reset it. Inside: free-form text, media, buttons, lists, locations. Outside: **approved templates only**. Free-form outside → typically error **131047**.

2. **Service messages are free** inside CSW (since Nov 2024). Template **marketing** messages are paid per message (pricing model since July 2025). Utility templates inside an open CSW are free.

3. **72-hour Free Entry Point (FEP)** after Click-to-WhatsApp ads is a **pricing** window, not a permission to send free-form after CSW closes. After CSW closes you still need templates.

4. **Opt-in is mandatory** for business-initiated messages. Method is the business’s responsibility; must name the business and honor opt-out.

5. **Automation is allowed inside CSW**, but policy requires a **prompt, clear escalation path to a human**. Infinite bot loops with no handoff are a quality-risk.

6. **Interactive limits (Cloud API)**  
   Reply buttons: **max 3**, title **max 20 chars** (we slice this — good).  
   List: **max 10 rows total**.  
   CTA URL / call buttons: one CTA, not mixed with 3 reply buttons.

7. **WhatsApp Flows (Meta)** are **in-chat native UIs** (multi-screen forms), not CRM flowcharts. They run on the phone, optionally with an encrypted **data endpoint**. Completing a Flow returns `nfm_reply`.

8. **Quality rating** (GREEN/YELLOW/RED) is driven by blocks/reports. Aggressive keywords, unsolicited follow-ups after delay, and marketing inside a support chat will tank the number.

9. **Throughput tiers** are rolling unique-customer limits, not “messages per day.”

### 7.2 Accuracy table

| Meta rule | Samyoj today | Accurate? |
|-----------|--------------|-----------|
| Free-form only inside CSW | Automation/flow send path has **no CSW check**; delay/schedule/missed-call can send later | **No** |
| Outside CSW → template | `template` node exists but is optional; no auto-fallback on 131047 | **Partial** |
| Opt-in / opt-out | AI path checks `optedIn`; **flow engine does not** | **No** |
| Human escalation | Handoff node + keyword list (`human`, `agent`, …) | **Yes, basic** |
| 3 buttons / 20 chars | Engine slices to 3 × 20 | **Yes** |
| List 10 rows | Need UI validation (do not assume) | **Unclear** |
| WhatsApp Flows ≠ chatbot trees | Product uses “flow” for both; promo links Forms → conversation builder | **Naming fail** |
| Avoid open-ended welcome spam | Welcome + ANY_MESSAGE + no frequency cap can spam | **Risk** |
| Encrypted Flow data channel | `flows-assets/crypto.ts` + data endpoint exist | **Partial** (second, orphaned builder) |
| NFM replies | Parser + optional `/api/flows-assets/webhook/nfm` **unauthenticated** | **Risk** |

### 7.3 What Meta would expect a CRM automation product to do

Popular, high-value, policy-safe patterns:

1. Welcome menu (buttons) **once** on first inbound  
2. Keyword FAQ inside CSW  
3. After-hours collect-a-message + tag (stay inside CSW — customer just wrote)  
4. Campaign reply handler (user replied to template → CSW is open → free-form tree)  
5. Human handoff with inbox assignment  
6. Structured capture via **WhatsApp Flows** (name/email/slot) instead of 6 question bubbles  
7. Utility template for “we missed you / order update” **outside** CSW  
8. AI only after menu “Other” or unmatched intent — with handoff keywords  

We have 1–6 as **nodes**. We do **not** have 7 as a reliable system behavior (CSW-aware send). We have 8 as a node + fallback, but fallback AI can fight with ANY_MESSAGE flows.

---

## 8. Competitor research (WhatsApp CRM automation)

Compared against how WATI, Interakt, AiSensy, Respond.io, ManyChat, Gallabox, SleekFlow are sold in 2026 (public pages / roundups — not their private source).

### 8.1 How they structure the product (lesson)

Winners **separate**:

| Layer | Typical name | Samyoj equivalent |
|-------|--------------|-------------------|
| Instant replies | Auto-reply / keyword | Auto-replies tab |
| Visual journeys | Chatbot / flow builder | Conversation flows |
| Meta native forms | WhatsApp Flows / Forms | `wa_flow` + confused second builder |
| AI | AI agent / KnowBot | AI Bots page + flow `ai` node |
| Outbound sequences | Drip / campaign follow-up | Campaigns + `CAMPAIGN_REPLY` (weak UI) |

They do **not** dump all of this on one default “quick replies” tab without teaching priority.

### 8.2 What users actually buy (popular features)

1. **Keyword + welcome + away** that cannot overlap silently  
2. **Visual builder** with test/simulate **and** a real “send test to my number”  
3. **Handoff to inbox** that agents can see and take over  
4. **Campaign → reply bot** (broadcast then tree) — Interakt/AiSensy core loop  
5. **Catalog / Shopify / abandoned cart** — Interakt strength; **we have none**  
6. **Drip outside CSW using templates** with stop-on-reply  
7. **Frequency cap** (“once per contact per 24h”)  
8. **Conflict / “this keyword already used”** at save time, not a banner after  
9. **AI that answers FAQs without drawing 40 nodes** (WATI KnowBot / Gallabox)  
10. **WhatsApp Flows** for lead forms, not 8 question steps  
11. **Clear live/draft**: unpublished never talks to customers  
12. **Logs**: which node fired, which Meta error, retry  

### 8.3 Where competitors still fail (we will hit the same walls)

Industry-wide pain (support threads + agency blogs, consistent since Cloud API):

- Delay node fires after CSW → 131047, “bot died”  
- Two bots answer the same keyword  
- Welcome + AI both fire on first message  
- “Test” is simulate, user thinks WhatsApp is broken  
- Save vs Publish  
- Delay + customer types anyway → message ignored  
- Regex keywords matching too much  
- Webhook to `localhost` / SSRF  
- Template paused (quality RED) and flow keeps sending it  
- Calling a conversation “flow” when Meta also named Flows  
- No human escape hatch → blocks → number quality drop  

### 8.4 Pros / cons if we copy blindly

| Idea | Pro | Con for Samyoj |
|------|-----|----------------|
| Shopify-depth commerce bots | Huge India D2C market | Out of current scope; don’t fake catalog nodes |
| Omnichannel (Respond.io) | Sticky enterprise | We are WhatsApp-first; don’t dilute |
| Natural-language “generate a flow” | Fast setup | Garbage graphs without validation/CSW rules |
| Unlimited ANY_MESSAGE AI | Feels magical | Cost + quality score + fights human agents |
| Drip sequences | Marketing teams expect it | **Must be template-based** or Meta will fail sends |

**Best competitor pattern to steal (safely):**  
One inbound router: *Welcome (once) → Keyword → Open flow → AI → Human*. Hard frequency caps. CSW-aware delay. Publish ≠ draft. Forms ≠ chat trees.

---

## 9. What is already good (keep)

Evidence-backed. Do not rewrite these for polish-theatre.

1. **Single inbound funnel** (flow → rule → AI) is the right architecture.  
2. **Conversation Redis lock** in `handleInboundFlow`.  
3. **Handoff keywords** stop a stuck tree.  
4. **Button recovery** from last interactive outbound (24h) — good for lost `botState`.  
5. **Draft / version restore** on conversation flows.  
6. **Simulate** exists (`flowApi.simulate`) — keep, but label it “preview, not a real send.”  
7. **Conflicts banner** exists (welcome / keyword / away overlaps) — incomplete but the right idea.  
8. **Calling → missed-call / completed-call flows** — rare among SMB CRMs; keep.  
9. **Campaign worker writes `campaignId` on outbound metadata** — `CAMPAIGN_REPLY` can work.  
10. **Interactive button slicing** to Meta’s 3×20.  
11. **Inbox shows “this conversation is in a flow.”**  
12. **AI debounce** (1.5s, stable job id) reduces double replies while user types.

---

## 10. Bugs, logic holes, and smoothness problems

Severity = user/data/Meta-risk, not ticket count.

### Critical / High

1. **No customer-service-window gate on automation sends**  
   - Why: Delay, schedule, missed-call, or a slow tree can send free-form after 24h → Meta 131047, user thinks “automation is broken.”  
   - Evidence: no `131047` / CSW handling in `messages/send.service.ts`; delay resume in `flows/engine.ts` `resumeFlowAfterDelay` sends with empty `content` (not a user message).  
   - Fix (later): before non-template send, if last inbound/call > 24h, skip or send a configured **utility template**; surface error in logs/UI.  
   - Verify: simulate delay 25h or stub last inbound timestamp.

2. **Flow engine ignores `contact.optedIn`**  
   - Why: STOP keyword in webhook then a delay resume still messages them → policy + blocks.  
   - Evidence: AI path checks opted-out (`automation/engine.ts`); `flows/engine.ts` has no `optedIn`.  
   - Fix: abort `runFromNode` / resume if opted out; log `skipped`.

3. **Delay swallows customer messages**  
   - Why: Customer replies during wait; we `return true` and never queue AI or continue. Looks like WhatsApp is deaf.  
   - Evidence: `processInboundFlow` `if (existingState.waitingFor === 'delay') return true;`  
   - Fix: either interrupt delay and branch, or park the message for after resume. Default: **interrupt + treat as new inbound**.

4. **Three products named “flow” + wrong promo**  
   - Why: Users build the wrong thing; support load.  
   - Evidence: `WhatsAppFormsPromo` → `/automations/flows/new`; `MetaFlowBuilder` has no nav; `WaFormPicker` is the live path.  
   - Fix: rename Conversation flows vs WhatsApp Forms; kill or link the orphan builder; promo → Forms.

5. **Save ≈ Publish and new flows default `enabled: false`**  
   - Why: Toast “saved and live” while Off. Or published-but-off.  
   - Evidence: frontend map of `FlowBuilderPage.handleSave`.  
   - Fix: Draft vs Live as two explicit actions; never say live unless `status=PUBLISHED && enabled`.

6. **Webhook node SSRF**  
   - Why: Authenticated org user can `fetch` internal URLs (metadata, cloud IMDS, Redis).  
   - Evidence: `callWebhook` unrestricted `fetch(node.webhookUrl)`.  
   - Fix: HTTPS-only, block private/link-local, optional allowlist.

7. **NFM webhook unauthenticated**  
   - Why: Anyone who finds `/api/flows-assets/webhook/nfm` can inject form completions into the automation pipeline.  
   - Evidence: `flows-assets/routes.ts` NFM route without `authenticate`.  
   - Fix: signature / shared secret / only accept Meta-shaped payloads with HMAC.

8. **`goto_step` / missing cycle detection**  
   - Why: Infinite node loop → 50-iteration cap then dropoff; can still spam messages before cap.  
   - Evidence: `validation.ts` has no cycle check; engine warns at 50.  
   - Fix: validate DAG / max visits per node per conversation.

9. **FEATURE_MATRIX overclaim**  
   - `AI_CHATBOT` trigger DONE — not matched.  
   - Schedule flow DONE on Flow card — `flowApi.scheduleStart` unused in client.  
   - “10 trigger types” — enum has 11.  
   - “All DONE” — false. Using that matrix as a ship checklist will skip real work.

10. **Any org role can publish automations**  
    - Why: intern/agent can take over every inbound chat.  
    - Evidence: routes use `authenticate` + `requireOrg` only.

### Medium

11. Keyword auto-reply is **substring** (`includes`), flow keyword can be regex — inconsistent, accidental matches.  
12. `CONTACT_TAG` / `SEGMENT` fire on **every** inbound while tagged (can re-enter a tree forever) — need “on tag added” or once-per-conversation.  
13. `ANY_MESSAGE` excluding welcome still fights AI fallback and other flows (first priority wins silently).  
14. `waitingFor: 'media'` never implemented — UI may imply “wait for photo.”  
15. `ab_split` not sticky per contact.  
16. `goto_flow` no return.  
17. `request_callback` does not create a Call.  
18. Conflicts banner: no deep-link, misses ANY_MESSAGE vs keyword, misses tag re-entry.  
19. Analytics cap / unused `byAction`+`daily`; `Flow.stats` race.  
20. `AutomationLog` has no relations — hard to audit “this flow’s last 50 failures.”  
21. Template node does not check APPROVED / quality.  
22. Mobile builder: no version history.  
23. Default landing tab Auto-replies while the “major” product is Conversation flows.  
24. Test panel is simulate-only (copy is honest-ish; users still expect a phone test).  
25. Campaign reply trigger = paste UUID.  
26. Duplicate NFM entry points (inbox parser + dedicated webhook) — double-handle risk.  
27. Lock miss (`withConversationLock` null) returns false → **falls through to static + AI** — possible double reply.  
28. Billing features not enforced.

### Low / polish

29. `AI_CHATBOT` leftover labels in analytics/meta.  
30. `goto_flow` copy “Other auto-reply.”  
31. Dead `isBusinessHours(config)` helper.  
32. `processAutomations` re-export unused.  
33. List step count may show published `nodes` while user is editing draft.  
34. No undo/redo on canvas (old review).  
35. No tickets action.

---

## 11. What to enhance (after review — not now)

Grouped so we do not boil the ocean. **Do not implement until this doc is accepted.**

### Phase A — Make what we have true (must)

1. CSW-aware send + template fallback + log Meta error 131047 in Automations Performance.  
2. Honor `optedIn` in flow engine + delay resume.  
3. Delay: do not swallow inbound.  
4. Publish/enabled honesty in UI.  
5. Naming: Auto-replies vs Conversation journeys vs WhatsApp Forms.  
6. OWNER/ADMIN for publish/delete.  
7. Engine + inbound pipeline tests (happy path + delay + handoff + opt-out + CSW).  
8. Cycle detection in validate.  
9. Webhook SSRF allowlist.  
10. Authenticate or sign NFM webhook.  
11. Correct `FEATURE_MATRIX` statuses.

### Phase B — Smoothness users feel

1. Conflict detection at **save** with links.  
2. Frequency cap: once per conversation / per 24h per flow.  
3. Keyword word-boundary + shared matcher for rules and flows.  
4. Campaign picker for `CAMPAIGN_REPLY`.  
5. Real “send test to my WhatsApp.”  
6. Default hub tab = Conversation flows **or** a chooser (“Start with a welcome menu”).  
7. Interrupt vs continue when customer types during delay (explicit node setting).  
8. Sticky A/B per contact.  
9. Inbox: pause / jump-to-node / “bot is waiting for a button.”  
10. Performance: node-level drop-off that matches `Flow.stats` honestly.

### Phase C — Modern CRM (only if A+B hold)

1. One Meta Forms list (merge `wa-forms` and `flows-assets` or hide the orphan).  
2. Ticket create / SLA node.  
3. Template drip **outside** CSW with stop-on-reply.  
4. Commerce/catalog nodes — **only** with a real catalog integration, not placeholders.  
5. Natural-language “generate journey” that **emits validated graphs** with CSW rules baked in.  
6. `on_tag_added` trigger (not “any message while tagged”).  
7. Flow return stack for `goto_flow`.  
8. Wait-for-media node (actually set `waitingFor: 'media'`).

---

## 12. Recommended product language (for later UI copy)

Stop using “flow” for everything.

| Say | Mean |
|-----|------|
| **Auto-reply** | One message, one trigger |
| **Journey** or **Conversation bot** | Multi-step Samyoj tree |
| **WhatsApp Form** | Meta native Flow |
| **AI Bot** | LLM brain (separate page) |
| **Live** | Published **and** enabled |
| **Draft** | Will never message customers |
| **Try on canvas** | Simulate |
| **Send test** | Real WhatsApp to a test number |

---

## 13. Test plan (scratch → top) — do this before claiming “automation works”

No code in this pass. This is the checklist for the next implementation chat.

### Infra (if this fails, ignore the Automations UI)

1. `curl -s http://localhost:8000/health` — api/db/redis ok  
2. `curl -s http://localhost:8000/api/whatsapp/webhook/health` — non-empty `webhookUrl`  
3. Public challenge returns `ping`  
4. Send a **new** phone message; `totalReceived` increments  

### Auto-replies

5. Keyword “price” → exact expected reply; “surprise” must **not** match “price” if we tighten matching  
6. First message of new contact → welcome once, not on second  
7. Toggle org hours → AWAY vs BUSINESS_HOURS  
8. Two welcomes → only oldest (document or fix)  
9. Welcome + welcome journey both on → **journey wins**; banner tells the truth  
10. Lead capture tags contact; handoff opens inbox  

### Conversation journeys

11. Template “Welcome + Menu” published + enabled → buttons work  
12. Invalid button text → tree recovers or asks again  
13. Type “agent” → handoff, agent sees chat  
14. Delay 10s: customer messages at 3s → must **not** vanish  
15. Delay 10s: wait → next node sends  
16. Simulate vs real send labelled  
17. Draft journey never replies  
18. Disabled published journey never replies  
19. `goto_step` loop → validate blocks **or** runtime stops without spam  
20. Webhook to `http://127.0.0.1` → **rejected** after SSRF fix  

### Meta window / policy

21. After 24h silence, delay resume → template or skip, **not** raw text  
22. Opt-out then delay resume → no send  
23. Campaign send → user replies → `CAMPAIGN_REPLY` journey starts  
24. Missed call with no CSW → template or graceful fail in logs  

### AI coexistence

25. No journey, bot on → AI replies  
26. Journey matches → AI does **not** also reply  
27. Journey `ai` node → AI takes over once  

### Regression

28. Inbox still receives when no automations exist  
29. Agent assigned + not OPEN → automations skip  
30. Two rapid inbound → no double send (lock + debounce)

---

## 14. What not to do

- Do not add more node types until delay/CSW/opt-out/tests exist. Coverage is already wide; reliability is not.  
- Do not merge Auto-replies into the canvas “to simplify.” Keep one-shot rules; power users need both.  
- Do not re-introduce Meta App ID fields on Automations.  
- Do not treat `FEATURE_MATRIX.md` or `FEATURES_6-10_DEEP_REVIEW.md` (2026-07-31) as current — this document supersedes them **for automation only**.  
- Do not “fix Inbox UI” if replies never arrive — that is webhook/tunnel.  
- Do not copy Interakt catalog bots without Shopify/catalog work.

---

## 15. Suggested next conversation (after you review this)

If you accept Phase A:

> “Implement Phase A from `docs/audit/AUTOMATION_WORKFLOW_COMPLETE_REVIEW.md` — CSW, opt-out, delay interrupt, publish honesty, naming, role gates, engine tests, cycle detection, webhook SSRF, NFM auth. No new node types.”

Until then: **no code.**

---

## 16. Sources

### Code (this pass)

- `server/src/modules/automation/engine.ts`, `routes.ts`, `conflicts.ts`  
- `server/src/modules/flows/engine.ts`, `types.ts`, `validation.ts`  
- `server/src/modules/flows-assets/routes.ts`  
- `server/src/workers/webhook.processor.ts`, `server/src/workers/index.ts` (campaign `metadata.campaignId`)  
- `server/prisma/schema.prisma` (`Automation`, `Flow`, `FlowAsset`, `AutomationLog`, enums)  
- `client/src/pages/AutomationsPage.tsx`, `FlowBuilderPage.tsx`, `MetaFlowBuilder.tsx`  
- `docs/audit/FEATURE_MATRIX.md`, `docs/AUDIT.md`, `docs/audit/FEATURES_6-10_DEEP_REVIEW.md`, `docs/WHATSAPP_API_DOCUMENTATION.md`

### Meta / policy

- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages  
- https://developers.facebook.com/docs/whatsapp/pricing/  
- https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/  
- https://whatsappbusiness.com/policy/  
- https://developers.facebook.com/documentation/business-messaging/whatsapp/flows  
- https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson/

### Competitors / market (directional, 2026 public)

- WATI vs Interakt vs AiSensy roundups (Ominiflow, InstantDM, Respond.io “best WhatsApp chatbots”)  
- Infobip: Flows vs chatbots vs templates  

**Confidence:** High on architecture, triggers, node switch, inbound priority, campaign metadata, and Meta CSW/opt-in rules. Medium on live Meta NFM vs `/webhook/nfm` in production app config, list-row validation in UI, and whether a WhatsApp **call** currently opens CSW on this Cloud API version (Meta docs say user message **or call**). Not load-tested in this pass.

---

*End of review. Implementation waits for explicit approval.*
