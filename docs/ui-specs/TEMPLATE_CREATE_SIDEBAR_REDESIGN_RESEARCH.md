# Template Create Sidebar — Research & Redesign Brief

> **Purpose:** Pre-implementation research for a full redesign of the **Create message template** SlideOver (`TemplateCreateForm` inside `SlideOver` on `TemplatesPage`).  
> **Audience:** Product + engineering. Use this as the single planning doc before pixel-perfect UI work.  
> **Status:** Implemented (Aug 2026) — 3-step wizard at `/templates/new`.  
> **Related docs:** `TEMPLATES_FRONTEND_DOCUMENTATION.md`, `WHATSAPP_API_DOCUMENTATION.md` §7, `COMPREHENSIVE_CAMPAIGNS_DOCUMENTATION.md`

---

## 1. Executive summary

The template create sidebar is the **highest-leverage UX surface** in Samyoj’s WhatsApp CRM because:

1. **Everything downstream depends on it** — Campaigns, Inbox (24h window), Flows (`template` nodes), Commerce, and test sends all consume *approved* templates.
2. **Meta approval is a gate** — ~30% of first submissions fail industry-wide; bad UX here wastes 24–48h review cycles and risks account-level utility restrictions.
3. **Variables are the personalization contract** — How we define `{{1}}` at create time determines how Campaigns and Inbox label/fill fields later.

**Redesign goal:** A guided, step-aware builder that feels like WATI/Interakt quality but is **tighter to Samyoj’s campaign + inbox + contact model** — not a generic Meta clone.

---

## 1A. Personalization research addendum (Aug 2026)

> **Update (shipped):** Phase A + Phase C purpose picker are now implemented end-to-end. See "Shipped personalization chain" at the end of this section.

User asked: how do businesses connect template variables to contacts for personalized broadcasts, without users needing to know `{{1}}` syntax.

### What the industry does

| Pattern | How it works | Who does it |
|--------|---------------|-------------|
| **Variable mapping** | Template stays positional `{{1}}`; a `variableMapping` object maps each position → contact field (`name`, `phone`, `email`, `company`) or a static value. Resolved per-recipient at send time. | Zernio (`variableMapping: { '1': { field: 'name' } }`) |
| **CSV column mapping** | Upload CSV → map columns to template variables → fallback value when blank (“Valued Customer”) | Mindlytics, WATI |
| **Custom attributes** | Contact model extended with `custom_attributes` JSON (snake_case: `order_id`, `city`, `customer_tier`, `last_purchase_date`). Templates reference `{{name}}`, `{{order_id}}`; send layer resolves. | Zaple, Edesy, WhatsCloud, Chatwoot |
| **Named parameters** | Meta supports `parameter_format: NAMED` with `{{first_name}}` directly in the template text. Clearer for users, but must be chosen at create time and used consistently end-to-end. | Meta native |
| **Purpose recipes** | Pre-built starters by intent (“Order shipped”, “Appointment reminder”, “OTP login”, “Offer code”) so users never write a template from scratch. | Interakt, WA.Expert library (200+), PayPerWA |

### Non-negotiable best practices (from research)

1. **Fallbacks for every variable** — blank CRM field → “Valued Customer” / “there”. Never send empty brackets.
2. **Cap ~4 variables per body** — more looks robotic and lowers approval odds.
3. **Samples must look real** — Meta reviewers reject placeholder-ish samples.
4. **No adjacent variables**, no variable at start/end, sequential numbering.
5. **Preview with real contact-shaped data** before submit and before first campaign.
6. **Utility ≠ marketing** — promo language in utility is the #1 rejection reason in India (₹0.13 utility vs ₹0.65 marketing per conversation).

### Current Samyoj gap (verified in code)

- `mergeTemplateParams` in `server/src/modules/campaigns/template-params.ts` only supports `{{name}}` substitution from `contact.name`. No generic field mapping.
- `Contact` model (`server/prisma/schema.prisma`) has only `name`, `email`, `phone`, `tags`, `notes` — **no custom attributes field**. So per-recipient personalization beyond name is impossible today without schema work.
- Campaign wizard fills `bodyParams` as static strings per campaign (same value for everyone) or `{{name}}` — there is **no “this variable = contact field X” UI**.
- Template wizard Review step already stores `variableMeta` (description, `suggestedSource: 'contact.name' | 'contact.phone' | 'custom'`) — but this metadata is **not passed to campaigns** and not persisted server-side.

