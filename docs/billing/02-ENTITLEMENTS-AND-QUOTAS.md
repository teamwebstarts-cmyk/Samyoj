# 02 — Entitlements and quotas (TARGET)

Every limit is an **enforceable server rule**, not marketing copy. CURRENT CODE: only team-seat checks (and those are bypassable) plus Content Studio `cost-guard.ts` keyed off **old** plan names. See [10-GATING-MATRIX](10-GATING-MATRIX.md).

## 1. Quota check order

On every mutating request:

1. **Org commercial status** — `trial` | `active` | `past_due` | `grace` | `locked` | `cancelled`. Locked/cancelled: read-only Inbox, no send, no campaign, no connect.
2. **Feature entitlement** — plan × flag (AI, Calling, Advanced inbox, public API).
3. **Hard quota** — WA connect slots, seats, contacts, published workflows.
4. **Usage meters** — AI tokens (Growth/Pro), campaign daily budget (settings, not plan), Content Studio daily caps.
5. **Meta rules** — 24h CSW / templates / quality. Not Samyoj SKUs. See [17](17-META-WHATSAPP-BILLING-AND-POLICY.md).

Fail closed with a structured error: `{ code: "PLAN_LIMIT", quota, used, limit, upgradeCta: "growth" }`. UI: **Unlock Growth** (or Pro/Enterprise).

## 2. Plan → numbers

| Quota | Launch | Starter | Growth | Pro | Enterprise |
| --- | ---: | ---: | ---: | ---: | --- |
| WhatsApp **connect slots** | 1 | 1 | 2 | 5 | Unlimited (Meta portfolio cap still 2→20) |
| Team members (active seats) | 1 | 3 | 10 | 25 | Custom |
| Contacts | 100 | 5,000 | 25,000 | 100,000 | Unlimited |
| Inbox | Core | Included | Advanced | Advanced | Advanced |
| Published workflows | 1 | 5 | Unlimited | Unlimited | Unlimited |
| Analytics | Basic | Basic | Advanced | Advanced | Custom |
| Support | Community | Email | Priority | Priority | Dedicated |
| Integrations | Basic | Standard | Advanced | Advanced | Custom |
| AI Assistant | **Off** | **Off** | Included | Advanced | Dedicated |
| Calling module | Off | Off | Off (or add-on later) | Entitled (Meta minutes extra) | Entitled |
| Public API / Zapier | Off | Off | Advanced integrations | Advanced | Custom |

**Unlimited** = no Samyoj numeric cap. Still Meta messaging limits, quality, fair-use anti-abuse.

## 3. Mapping to Samyoj modules

| Quota | Enforce at | CURRENT CODE |
| --- | --- | --- |
| WA connect slots | WhatsApp Connect / number register / Embedded Signup callback | **Not gated.** Extra numbers connect on any plan. |
| Seats | Invite + accept + `PATCH /api/team/settings` | GET billing uses plan seats if no team JSON; `DEFAULT_TEAM_SETTINGS.seatLimit=25`; PATCH accepts 1–500 **with no plan check**. |
| Contacts | Contact create / import / webhook upsert | **Not gated.** Starter copy said “500 contacts” and was never enforced. TARGET Starter = 5,000. |
| Workflows | Publish/activate automation | **Not gated.** |
| Inbox Core vs Advanced | Assignment, SLA, collision, bulk, saved replies (product-define Advanced) | Mostly ungated. |
| AI | Bot send, copilot, embeddings, Content Studio AI | `settings.ai.monthlyTokenLimit` 0 = unlimited. No plan flag. AI Providers clause: [17](17-META-WHATSAPP-BILLING-AND-POLICY.md). |
| Analytics Advanced | Reports beyond 7-day basic | Ungated. |
| Campaigns | Send | Daily 5000 msgs / ₹5000 settings defaults — **not plan**. Meta PMP extra. |
| Calling | Place business-initiated call | `OrgFeatureFlag.calling` **never** `requireFeature()`. Meta Calling API bills separately. |
| Public API | `/api/public` | Flag unused. |
| Content Studio | generation | **Only real meter besides seats.** Remap `starter/growth/business` → `launch/starter/growth/pro`. |

## 4. Exceed behaviour

| Quota | At 80% | At 100% |
| --- | --- | --- |
| Seats | Banner: Unlock Growth | Block invite. Do not auto-bill extra seats (v1). |
| Contacts | Banner | Block create/import. Inbound webhook: store message, **do not** create 100,001st contact — park as “unlinked inbound” or reject with ops alert. Pick one in implementation; recommend **park + notify** so Inbox does not drop customer replies. |
| WA slots | — | Block Connect. Meta may still allow more numbers on the WABA; we do not attach them. |
| Workflows (Launch/Starter) | — | Block publish of N+1. Drafts allowed. |
| AI (Launch/Starter) | — | Hide composer AI; API 403 `AI_NOT_IN_PLAN`. |
| Trial expired | — | See [03](03-TRIAL-AND-CONVERSION.md). |
| Campaign budget | Warn | Block send that day. |

**No overage invoices in v1.** CTA is always upgrade.

## 5. “WhatsApp number” definition (do not blur)

Counted slot = active `WhatsappNumber` row connected to the org (Cloud API `phone_number_id` registered in Samyoj).

Not counted: Meta test numbers used only in our internal sandbox; disconnected numbers after cooldown.

Not a Meta phone-number hosting fee. See [17 §4.4](17-META-WHATSAPP-BILLING-AND-POLICY.md).

## 6. Inbox Core vs Advanced (product definition for gating)

**Core (Launch):** one inbox, basic labels, send/receive, 24h composer lock, templates.

**Included (Starter):** Core + assignments within 3 seats, canned replies.

**Advanced (Growth+):** collision detection, SLA, bulk assign, advanced filters, multiple inboxes per number if built, priority support tooling.

Until Advanced is coded as flags, do not sell it as a lie — ship flags in Phase 3.

## 7. AI Included vs Advanced vs Dedicated

| | Growth Included | Pro Advanced | Enterprise Dedicated |
| --- | --- | --- | --- |
| Suggested replies / summarize | Yes | Yes | Yes |
| Automation AI steps | Yes | Yes | Yes |
| Higher token budget | Plan default | Higher | Custom |
| Fine-tune exclusive model | No | Optional | Yes |
| Train foundation models on chats | **Never** (WhatsApp Business Solution Terms, 2026-03-06) | Never | Never |

## 8. Support SLAs (commercial, not pager)

| | Community | Email | Priority | Dedicated |
| --- | --- | --- | --- | --- |
| Channel | Docs / Discord or forum | Email 24h response target | Email + in-app, 8h | Named CSM + WhatsApp/Slack |
| Meta bans | Playbook link | Help file appeal | Join the ticket | Join + partner support if SP |

Support is **not** Meta Direct Support unless we are Tech Provider with Direct Support for **our app**, which does not replace the customer’s WhatsApp Manager tickets.
