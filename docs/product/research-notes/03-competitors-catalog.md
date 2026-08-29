# Competitors + catalog — retargeting, templates, website widget

**Date:** 2026-08-29  
**Audience:** product / engineering (growth surfaces)  
**Scope:** How WhatsApp SaaS products (AiSensy, Wati, Interakt, similar) handle campaign retargeting, first-party vs Meta template catalogs, and website WhatsApp buttons — mapped to Samyoj constraints.  
**Not in scope:** implementing features, SAMYOJ-35 TARGET billing, Phase C automations, live WebRTC transfer, mixing Meta Cloud API fees into Samyoj SaaS price.

**Samyoj hard constraints (do not relax):**

| Constraint | Code / policy |
|---|---|
| Consent fail-closed | Campaign send requires `optedIn` + `consentSource` + `consentAt` + no `optOutAt` (`hasAuditableCampaignConsent`) |
| Number isolation | Every cohort, retry, and widget number is scoped by `whatsappNumberId`. Never pick “latest” |
| Do not silently retry AMBIGUOUS | `canRetryCampaignRecipient` is `FAILED` only; `retryFailedRecipients` filters `status === 'FAILED'` |
| Free-form only inside 24h CSW | `isWithin24HourWindow` / Inbox already blocks TEXT/INTERACTIVE/media outside window |
| Do not skip Meta template review by copying JSON across tenant WABAs | No such Graph shortcut exists for unrelated orgs. Official clone/migrate paths are cited below |

---

## Retargeting

### What competitors ship

**AiSensy** treats campaign analytics as the retargeting UI, not a separate CDP. After a broadcast, the campaign report splits **Sent / Delivered / Read / Replied / Failed**. From those sections the user filters a cohort and starts another broadcast (always a **pre-approved template**). Documented cohorts:

| Source tab | Filters | Next send |
|---|---|---|
| Delivered | has read / did not read / both | New template broadcast |
| Read | replied / did not reply / both; optional “replied with this text” | New template broadcast |
| Failed | phone on WhatsApp vs not on WhatsApp | Retry broadcast only for “on WhatsApp”; do not hammer known-invalid numbers |
| CTA clicked | users who tapped a URL/QR button | New template broadcast (marketing copy claims 3× conversion) |