**Conclusion:** the personalization contract exists in the wizard (`variableMeta.suggestedSource`) but is dead-end. The missing chain is:

```
Template create → variableMeta (field mapping per {{n}})
        ↓
Campaign wizard → shows "Customer name (auto per contact)" instead of raw input
        ↓
Send worker → resolve mapping per recipient from Contact + customAttributes
```

### Recommended architecture (build order)

**Phase A — contact field mapping (highest ROI, no schema change):**
1. Extend `TemplateVariableMeta.suggestedSource` → full mapping: `{ source: 'contact.name' | 'contact.phone' | 'contact.email' | 'static' | 'custom', staticValue?: string }`.
2. In template wizard Review step, add a **“Filled from”** dropdown per variable: *Customer name / Phone / Email / Same for everyone (static) / Custom per campaign*.
3. Persist `variableMeta` on the template row (new `MessageTemplate.variableMeta Json?` column) so campaigns can read it.
4. Campaign wizard: when a variable is mapped to a contact field, show a locked pill “Auto: customer name” instead of a text input; only `static`/`custom` variables show inputs.
5. `mergeTemplateParams`: accept a `fieldMapping` and resolve `contact.name`/`phone`/`email` per recipient at send time.

**Phase B — custom attributes (schema change):**
- `Contact.customAttributes Json?` + CSV import column mapping + template variables like `{{order_id}}` resolved from the map. Enables order/business-context personalization the user asked for.

**Phase C — no-code template UX:**
- **Purpose picker as step 0** (before the form): 6–8 cards (Order update, Appointment reminder, OTP, Offer code, Feedback, Welcome) that pre-fill category, body, variables with pre-mapped fields, and footer.
- **Visual variable insertion**: “Insert” chips (*Customer name*, *Order number*, *Date*) that place `{{1}}` at cursor AND set the mapping in one click — user never types brackets.
- **Library showcase**: promote the existing Meta library into the wizard’s step 0 as “Start from a proven template” tiles (approval-friendly by construction).

**Phase D — approval intelligence:**
- Approval-readiness score (0–100) on Review step from the checklist weights.
- Optional AI copy assist (Azure OpenAI already in stack) for “make this approval-friendly”.

### What to build first (this sprint)

1. Purpose/starter picker feeding the existing wizard (pure client, uses library + presets).
2. “Filled from” mapping dropdown per variable in Review step + persist `variableMeta` to template.
3. Campaign-side auto-fill of mapped variables (contact.name/phone/email) at send time in `mergeTemplateParams`.
4. Fallback values (`Valued customer`) when a mapped field is empty.

Everything else (custom attributes schema, named parameters, AI assist) is Phase B+ and should wait until the mapping chain proves out.

### Shipped personalization chain (this sprint — verified)

**Contract (no schema change):** a template variable's *source* is encoded as a token — `{{name}}`, `{{phone}}`, `{{email}}` — written into the variable's value. The server resolves each token against the actual contact at send time. This rides the existing `templateParams`/`variables` plumbing, so no DB migration was needed.

End-to-end single line:

```
Create step  → purpose picker pre-fills body + auto-maps vars (contact.name etc.)
             → insert chips add {{n}} at cursor AND set the mapping in one click
Review step  → "Filled from" dropdown per variable (Auto: name/phone/email | Same value | Manual)
Submit       → variableMeta saved to localStorage[samyoj_template_meta_<name>]
Campaign     → mapped vars render as locked "Auto: customer name" pill, value = token
Inbox        → same auto-fill + pill
Send (server)→ mergeTemplateParams / resolveInboxTemplateParams resolve token → contact field,
               empty name falls back to "Valued customer"
```

Files touched:
- Server: `campaigns/types.ts` (tokens + `sanitizeFieldToken`), `campaigns/template-params.ts` (`mergeTemplateParams` resolves tokens + contact context + fallback), `campaigns/template-validation.ts` + `service.ts` + `workers/index.ts` (pass phone/email), `inbox/routes.ts` (`resolveInboxTemplateParams`).
- Client: `utils/templateForm.ts` (tokens, presets, `load/saveTemplateVariableMeta`, `applyPurposePreset`), wizard `CreateStep` (purpose picker + insert chips), `ReviewStep` ("Filled from" dropdown), `TemplateWizardPage` (persist meta), `CampaignMessageStep` (auto-pill + token fill), `inbox/TemplateComposer` (auto-fill + pill).

**Known limit:** `variableMeta` persists in browser `localStorage` (per template name), so the auto-pill appears on the device where the template was created. Campaign *sending* still works everywhere because tokens are stored in the campaign params themselves. Move `variableMeta` to a server column when cross-device authoring is needed (Phase B).

### Recheck pass (post-implementation audit — bugs found & fixed)

A skeptical re-read of the shipped chain caught 4 real bugs, all fixed and re-verified (`tsc` clean, 51 campaign tests pass, client build green):

1. **Inbox first-send used raw tokens (Critical).** The first `deliverOutboundMessage` passed `data.templateParams` (raw `{{name}}`) — only the stored metadata was resolved. A first send would show "Valued customer" while a *retry* showed the real name. → Now resolves once into `resolvedTemplateParams`, used for both metadata and the live send (`inbox/routes.ts`).
2. **Positional misalignment from empty filtering (Critical).** `resolveToken` returned `''` for empty phone/email, then `.filter(v => v !== '')` dropped the entry and shifted every later `{{n}}` one slot left (Meta params are positional). → Replaced with in-place non-empty fallbacks (`your registered number` / `-`); never filter mid-array (`template-params.ts`).
3. **Campaign auto-fill clobbered user values (High).** The effect overwrote any non-token value, so reopening an edited campaign with a deliberate static value lost it. → Now only fills empty slots; user input always wins (`CampaignMessageStep.tsx`).
4. **Previews rendered raw `{{name}}` (Medium UX).** `getFilledTemplatePreview` substituted the token literally. → Added `previewParams`/`TOKEN_PREVIEW_SAMPLE` so previews show "Rahul", "+91 98765 43210" while the send path keeps the token (campaign + inbox + server `applyTemplateParamsToPreview`).

Also closed: **header-variable parity** (header "Filled from" now auto-fills + pills in campaign and inbox, not just body), and **test-send context** (`sendTestMessage` now passes name/phone/email so tokens resolve against the real test contact).

### Template library redesign (Aug 2026)

The old library lived in a cramped SlideOver with **invalid Meta filter enums** (Healthcare / Education / Travel industries, and use cases like `CONFIRMATION` / `REMINDER` that Graph does not accept — those filters returned empty).

Replaced with a full-page wizard at `/templates/library` using the same chrome as create-template:

1. **Browse** — Meta library vs your templates, official filters only (Industry: `E_COMMERCE` | `FINANCIAL_SERVICES`; Topic: `ACCOUNT_UPDATE` | `CUSTOMER_FEEDBACK` | `ORDER_MANAGEMENT` | `PAYMENTS`; 23 official use cases). Live WhatsApp preview with Meta `body_params` samples filled in.
2. **Review** — name, required URL/phone button inputs (Meta rejects clones without them), variable table with inferred **Filled from** mapping from `body_param_types` (PHONE → contact.phone, EMAIL → contact.email, name-like TEXT → contact.name).
3. **Submit** — `POST /from-library` for Utility clones; Authentication / account templates open in the editor. FLOW/form templates warn that customizing drops the form.

Sidebar library UI removed. Create-wizard purpose picker now has a **Meta library** tile.

---



**Non-goals for v1 redesign:**
- Carousel / MPM / Catalog / Flow buttons (Meta supports; Samyoj send path does not yet).
- Named parameters (`{{customer_name}}`) unless we migrate campaigns + server send path together.
- Local draft storage separate from Meta (Meta has no true draft API; “draft” = unsaved form state only).

---

## 2. Current Samyoj implementation audit

### 2.1 UI shell