Failed retries can also be **scheduled at send time**: toggle “Retry Campaign”, up to **3 retries** inside a **24h** window after the original send. That is a *delivery* retry of the **same** template, not a creative follow-up. Sources: [AiSensy retargeting](https://aisensy.com/features/whatsapp-retargeting), [analytics wiki](https://wiki.aisensy.com/en/articles/11501896-whatsapp-broadcast-campaign-analytics), [failed retries tutorial](https://aisensy.com/tutorials/how-to-retry-failed-messages-up-to-3-times-with-failed-retries).

**Wati** splits two send types in Rules and Drips, which is the right mental model:

- **Session message** (`Send message`) — free-form text/media, **only** if the 24h customer-service window is open. Fires on inbound-triggered rules.
- **Template message** (`Send template message`) — Meta-approved HSM, legal **inside or outside** CSW. Required for scheduled drips, attribute-change rules, and any follow-up after silence.

Drip campaigns are multi-step **templates only**, with delays (often 24h) and a **“Stop Campaign on Customer Reply”** toggle. Wati’s own blog is explicit: you cannot free-form follow up a no-reply after the window closes. Sources: [template vs session](https://support.wati.io/en/articles/11463456-what-is-the-difference-between-template-message-and-session-message), [rules send actions](https://support.wati.io/en/articles/11463197-how-to-set-up-actions-in-rules), [drip campaigns](https://support.wati.io/en/articles/14734248-how-to-create-drip-campaigns-in-wati), [session expiry](https://support.wati.io/en/articles/11463459-understanding-whatsapp-chat-session-expiry-and-how-to-restart-conversations).

**Interakt** is strongest on **failure taxonomy**, not AiSensy-style one-click cohort broadcast:

| Stat | Meaning | Suggested next action |
|---|---|---|
| Attempted / Sent / Delivered / Read | Standard Cloud API ladder | Manual re-target from report |
| Replied | Reply within **72 hours** (their product clock, not Meta CSW) | Nurture / stop drip |
| Limited | Meta **marketing frequency cap** | “WA re-target” later, or RCS fallback |
| Other Failures | Invalid number, expired template, transient | Do not blind-retry; inspect reason |
| Unqualified | Number not on WhatsApp | Drop; never retarget on WhatsApp |

Automated retries exist, but they are **narrow**: only frequency-cap failures, up to **7 days**, Smart Retry vs 24-hourly. Interakt also offers RCS/SMS fallback — out of Samyoj scope. Flow-complete users can be retargeted via “Send Notification” or an Ongoing Campaign on `Flow Completed`. Sources: [campaign stats](https://www.interakt.shop/resource-center/whatsapp-message-notification-template-campaign-performance-statistics/), [automated retries](https://www.interakt.shop/resource-center/setup-automated-retries-on-whatsapp-campaigns/), [WhatsApp forms / retarget](https://www.interakt.shop/resource-center/whatsapp-form/).

**Pattern that is *not* a full CDP:** all three products retarget **from this campaign’s recipient statuses**, then open the existing campaign composer with that phone list. They do not build a warehouse of “lookalike audiences.”

### Meta send-type rule (cohort → next send)

Official CSW: a user message or call opens **24 hours**; only then may the business send free-form service messages. Outside the window, **only approved templates**. A template does **not** reopen CSW; the **user’s reply** does. Marketing templates are also subject to per-user frequency caps (Interakt’s “Limited”). Sources: [send messages / CSW](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/), [conversation types](https://developers.facebook.com/docs/whatsapp/conversation-types/), [pricing / FEP](https://developers.facebook.com/docs/whatsapp/pricing/).

| Cohort (from prior campaign) | Open CSW? | Legal next send | Illegal / fail-closed |
|---|---|---|---|
| Delivered + read + replied | Usually yes (reply opened CSW) | Session **or** template | Still need consent for marketing templates |
| Delivered + read + no-reply | **No**, unless they wrote elsewhere | **Template only** | Free-form “just checking in” |
| Delivered + unread | No | Template (softer copy, not more spam) | Session message |
| Failed — not on WhatsApp / 131026-class | n/a | **No WhatsApp retry** | Blind retry of same number |
| Failed — rate limit / frequency cap | n/a | Template later, after cap window; optional human-scheduled | Auto-retry every few minutes; silent AMBIGUOUS retry |
| Failed — template paused / rejected | n/a | Fix template, then new campaign | Retry same dead template |
| Open session window (last inbound &lt; 24h), independent of campaign | Yes | Session **or** template (utility-in-CSW is Meta-free) | Treating CSW as a marketing blast list without consent |
| AMBIGUOUS (Samyoj-only) | Unknown | Wait for webhook reconcile; do **not** enqueue | `retryFailed` on AMBIGUOUS |

### What Samyoj already has

- Recipient statuses: `PENDING | SENT | DELIVERED | READ | FAILED | AMBIGUOUS` (`MessageStatus`). **No `REPLIED` column** — reply lives on Conversation / Inbox, joinable via phone + `whatsappNumberId`.
- Campaign detail UI today: **Summary + Failed** tabs only (`CampaignsPage` + `CampaignAnalyticsPanel`). Failed retry calls `campaignApi.retryFailed` → `retryFailedRecipients` (FAILED rows of latest `runGeneration` only).
- CSW: Inbox and automations already use `cs24hWindowOpensAt` / `isWithin24HourWindow`. Campaigns always send templates today — correct for cold outbound.
- Consent snapshot is stored per recipient at send time.

### Recommended UI (copy AiSensy tabs, not Interakt omnichannel)

On campaign detail, always show (not only when `failedCount > 0`):

1. **Overview** — funnel: attempted / sent / delivered / read / replied / failed / ambiguous  
2. **Read** — subset of delivered with `readAt`  
3. **Delivered** — delivered minus read (unread) vs all delivered  
4. **Replied** — contacts who inbound-messaged after this campaign’s send (join Conversation last inbound)  
5. **Active window** — replied **or** any inbound in last 24h on this `whatsappNumberId` (session-legal)  
6. **Failed** — reason groups; hide AMBIGUOUS from the Retry button  

Each tab: select cohort → **New campaign** prefilled with those phones. Send-type picker:

- Active window **and** user explicitly chooses session: free-form (Inbox-quality text), still fail-closed on consent if the copy is promotional. Default still template.
- Every other tab: **template only**, existing campaign wizard.

Do **not** build: lookalikes, RFM scoring, 7-day Smart Retry of frequency-capped marketing, RCS/SMS fallback, auto-drip of 5+ marketing templates.

### Verdict

| Call | What | Why |
|---|---|---|
| **GO** | Campaign-detail cohorts (Overview / Read / Delivered / Replied / Active window / Failed+reason) → next send with template-vs-session gated by CSW + consent + `whatsappNumberId` | Matches AiSensy/Wati; data already on `CampaignRecipient` + Inbox CSW; high conversion, low new surface |
| **DEFER** | Multi-step drips, “stop on reply”, CTA-click retarget, Interakt frequency-cap Smart Retry (7d) | Needs click tracking + drip engine; Phase C / SAMYOJ-5 adjacency; marketing-cap retries can look like spam |
| **NO-GO** | Silent retry of `AMBIGUOUS`; retry “not on WhatsApp”; free-form follow-up outside CSW; org-wide retarget ignoring number isolation; treating IMPORT-only contacts as consented | Violates existing safety tests and Meta CSW |

---

## Template catalog

### Two catalogs the market confuses (on purpose)

| Catalog | Owner | What it is | Does it skip Meta review? |
|---|---|---|---|
| **Meta Template Library** | Meta | Curated UTILITY / AUTHENTICATION skeletons via `GET /message_template_library`; clone with `POST /{waba-id}/message_templates` + `library_template_name` | **Faster path for unmodified library content.** Official note: if you **Customize** the template, it **must go through review** before send. [Template Library](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/template-library/) |
| **First-party BSP library** (AiSensy 100+, Wati “pre-approved library”, Interakt industry packs) | The SaaS | Marketing copy + sample JSON the BSP has seen approve *often*. Still submitted **per WABA** as a normal `message_templates` create | **No.** “Pre-approved” here means “policy-shaped,” not “Meta already approved it on *your* WABA.” AiSensy still says submit → PENDING → APPROVED/REJECTED |

AiSensy public pages claim “100+ pre-approved templates… skip the waiting entirely… ready to send instantly.” Their own help center contradicts the slogan: pick from the library **and submit for approval**; status is PENDING until WhatsApp approves. Treat the slogan as **conversion copy**, not Graph behavior. Sources: [AiSensy library marketing](https://aisensy.com/whatsapp-template-message-library), [create templates wiki](https://wiki.aisensy.com/en/articles/11501573-how-to-create-whatsapp-template-messages-in-aisensy), [Wati library](https://support.wati.io/en/articles/12469425-template-messages-masterclass-understand-how-they-work).

**Starter packs that actually approve faster** vs **marketing spam packs**:

| Pack type | Category | Why it lands | Why spam packs fail |
|---|---|---|---|
| Order confirm / shipment / delivery update | UTILITY | Matches Meta library `ORDER_MANAGEMENT` / `SHIPMENT_CONFIRMATION` / `DELIVERY_UPDATE`; user-action tied | Adding a coupon or “rate us + shop more” flips to MARKETING (Apr 2025 recategorize) |
| Payment due / receipt | UTILITY | Library `PAYMENTS` | “Pay now and get 10% off” is marketing |
| OTP / login | AUTHENTICATION | Library AUTH + copy-code / one-tap; only AUTH may send OTPs | Putting OTP in UTILITY/MARKETING → reject |
| Abandoned cart, festival blast, “we miss you”, 20 industry promo variants | MARKETING | Slow review, pacing, frequency cap, quality RED | Blocks/reports; template pause; number quality drop |

Samyoj already filters Meta library toward UTILITY/AUTH (`libraryCloneCategory`, `LIBRARY_QUICK_PICKS`: orders, shipping, delivery, payments, feedback, account, OTP). Feedback surveys that upsell should stay out of the “fast pack.”

### Official ways templates can appear on another WABA without a blank-slate review

These are the **only** documented Meta programs. None of them is “paste JSON into a different customer’s WABA and skip review.”

1. **Template Library clone (SAMYOJ-11 already in code)**  
   `GET /message_template_library` + `POST /{waba}/message_templates` with `library_template_name` (and button inputs). Unmodified library content is the intended fast path. Customize → review. Samyoj: `MetaWhatsAppService` + `POST /api/.../templates/from-library` + `TemplateLibraryPage`.

2. **Same-business template migration**  
   `POST /{destination-waba-id}/migrate_message_templates?source_waba_id=...`  
   Rules: **WABAs owned by the same Meta business**; only `APPROVED` + `quality_score` `GREEN` or `UNKNOWN`. Migration **recreates** templates; it does not move them. Destination can still fail category checks. [Template migration](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/template-migration/).

3. **Solution Partner / Tech Provider WABA or phone migration**  
   When a client WABA or number moves between Multi-Partner Solutions / Solution Partners, Meta **duplicates eligible templates** onto the destination WABA (typically `APPROVED` + `GREEN`). They get the source status initially, then **re-checked against categorization guidelines** and may become `REJECTED`. Quality ratings are **not** copied (`UNKNOWN` for ~24h). This is an **onboarding/migration** program, not a “share this promo pack with every tenant” API. [WABA among solutions](https://developers.facebook.com/docs/whatsapp/solution-providers/support/migrating-wabas-among-solutions-via-embedded-signup/), [phone among partners](https://developers.facebook.com/docs/whatsapp/solution-partners/support/migrating-phone-numbers-among-solution-partners-programmatically/).

**Not official / do not ship:** BSP “Copy templates to channel” that GETs components from WABA A and POSTs them to WABA B for a **different Meta business** (PayPerWA-style). That is a convenience re-submit. Each destination still goes through review; claiming skip-review is false. Templates are WABA assets; an APPROVED template on org A is PENDING/REJECTED on org B independently.

### Samyoj recommendation

Keep Meta library as the **system of record** for skeletons. Add a **Samyoj starter pack** that is a curated subset of library names (3 patterns × `hi_IN` + `en_US`):

1. Order confirmation (UTILITY)  
2. Delivery / shipment update (UTILITY)  
3. OTP / copy-code (AUTHENTICATION)

UI: first-run empty Templates state + existing `LIBRARY_QUICK_PICKS`, not a parallel marketing mall. Create path must keep **category + language** (already on `TemplateCreateForm`). Do not clone Meta’s full public library into a Samyoj-hosted JSON dump that pretends it is pre-verified for all tenants.

### Verdict

| Call | What | Why |
|---|---|---|
| **GO** | First-party starter pack: 3 UTILITY/AUTH library clones, `hi_IN` + `en_US`, still submitted via Graph `from-library` / create | Matches Wati/AiSensy “pick a safe template” UX; uses official Template Library; already half-built (`LIBRARY_QUICK_PICKS`, SAMYOJ-11) |
| **DEFER** | Industry marketing packs, AI template generator, “100+ ready to send” gallery, same-BM `migrate_message_templates` for multi-WABA enterprises | Marketing packs hurt quality; migrate_message_templates is real but rare (same Meta business only) |
| **NO-GO** | Copying template JSON across tenant WABAs and telling users review is skipped; claiming AiSensy-style instant-send; shipping festival/cart-abandon starter packs as UTILITY | No official partner program covers cross-tenant skip-review. Miscategorization is a ban path |

---

## Website widget

### What competitors ship

All of them wrap the **same official click-to-chat URL**. WhatsApp documents:

```text
https://wa.me/<international-number>
https://wa.me/<international-number>?text=<urlencoded-prefill>
```

Number: digits only, no `+`, spaces, dashes, or leading zeros. Prefill appears in the composer; the visitor still taps Send (that inbound opens CSW). [WhatsApp click to chat](https://faq.whatsapp.com/5913398998672934). Alternate host `https://api.whatsapp.com/send?phone=&text=` behaves the same.

**AiSensy** — Settings-adjacent **free WhatsApp Button** builder: background color, CTA text (“Chat with us”), margins, border radius, position (typically bottom-right), **pre-filled message** (default `Hi`), brand name, brand image, widget greeting, per-URL overrides (source URL → different prefill). Output: paste snippet on the site. The prefill is also used as a **first-message tag** so Inbox automations can fire. [AiSensy button wiki](https://wiki.aisensy.com/en/articles/11502742-how-to-create-free-whatsapp-button-for-your-website).

**Wati** — **WhatsApp Chat Button** generator: default user message, brand image, optional “open widget by default,” auto-embed **page URL + title** into prefill so agents know the landing page. Copy snippet **above `</body>`**. Shopify/WooCommerce: Connectors → Integrations → WhatsApp Chat (no hand-paste). [Wati widget help](https://support.wati.io/en/articles/11462979-how-to-add-a-whatsapp-chat-button-to-your-website).

**Interakt** — Widget section: style, brand colors, welcome message, desktop vs mobile launcher position/spacing, **WABA API number** + pre-configured Start Chat message, then Install snippet (`<head>` or `<body>`). Shopify App Embeds / “Set Live.” Older Interakt.co chat settings live under **Chat → Settings** (page targeting, devices). [Interakt widget](https://www.interakt.shop/resource-center/whatspp-crm-shared-team-inbox-add-whatsapp-chat-widget/).

**Common placement in product IA:** not Inbox, not Campaigns — **Settings / Connectors / Widget**. The number must be the **connected Cloud API display number**, not a personal `wa.me` the intern typed.

### What Samyoj should copy vs skip

| Piece | Copy? | Notes |
|---|---|---|
| `wa.me` + URL-encoded prefill | **Yes** | Official; zero Meta review; inbound is a real user message → CSW + consent capture |
| Bind number to active `whatsappNumberId` | **Yes** | Isolation: widget for number A must not open number B after switch |
| Settings tab (new “Website” under WhatsApp, or Integrations) | **Yes** | `SettingsPage` today: profile / whatsapp / inbox hours / security / data. Natural home: **WhatsApp** tab, below Connect, “Add to website” |
| Branding: CTA label, position L/R, offset, logo, greeting bubble | **Yes, thin** | Static CSS float + optional bubble; generate `<script>` or HTML snippet |
| Per-page prefill (product URL in `?text=`) | **DEFER** | Wati’s page-title trick is useful; v1 can be one global prefill |
| Shopify App Embed / Woo plugin | **DEFER** | Needs app store; snippet is enough for v1 |
| In-page fake WhatsApp thread (hosted Web chat that never opens WhatsApp) | **NO-GO** | Different product; Meta Jan 2026 blocks general-purpose open-ended AI on WhatsApp Business Platform — do not imply the widget *is* WhatsApp if it is not |
| QR download of the same `wa.me` | **GO-lite** | Same URL; print/offline; no extra policy |
| Click-to-WhatsApp Ads as the widget | **NO-GO for this surface** | Ads are a different Meta product (CTWA / FEP 72h). Do not conflate |

Consent: a widget click is **user-initiated inbound**. After they send, CSW is open and Inbox/bot may reply free-form. Marketing **templates** still need fail-closed consent — the widget is not a silent opt-in for broadcasts unless the user completes an explicit opt-in flow.

Security: snippet should only encode the **display phone** of the selected number, never access tokens, App ID, or App Secret (Connect UX rule: users never see Meta App credentials).

### Verdict

| Call | What | Why |
|---|---|---|
| **GO** | Settings → WhatsApp: click-to-chat builder (`wa.me` + prefill + light branding + copy snippet), number locked to `whatsappNumberId` | Table-stakes vs AiSensy/Wati/Interakt; official WhatsApp link; inbound-positive for CSW; no template review |
| **DEFER** | Per-URL prefills, Shopify/Woo embeds, “open on load” bubble, multi-agent routing from widget | Extra surface; v1 snippet covers 80% |
| **NO-GO** | Hosted fake-WhatsApp web messenger; widget as broadcast opt-in; putting App ID/Secret in the snippet; one widget shared across all org numbers | Policy, isolation, and Connect UX |

---

## Summary table (for synthesis leaf)

| Surface | GO | DEFER | NO-GO |
|---|---|---|---|
| Retargeting | Status cohorts → next campaign; session send only if CSW open | Drips, click retarget, 7-day cap retry | Retry AMBIGUOUS / invalid numbers; free-form outside CSW |
| Template catalog | 3× UTILITY/AUTH library starter pack (`hi_IN`, `en_US`) | Marketing galleries, same-BM migrate API | Cross-tenant JSON copy as skip-review |
| Website widget | Settings `wa.me` button + prefill + snippet | Store plugins, per-page text | Fake in-page WhatsApp; credential leak |