| Piece | File | Notes |
|-------|------|-------|
| Page + open/close | `client/src/pages/TemplatesPage.tsx` | `SlideOver` size `lg` (~32rem), violet accent |
| Form body | `client/src/components/templates/TemplateCreateForm.tsx` | Single long scroll; preview at bottom |
| Buttons | `client/src/components/templates/TemplateButtonEditor.tsx` | Functional but dense |
| Validation | `client/src/utils/templateUtils.ts` | Client-side issues list |
| Payload | `client/src/utils/templateForm.ts` | `buildCreatePayload`, `syncFormExamples` |
| Server build | `server/src/modules/templates/builder.ts` | Maps form → Meta components |
| Server validate | `server/src/modules/templates/types.ts` | Zod `createTemplateSchema` |
| Rejection help | `client/src/utils/templateRejectionGuide.ts` | Used in detail panel, **not** in create form |
| Library entry | `client/src/components/templates/TemplateLibraryPanel.tsx` | Pre-fills form via `formFromLibraryEntry` |

### 2.2 What works today

- Full component coverage for **standard marketing/utility**: header (text/media), body, footer, buttons (QR/URL/phone/copy-code).
- **Authentication** category with `add_security_recommendation` + OTP button via `builder.ts`.
- **Live WhatsApp preview** with sample substitution (`getFilledTemplatePreview`).
- **Header media upload** → Meta resumable upload handle (`POST /api/templates/upload-header`).
- **`allow_category_change: true`** on create/resubmit/library (reduces hard rejects).
- Category-specific callouts (marketing STOP, utility transactional, auth OTP).
- Variable sample sync when body/header changes (`syncFormExamples`).
- Resubmit flow for rejected/paused templates.

### 2.3 UX pain points (why redesign)

| Issue | Impact |
|-------|--------|
| **Flat scroll form** | No sense of progress; approval-critical steps (category, samples) buried mid-page |
| **Preview at bottom** | User doesn’t see WhatsApp render while editing body (competitors: sticky split) |
| **Numeric-only variables** | `{{1}}` is Meta-valid but opaque; Campaigns already guess labels (`CampaignMessageStep`) |
| **No inline variable insertion** | Users paste wrong `{{}}` syntax; errors appear only at submit |
| **No approval checklist** | Competitors show pass/fail gates before submit |
| **authType / ONE_TAP hidden** | Server supports `authType`; UI never exposes ONE_TAP + package/signature |
| **No purpose selector** | User doesn’t pick “for campaign / inbox / OTP” → wrong category |
| **Errors at bottom** | Validation errors easy to miss above sticky footer |
| **No connection preview** | Doesn’t show how variables map to Contact fields in Campaigns |
| **Rejection guide absent** | Rich `templateRejectionGuide` only on detail view, not during create |
| **Default headerFormat `TEXT`** | Empty text header vs `NONE` confuses; mock likely expects explicit “No header” |
| **Panel width `lg`** | Tight for split preview; competitors use wider or full-screen on desktop |

### 2.4 Backend gaps (affect redesign scope)

From `docs/WHATSAPP_API_DOCUMENTATION.md` + code grep:

| Capability | Server | UI create | Send (campaign/inbox) |
|------------|--------|-----------|------------------------|
| Positional `{{1}}` | ✅ | ✅ | ✅ |
| Named `{{name}}` | Partial | ❌ | Campaign merge supports `{{name}}` in *values*, not template text |
| FLOW button | ❌ | ❌ | ❌ |
| CATALOG / MPM | ❌ | ❌ | ❌ |
| Carousel template | ❌ | ❌ | ❌ |
| Call permission request | ❌ | ❌ | ❌ |
| URL button `example` array | ❌ builder | ❌ | — |
| `message_template_status_update` webhook | Partial | — | Live badge refresh |
| `template_category_update` webhook | ❌ | — | Pricing surprise |
| DISABLED resubmit | Check routes | — | User dead-end |

---

## 3. Meta rules reference (creation)

Source: [Meta template guidelines](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines/), [components](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components), internal `WHATSAPP_API_DOCUMENTATION.md` §7.

### 3.1 Categories

| Category | Use | Samyoj hint |
|----------|-----|-------------|
| **UTILITY** | Post-purchase, account, shipping, reminders | Cheaper; must not sound promotional |
| **MARKETING** | Offers, re-engagement, broadcasts | Footer opt-out strongly recommended |
| **AUTHENTICATION** | OTP / verification | Auto security line; 1 OTP button; fast auto-approval |

**Critical:** Repeated utility misclassification can trigger **7–30 day** restrictions on new utility submissions (industry reports). UI must steer users away from “utility for sales.”

### 3.2 Hard limits

| Field | Limit |
|-------|-------|
| Template name | `a-z0-9_`, max 512 |
| Body | 1024 chars, ≤10 variables |
| Header text | 60 chars |
| Footer | 60 chars |
| Button label | 25 chars |
| Buttons total | 10 (auth: 1 OTP) |
| URL buttons | max 2 |
| Phone buttons | max 1 |
| Copy-code buttons | max 1 |
| Media sample upload | 16 MB (Samyoj enforced) |
| Templates per WABA | 250 |

### 3.3 Variable rules (positional — our current model)

1. Format: `{{1}}`, `{{2}}`, … sequential, no gaps.
2. **Cannot** start or end body/header with a variable.
3. **Cannot** place variables adjacent without separating text (`{{1}}{{2}}` → reject).
4. **Must** provide `example` / sample values for every variable at submit.
5. Avoid “variable-only” body (mostly placeholders) — common reject.
6. Named format (`{{first_name}}`) is supported by Meta but requires `parameter_format: NAMED` on create — **not in our builder today**.

### 3.4 Button ordering

- CTA group first: URL, PHONE_NUMBER, COPY_CODE
- Then QUICK_REPLY group
- No interleaving (we validate this client-side ✅)

### 3.5 Approval timeline

- Authentication: often minutes (auto)
- Utility / Marketing: human review, typically **minutes to 48 hours**
- Status: `PENDING` → `APPROVED` | `REJECTED` | later `PAUSED` | `DISABLED`

### 3.6 Common API errors at send time (inform variable UX)

| Code | Meaning | Design implication |
|------|---------|-------------------|
| `132000` | Param count mismatch | Show variable count prominently at create + campaign |
| `132001` | Template not found / wrong language | Language picker + “one template per language” education |
| `132012` | Param format mismatch | Positional vs named consistency |
| `131049` | Marketing limit per user | Campaign warning, not create |
| `131047` | Outside 24h window | Inbox explains template requirement |

---

## 4. Top rejection reasons & how to prevent in UI

Synthesized from Meta docs, Telnyx, AiSensy, Chakra guides, and `templateRejectionGuide.ts`.

| Rank | Reason | Prevention in create UI |
|------|--------|-------------------------|
| 1 | Missing sample values | Block submit; inline per-variable fields tied to preview |
| 2 | Category mismatch (promo in utility) | Category wizard + content linter (we have warning ✅, need stronger) |
| 3 | Variables at start/end | Real-time lint on body/header |
| 4 | Adjacent variables | Lint: require ≥1 char between `}}` and `{{` |
| 5 | Misleading marketing / no opt-out | Marketing footer template chips (“Reply STOP to unsubscribe”) |
| 6 | URL shorteners / bad domains | Warn on `bit.ly`, `wa.me`, non-HTTPS |
| 7 | Button order / limits | Disable invalid button types in UI |
| 8 | Language ≠ content | Flag Hindi text + `en_US` language |
| 9 | Media header without sample | Already blocked ✅ |
| 10 | Duplicate name | Check against local template list before submit |
| 11 | Too many emojis / odd whitespace | Lint pasted content (BSPs enforce ~10 emoji cap) |
| 12 | Generic/spam tone | Copy tips + “read aloud” helper |

**Failure presentation principle:** Never show raw Meta JSON. Map to `getTemplateRejectionGuide()` categories with **one primary fix** + expandable detail.

---

## 5. Competitor UX patterns (WhatsApp CRM BSPs)

### 5.1 WATI

- Visual template builder with **Add Variable** button (inserts at cursor).
- Maps variables to **contact attributes** at send time (`{{name}}` style in their docs — may use named or positional depending on account).
- Category picker with examples per category.
- **AI Template Assistant** for approval optimization (differentiator).
- Rich media + button types in same screen; preview alongside.
- Strong emphasis: submit only from BSP (not WhatsApp Manager) for sync.

**Takeaway for Samyoj:** Variable insertion UX + attribute mapping labels at campaign time; optional AI copy assist later.

### 5.2 Interakt

- Shopify-centric templates (order shipped, cart abandoned) as **starting recipes**.
- Template tied to automation triggers.
- Clear utility vs marketing separation for D2C.

**Takeaway:** Purpose-based starters (“Order update”, “Appointment reminder”) linking to library.

### 5.3 AiSensy

- Broadcast-first; template + audience in one mental model.
- Flow builder add-on for post-template engagement.

**Takeaway:** After create success → “Use in campaign” CTA (we have on detail ✅; should appear post-submit).

### 5.4 Gallabox

- Strong analytics on template performance.
- Template quality visibility.

**Takeaway:** Post-approval quality score education in create sidebar footer.

### 5.5 Common patterns to adopt

1. **Split layout:** form left, sticky WhatsApp preview right (desktop).
2. **Stepper or sections:** Basics → Content → Variables → Buttons → Review.
3. **Approval checklist** on final step (green ticks).
4. **Variable chips** with human labels stored in form metadata (even if Meta gets `{{1}}`).
5. **Template recipes** from Meta library + “Your past templates.”
6. **Category explainer** with price/approval implications (India SMB cares about utility pricing).

---

## 6. User purposes & journeys

Templates are not one-size-fits-all. The create sidebar should ask **intent** early (can be subtle cards, not a new API).

| Intent | Category | Typical components | Downstream in Samyoj |
|--------|----------|-------------------|----------------------|
| **Campaign broadcast** | Marketing | Body + optional image + URL button + STOP footer | `CampaignMessageStep` → bodyParams |
| **1:1 Inbox reopen** | Utility or Marketing | Short body, 1–2 vars | `TemplateComposer` → contact name in `{{1}}` |
| **Order / account update** | Utility | Body + track URL button | Campaigns + automations |
| **OTP / login** | Authentication | Body `{{1}}` code + copy button | Auth integrations (future) |
| **Offer code** | Marketing | COPY_CODE button | `couponCode` in `template-params.ts` |
| **Appointment reminder** | Utility | Date/time vars | Calendar integrations |

### 6.1 Variable → contact field mapping (recommended metadata)

Store **per-variable labels** in form state (client-only until we extend API):

```ts
interface TemplateVariableMeta {
  index: number;           // 1-based
  label: string;           // "Customer name" (UI + campaigns)
  suggestedSource?: 'contact.name' | 'contact.phone' | 'custom' | 'order_id';
  sample: string;          // maps to bodyExamples[i]
}
```

Campaigns already uses fallback labels (`CampaignMessageStep.getVariableLabel`). Unifying at **create time** makes campaign personalization obvious.

### 6.2 Personalization best practices to embed

1. **Anchor variables in sentences** — “Hi {{1}}, …” not “{{1}} {{2}} {{3}}”
2. **Max 3–4 variables** for approval odds unless transactional needs more.
3. **Use header for brand**, body for facts, footer for compliance.
4. **URL variables:** only **one** dynamic suffix on URL button (`.../track/{{1}}`).
5. **Test send** immediately after approval with real contact-shaped samples.

---

## 7. Integration map (must stay consistent in redesign)

```
TemplateCreateForm
    ↓ buildCreatePayload
POST /api/templates → builder.ts → Meta createMessageTemplate
    ↓ APPROVED
    ├─ Campaigns: CampaignTemplatePicker + CampaignMessageStep (bodyParams/headerParams/headerMediaUrl/couponCode)
    ├─ Inbox: TemplateComposer + TemplatePicker (approved cache)
    ├─ Flows: template node (reference by name)
    ├─ Reports: template analytics
    └─ Detail: test send, duplicate, resubmit, delete, usage stats
```

**Redesign must not break:**
- `buildCreatePayload` shape
- `validateTemplateForm` / server Zod parity
- `getFilledTemplatePreview` for preview
- Library pre-fill (`formFromLibraryEntry`)
- Resubmit mode (`mode === 'resubmit'`, name locked)

---

## 8. Proposed information architecture (redesign)

### 8.1 Layout options

**Recommended: Option B — Sectioned single panel with sticky preview**

```
┌─────────────────────────────────────────────────────────────┐
│ Create message template · Sent for review after submit      │
├──────────────────────────────┬──────────────────────────────┤
│ [Step tabs or accordion]     │  Live WhatsApp preview       │
│                              │  (sticky, updates live)      │
│ 1. Purpose & category        │                              │
│ 2. Name & language           │                              │
│ 3. Message (header/body/     │                              │
│    footer)                   │                              │
│ 4. Variables & samples       │                              │
│ 5. Buttons (optional)        │                              │
│ 6. Review & checklist        │                              │
├──────────────────────────────┴──────────────────────────────┤
│ Cancel                          Submit for review           │
└─────────────────────────────────────────────────────────────┘
```

- **Desktop:** `SlideOver` size `2xl` or custom `min(100vw, 56rem)` with split columns.
- **Mobile:** Preview collapses to expandable drawer above submit.

### 8.2 Section content spec

#### Step 1 — Purpose & category
- 3 cards: Transactional (Utility) / Promotion (Marketing) / Verification (Auth)
- One-line price + approval note per card
- Selecting card sets `category` and default body placeholder

#### Step 2 — Identity
- Template name + language (searchable)
- Duplicate name warning from loaded templates list
- Link: “Browse library instead”

#### Step 3 — Message
- Header type segmented control (None | Text | Image | Video | Document)
- Body textarea with **Insert variable** toolbar
- Character counters (body 1024, header/footer 60)
- Footer with marketing quick-insert chips

#### Step 4 — Variables
- Auto-detected from body/header text
- Each row: `{{n}}` · Label input · Sample input · optional “Maps to” (Contact name, etc.)
- Live preview substitution per row

#### Step 5 — Buttons
- Simplified: start from presets (“Track order URL”, “Call support”, “Yes/No replies”)
- Advanced: current `TemplateButtonEditor`

#### Step 6 — Review
- Checklist (all samples filled, category appropriate, footer for marketing, etc.)
- Read-only preview
- Estimated review time badge

### 8.3 Resubmit mode differences
- Skip purpose if category locked
- Show rejection reason + `getTemplateRejectionGuide` at top
- Highlight fields related to rejection category
- Submit label: “Resubmit for review”

---

## 9. Feature recommendations (prioritized)

### P0 — Must ship in redesign
- [ ] Split layout with **sticky preview** (desktop)
- [ ] **Section/step navigation** with validation per section
- [ ] **Inline variable linter** (start/end, sequential, adjacent)
- [ ] **Variable rows** with label + sample + preview highlight
- [ ] **Approval checklist** on review step; block submit if errors
- [ ] **Scroll-to-error** on failed validation
- [ ] Default `headerFormat: 'NONE'` for new templates
- [ ] Post-submit success: “View template” + “Use in campaign” links
- [ ] Surface **rejection guide patterns** as proactive tips (category, marketing footer)

### P1 — High value, soon after
- [ ] **Purpose/recipe starters** (5–8 presets + library link)
- [ ] **Variable metadata** persisted client-side → passed to campaigns as defaults
- [ ] **Duplicate name check** before API call
- [ ] **Emoji / whitespace / URL shortener** lint rules
- [ ] Authentication **ONE_TAP** fields (package_name, signature_hash) for Android autofill
- [ ] Widen panel + match pixel mock from user reference images
- [ ] **Real-time approval score** (simple heuristic: 0–100 based on rules)

### P2 — Strategic differentiators
- [ ] **AI copy assist** (category-aware, reduce rejection) — Azure OpenAI already in stack
- [ ] **Named parameters** end-to-end (`parameter_format: NAMED`) with migration
- [ ] Template webhook-driven **live status** in sidebar after submit
- [ ] **Category change alert** when `template_category_update` fires
- [ ] FLOW / Catalog buttons when send path exists
- [ ] **Carousel** marketing templates
- [ ] Per-template **usage hints** (“Used in 3 campaigns”) during create from duplicate

### P3 — Enterprise / partner
- [ ] Multi-language variant wizard (create `en_US` + `hi_IN` in one flow)
- [ ] Central/portfolio templates for partners
- [ ] Template A/B variants linked to campaigns

---

## 10. Error & failure UX playbook

### 10.1 During create (client validation)
- Show issue next to field + in review checklist
- Severity: **error** (block) vs **warning** (allow with confirm)
- Use plain language from `messagingConsent` / `plainLanguage.ts`

### 10.2 On API error (submit)
| API message | User-facing copy |
|-------------|------------------|
| Name taken | “A template named `x` already exists. Try `x_v2`.” |
| Invalid component | “WhatsApp rejected the message format. Check variables and buttons.” |
| Rate limit | “Too many submissions. Wait a few minutes and try again.” |
| WABA limit 250 | “Template limit reached. Delete unused templates first.” |

### 10.3 After reject (detail + resubmit)
- Show `rejected_reason` verbatim (collapsed if long)
- `getTemplateRejectionGuide()` → title + fixes list (already built ✅)
- CTA: Edit & resubmit (pre-fill form)

### 10.4 After pause / disabled
- `getTemplateStatusHelp()` + pause campaigns using template
- DISABLED: explain **new template required**, not resubmit

---

## 11. Content & copy principles

1. **Lead with outcome** — “Customers will see this in WhatsApp” not “Body component.”
2. **Approval-first** — Every screen answers “Will Meta approve this?”
3. **Connect to campaigns** — “You’ll fill {{1}} with each customer’s name when sending.”
4. **India-aware** — Hindi/English language list; DPDP/consent references where marketing.
5. **No developer jargon** — Hide `headerMediaHandle`, show “Sample image uploaded.”

---

## 12. Technical notes for implementation

### 12.1 Files to touch
- `TemplateCreateForm.tsx` — main redesign
- New: `TemplateCreateWizard.tsx`, `TemplateVariableEditor.tsx`, `TemplateApprovalChecklist.tsx` (suggested)
- `TemplatesPage.tsx` — SlideOver size, footer validation gate
- `templateForm.ts` — optional `variableMeta[]`
- `templateUtils.ts` — adjacent-variable lint, emoji count, duplicate name helper
- `SlideOver.tsx` — optional `wide` / split layout prop

### 12.2 Keep API contract stable
`buildCreatePayload` output must remain compatible with `createTemplateSchema` unless server updated in same PR.

### 12.3 Testing checklist
- Create utility with 2 body vars + URL button
- Create marketing without footer → warning, with footer → pass
- Create auth with security recommendation on/off
- Media header upload + preview
- Resubmit rejected template
- Library → create form pre-fill
- Duplicate template → `_copy` name
- Campaign send after create with same variable count
- Inbox template send with header media URL

---

## 13. Open questions for product sign-off

1. **Named vs positional variables** — Invest in named for v1 redesign or stay positional with better labels?
2. **Panel width** — Full `2xl` split vs full-screen modal on desktop?
3. **AI assist** — In scope for v1 or fast-follow?
4. **Draft saving** — LocalStorage draft for long forms (Meta has no server draft)?
5. **Role gating** — Enforce `Templates` permission on create button?
6. **User mock images** — Confirm final pixel reference for sidebar (user mentioned images; align in implementation pass).

---

## 14. Suggested implementation phases

| Phase | Deliverable | Est. scope |
|-------|-------------|------------|
| **Phase 1** | Layout split + sticky preview + section nav | UI only |
| **Phase 2** | Variable editor + linter + checklist | UI + `templateUtils` |
| **Phase 3** | Purpose presets + improved button UX | UI |
| **Phase 4** | Post-submit flow + campaign CTA + resubmit integration | `TemplatesPage` |
| **Phase 5** | P1 items (ONE_TAP, AI assist, metadata → campaigns) | Cross-module |

---

## 15. References

### Internal
- `docs/ui-specs/TEMPLATES_FRONTEND_DOCUMENTATION.md`
- `docs/WHATSAPP_API_DOCUMENTATION.md` §7–§9
- `docs/campaigns/COMPREHENSIVE_CAMPAIGNS_DOCUMENTATION.md`
- `client/src/utils/templateRejectionGuide.ts`
- `server/src/modules/campaigns/template-validation.ts`

### Meta
- [Template guidelines](https://developers.facebook.com/docs/whatsapp/message-templates/guidelines/)
- [Send message templates](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates)
- [Error codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)

### Industry
- Telnyx template guide (sample values #1 rejection)
- Chakra / AiSensy approval guides (category misclassification enforcement)
- WATI help center (variable insertion, contact attributes)

---

*End of research brief. Ready for pixel-perfect UI implementation once user confirms mock images and P0 scope.*
