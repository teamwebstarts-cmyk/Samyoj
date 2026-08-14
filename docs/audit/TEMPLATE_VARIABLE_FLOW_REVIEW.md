# Template → Campaign → Inbox → Contact — Complete Flow Review

**Date:** 2026-08-14  
**Mode:** Research + code audit, then implementation of §12 (see §16).  
**Audience:** Product + engineering.  
**Companion canvas:** `template-variable-flow-review.canvas.tsx` (open beside chat).

This document answers: after a template is approved, does it actually work in Campaigns and Inbox with the right variables, contact data, tags, and UI? What is missing if we want a generic, CRM-grade personalization chain?

---

## 1. Verdict

The **create / library / preview** side is usable. The **send** side is not trustworthy for the personalization we just shipped.

Wizard and library can map `{{1}}` → customer name / phone / email. Campaigns and Inbox can show “Auto-filled from contact.” The worker and campaign start path then **reject that mapping**:

1. Campaign start **hardcodes template category `MARKETING`**, so a Meta-library **Utility** template cannot start a campaign at all.
2. The campaign worker **validates unmerged `{{name}}` tokens** as “unresolved placeholders,” so a campaign that *does* start with contact tokens can fail the whole batch.
3. Variable mapping lives only in **browser `localStorage`**. Another user, browser, or device does not see it. The server has no `variableMeta`.
4. Contacts only have **name, email, phone, tags, notes**. There is no `order_id`, city, or custom field. Tags select *who* gets a campaign; they are **not** template variables. Conversation **labels** are a separate Inbox-only object.

**Overall: 5/10** — demo-looking UI on create + campaign fill; send path can break the exact feature we told users was ready.

---

## 2. Scores (honest, current code)

| Area | Score | Why |
|------|------:|-----|
| Template create + library UX | 7/10 | Wizard, library one-click, purpose presets, Review “Filled from” exist. Mapping not on the server. |
| Variable contract (create → send) | 4/10 | Tokens `{{name}}` / `{{phone}}` / `{{email}}` are designed; persistence is localStorage-only. |
| Campaign start + worker | 3/10 | Category forced to MARKETING. Worker asserts unmerged tokens. Recipients have no email. Live contact name/email not re-fetched at send. |
| Campaign wizard UI | 6/10 | Picker, auto-pills, preview, edit on draft/scheduled. Labels are marketing-biased. Review shows raw `{{name}}`. No coupon / dynamic URL fields. |
| Inbox template send | 6/10 | Resolves tokens against the open contact. `filter(Boolean)` can shift positional params. Labels are `Body {{1}}`, not the wizard description. |
| Contacts / profile | 5/10 | Name, email, phone, tags, notes, opt-in work. No custom attributes. Tags ≠ template variables. |
| Tags vs labels | 4/10 | Tags = campaign audience. Labels = conversation chrome. Neither can fill `{{n}}`. Product never explains the difference. |
| Flows / automations template node | 3/10 | Sends template **name only**, no `templateParams`. Variable templates will fail or send empty components. |
| Test send | 4/10 | Does not resolve tokens from the test phone’s contact. Same `filter(Boolean)` shift. |
| Tests | 5/10 | `mergeTemplateParams` covers `{{name}}` in a string. No test for whole-value tokens, MARKETING category trap, or worker pre-assert. |
| Docs honesty (`FEATURE_MATRIX`) | 3/10 | Templates 9/9 DONE. Still names deleted `TemplateLibraryPanel`. Variable persistence marked done by implication. |

---

## 3. How the chain is supposed to work

```
Template wizard / library
  → Meta stores the template on the WABA (positional {{1}}, {{2}})
  → Browser saves variableMeta in localStorage (samyoj_template_meta_<name>)
  → Campaign / Inbox read localStorage, write tokens {{name}} / {{phone}} / {{email}}
      into campaign.templateParams or inbox send payload
  → Server mergeTemplateParams / resolveInboxTemplateParams
      replaces tokens from Contact.name / phone / email
  → buildTemplateComponents → Meta Cloud API send
```

**What Meta actually stores:** only the approved copy with `{{1}}`. Meta does not know about Samyoj “Filled from.”  
**What Samyoj must store:** which `{{n}}` is name vs order id vs static campaign text. Today that lives in the browser, not Postgres.

---

## 4. Inventory — what already exists

### 4.1 Contact fields (source of truth)

`Contact` in `server/prisma/schema.prisma`:

| Field | In UI | Usable as template variable today? |
|-------|-------|--------------------------------------|
| `phone` / `normalizedPhone` | Yes | Yes, if mapped (`{{phone}}`) |
| `name` | Yes | Yes, if mapped (`{{name}}`); empty → `"Valued customer"` |
| `email` | Yes | Token exists; **campaign recipient row has no email**, worker does not pass it |
| `tags` | Yes (Contacts + Inbox) | **Audience only** (who to send). Not a `{{n}}` value |
| `notes` | Yes | No |
| `optedIn` + consent | Yes | Gate for campaigns, not a variable |
| Custom attributes (`order_id`, city, …) | **No column** | **Impossible** without schema work |

Conversation **labels** (`ConversationLabel`) live on the **chat**, not the person. Inbox details panel has both Tags and Labels. Campaigns never see labels.

### 4.2 Token contract (client)

`client/src/utils/templateForm.ts`:

- `suggestedSource`: `contact.name` \| `contact.phone` \| `contact.email` \| `custom`
- Written into params as `{{name}}` / `{{phone}}` / `{{email}}`
- Saved with `localStorage.setItem('samyoj_template_meta_' + name)`
- Preview swaps tokens for sample “Rahul” so the phone mock does not show raw braces

### 4.3 Token contract (server)

`server/src/modules/campaigns/types.ts` `sanitizeFieldToken`: only those three contact fields.  
`mergeTemplateParams` (`template-params.ts`): whole-value token → contact value; also still supports legacy `Hello {{name}}` inside a longer string. Empty values become `'-'` in place (does **not** filter — correct for positional Meta params).

Inbox: `resolveInboxTemplateParams` in `server/src/modules/inbox/routes.ts` does the same against `conversation.contact`.

### 4.4 Where templates are sent

| Surface | Resolves contact tokens? | Notes |
|---------|--------------------------|--------|
| Campaign worker | Intended yes, after merge | Pre-loop assert runs on **unmerged** params (break) |
| Campaign start validation | Yes (merge first) | Then forces category MARKETING (break for Utility) |
| Campaign test send | Yes (looks up contact) | Same MARKETING category assert |
| Inbox composer | Yes (on the open contact) | Client may drop empty slots |
| Template detail test send | **No** | `buildTemplateComponents` only; tokens scrub to fallbacks, not the test contact |
| Flow `template` node | **No params** | Name + language only |
| Settings | **Nothing** | No org-default mappings |

---

## 5. Confirmed working (evidence)

- Approved templates list in campaigns: `CampaignWizardPage` loads `templateApi.list({ status: 'APPROVED', all: 'true' })`.
- Draft / scheduled campaigns are editable; running / completed are not (`canEditCampaign`).
- Campaign payload keeps positional arrays (no `.filter(Boolean)` on save) — `buildCampaignPayload` sends `body: form.bodyParams`.
- Inbox first-send uses `resolvedTemplateParams` for both message metadata **and** `deliverOutboundMessage` (`inbox/routes.ts` ~1463 and ~1516).
- `mergeTemplateParams` does not drop empty slots (`.map` + `'-'`).
- Contact tags power campaign audience `TAGS` (`resolveAudienceRecipients` `tags: { hasSome }`).
- Library clone can return APPROVED and deep-link `/campaigns/new?template=`.
- Preview in campaign message step uses `previewParams` so the mock shows “Rahul” not `{{name}}`.

---

## 6. Critical / High

### C1. Utility (and Auth) templates cannot start a campaign

**Why it matters:** We just told users Meta library templates are “ready to use in Campaigns.” Library is Utility + Authentication only. Start path requires category `MARKETING`.

**Evidence:**

```788:788:server/src/modules/campaigns/service.ts
    })), { name: campaign.templateName, language: templateLanguage, category: 'MARKETING' });
```

Same hardcoded `'MARKETING'` at `service.ts` 942, 1111, 1231 and `workers/index.ts` 370, 538.  
`templateValidationErrors` compares `template.category` to that value.

**Fix:** Pass `template.category` (the approved Meta category). Bill/quota category can stay a separate policy if product wants campaigns billed as marketing — do **not** reuse that for Meta template-shape checks.

**Verify:** Create a library Utility template, start a campaign, confirm start is 200 and worker sends.

---

### C2. Worker rejects contact tokens before merge

**Why it matters:** Mapping name → `{{name}}` is the whole personalization feature. The worker validates **campaign-level** params first, while they still contain `{{name}}`.

**Evidence:**

```367:372:server/src/workers/index.ts
    assertApprovedCampaignTemplate(templateMeta, {
      name: templateName,
      language: lang,
      category: 'MARKETING',
      params: templateParams,  // unmerged — still {{name}}
    });
```

`template-validation.ts` 66–68: any `{{...}}` in values → `"unresolved placeholders; provide recipient data before sending"`.

Per-recipient merge happens **later** (line 527). The batch never gets there if the pre-assert throws.

**Fix:** Delete the pre-loop assert, or assert only name/language/APPROVED (no param body), and keep the per-recipient assert **after** `mergeTemplateParams`.

**Verify:** Campaign with bodyParams `['{{name}}']` against a `Hi {{1}}` template sends “Hi Rahul” to a named contact, not a job-level configuration failure.

---

### C3. Variable mapping is not on the server

**Why it matters:** Agent A creates the template. Agent B (or the same person on phone) opens Campaigns. `loadTemplateVariableMeta` returns `[]`. They see empty required fields, type a **static** name, and every recipient gets the same word. Or they cannot continue.

**Evidence:** `saveTemplateVariableMeta` / `loadTemplateVariableMeta` in `client/src/utils/templateForm.ts` (localStorage only). No Prisma field on templates (templates are Meta-hosted; no local `MessageTemplate` table).

**Fix (Phase B):** Persist mapping per org + template name + language, e.g. `TemplateVariableMap { organizationId, name, language, meta Json }`. Campaigns/Inbox load from API. Tokens in `campaign.templateParams` remain the send contract so old campaigns still work.

**Verify:** Create mapping in browser A, open campaign wizard in browser B (cleared storage), auto-pills still appear.

---

### H1. Inbox (and test-send) drop empty positional params

**Why it matters:** Meta body parameters are positional. Filtering empties shifts `{{2}}` into `{{1}}`.

**Evidence:**

```139:143:client/src/components/inbox/TemplateComposer.tsx
        body: bodyParams.filter(Boolean),
        header: headerParams.filter(Boolean),
```

Same pattern: `TemplateDetailPanel.tsx` 68–69.

Campaign save path does **not** do this. Inbox / test-send do.

**Fix:** Send the full array; server already replaces empty with `'-'`. Do not `.filter(Boolean)`.

---

### H2. Campaign recipient has no email; worker does not reload contact name/email

**Why it matters:** `{{email}}` in a campaign cannot resolve. Name is a snapshot from audience resolve; if the contact is renamed later, the campaign still uses the old name. Worker contact lookup selects **consent only**, not `name` / `email`.

**Evidence:**

- `CampaignRecipient`: `phone`, `name`, `variables` — no email (`schema.prisma` ~1053).
- `resolveAudienceRecipients` selects `{ phone, name }` (groups) or `{ phone, name, consent… }` — **not email**.
- Worker merge: `{ name: recipient.name, phone: recipient.phone }` — no email (`workers/index.ts` ~527–532).
- Worker contact select: consent fields only (~389–392).

**Fix:** Select `name, email, phone` on the live contact at send time and pass that into `mergeTemplateParams`. Optionally add `email` on the recipient row.

---

### H3. Campaign variable labels ignore wizard descriptions

**Why it matters:** Utility `{{2}}` is often order id. The campaign form labels empty slots as “Business name / Offer discount / Offer valid till / Promo code”.

**Evidence:** `CampaignMessageStep.tsx` `fallbackVariableLabels` and `getVariableLabel` — uses named `{{foo}}` in body text, else those four marketing strings. Never `templateMeta[i].description`.

Inbox uses `Body {{1}}` / `Header {{1}}` — also ignores descriptions.

**Fix:** Prefer `variableMeta.description`, then inferred text around `{{n}}`, then a generic “Variable n”.

---

### H4. Flow template node sends no variables

**Why it matters:** Automations can pick an approved template. If that template has `{{1}}`, Meta send has no body parameters.

**Evidence:** `flows/engine.ts` `case 'template'`: `sendFlowMessage(..., { templateName, templateLanguage })` — no `templateParams`. `deliverOutboundMessage` only builds components when `templateParams` is present.

**Fix:** Reuse the same mapping + `mergeTemplateParams` with the conversation contact. Block publishing a template node that has unmapped required variables.

---

### H5. Copy-code (coupon) and dynamic URL buttons missing in campaigns

**Why it matters:** Marketing templates often have a COPY_CODE button or `https://shop.com/{{1}}` track-order URL. Backend can send `couponCode` and knows copy-code index. Campaign wizard has **no coupon field**. `buildTemplateComponents` does **not** emit URL-button parameters.

**Evidence:** `templateParamsSchema.couponCode` exists; `CampaignWizardForm` has no `couponCode`. Interactive composer in Inbox has coupon; campaign wizard does not. No `sub_type: 'url'` button component in `buildTemplateComponents`.

**Fix:** If template has COPY_CODE, require coupon in campaign + inbox. If URL button contains `{{1}}`, collect a suffix (static or mapped) and send the Meta button component.

---

## 7. Medium / Low

- **Campaign review** lists raw `{{name}}` instead of “Auto: customer name” (`CampaignReviewStep` `variableRows`).
- **Template test send** does not look up the destination contact; `buildTemplateComponents` scrubs tokens to `"Valued customer"` / `"your registered number"`.
- **Campaigns billed/quota as MARKETING** even for Utility templates (`assertDailyBudget(..., 'MARKETING')`). Product decision — but do not confuse it with Meta category validation.
- **Using a Utility library template as a promo blast** can make Meta recategorize it as Marketing. UI should warn: library Utility = transactional; marketing copy belongs in a Marketing template.
- **No org setting** for default “always map first variable to name.”
- **PAUSED / DISABLED** templates are excluded from the campaign picker (APPROVED only) — correct. Quality YELLOW/RED still selectable — consider a warning.
- **Named Meta parameters** (`parameter_format: NAMED`) are not a first-class create path; validation allows `{{name}}` in the *template body* as a special case, which is different from our *param tokens*.
- **Header media** is one campaign-wide URL, not per recipient (usually correct).
- **FEATURE_MATRIX** still lists `TemplateLibraryPanel` (removed). Templates “9/9 DONE” is overstated.

---

## 8. Tags vs labels vs template variables (read this before building)

| Thing | Where it lives | What it is for | Can it fill `{{1}}` today? |
|-------|----------------|----------------|----------------------------|
| **Contact tag** | `Contact.tags[]` | Segment people for campaigns / filters | No. Selects the *audience*. |
| **Conversation label** | `ConversationLabel` | Inbox triage (Open, VIP, …) | No. Not on the person. |
| **Template variable** | Meta `{{n}}` + our mapping | Words inside the WhatsApp message | Only name / phone / email if mapped. |
| **Custom field** | Does not exist | order id, city, appointment time | No. |

**Do not** treat tags as variables. A person can have many tags; a placeholder needs one string. If product wants “VIP” in a message, add a dedicated field or a “primary tag” later — do not silently `tags.join(',')`.

**Generic model to build toward:**

```
Contact
  name, phone, email          ← already there
  tags[]                      ← audience only
  customAttributes Json?      ← order_id, city, …  (Phase C)

TemplateVariableMap (per org + template name + language)
  {{1}} → contact.name | contact.email | contact.phone
        | contact.custom.order_id
        | static (same for everyone)
        | campaign_input (agent types at send)

Send layer
  always resolve per recipient from live Contact
  never from localStorage
```

---

## 9. Campaign UI — what is connected vs not

| Capability | Status |
|------------|--------|
| Pick approved template | Yes |
| Language variants | Yes (preview language switch) |
| See WhatsApp preview | Yes (tokens shown as samples) |
| Auto pill for mapped vars | Yes **if this browser saved mapping** |
| Type static vars | Yes |
| Edit after send | No (only DRAFT / SCHEDULED) — correct |
| Change template on a running campaign | No — correct |
| Coupon / copy code | Backend only |
| Dynamic URL button value | Missing |
| Per-recipient CSV column → `{{n}}` | Missing (`CampaignRecipient.variables` exists, UI never fills it) |
| Empty campaign → library link | Yes (after last library pass) |
| Utility vs Marketing honesty | No (picker mixes categories; start then fails Utility) |

`CampaignRecipient.variables` is already on the model for per-person overrides. Nothing in the wizard or CSV import writes it. That is the right hook for “upload order IDs per phone” later.

---

## 10. Inbox UI — what is connected vs not

| Capability | Status |
|------------|--------|
| List approved templates | Yes |
| Auto-fill from mapping | Yes if localStorage present |
| Resolve against **this** chat’s contact | Yes on the server |
| Empty → library / create links | Yes |
| Show contact name in the pill | No (says “Auto: customer name” even if contact.name is empty — send uses fallback) |
| Coupon | Separate Interactive composer, not Template tab |
| 24h window copy | Yes (template still allowed while window open) |

---

## 11. What would make the template section actually better (product, not just bugs)

These are improvements, not required to make send work. Do **not** start them until C1–C3 / H1–H2 are fixed.

1. **Server-side mapping (Phase B)** — the real product. Without it, “auto from contact” is a single-browser trick.
2. **Contact custom attributes + CSV columns** — order id, tracking id, appointment time. This is what Indian ecommerce actually puts in Utility templates. Tags are the wrong tool.
3. **Campaign fill UI:** show the description from create (“Order number”), lock mapped pills, only ask for unmapped slots, review step in human language.
4. **Per-recipient overrides:** CSV “phone, {{2}}, {{3}}” into `CampaignRecipient.variables`.
5. **Coupon + URL suffix** fields when the approved template has those buttons.
6. **Flow template node** using the same resolver.
7. **Settings (optional, later):** org default “first body variable = customer name” for new templates only — not a second mapping system.
8. **Quality / pause warning** in the campaign picker.
9. **Do not add a fake pre-approved marketing library.** Marketing still needs Meta review. Purpose presets in the create wizard already cover offers / welcome.

---

## 12. Suggested build order (when we start work)

Do these in order. Later items depend on earlier ones.

1. **Unblock send:** stop forcing `category: 'MARKETING'` on template validation; drop worker pre-assert on unmerged params; merge then validate per recipient using `template.category`.
2. **Pass live contact** `name/email/phone` into `mergeTemplateParams` in the worker.
3. **Stop `.filter(Boolean)`** on inbox + test-send param arrays.
4. **Persist `variableMeta`** on the server; campaigns/inbox load it from API.
5. **Use descriptions** in campaign/inbox labels; humanize review tokens.
6. **Flow template params.**
7. **Coupon + dynamic URL** in campaign/inbox when the template needs them.
8. **Custom attributes** on Contact + mapping sources + CSV.

---

## 13. Tests that should exist (and do not)

- `mergeTemplateParams` with body `['{{name}}', '{{email}}']` and a contact missing email → fallback, **same array length**.
- `assertApprovedCampaignTemplate` with a UTILITY template must **not** fail when category is omitted or matches UTILITY.
- Worker-equivalent: unmerged `{{name}}` must not be treated as a batch configuration error.
- Inbox payload with `['', 'order-1']` must stay two parameters.
- No test today covers `sanitizeFieldToken` + worker assert together.

Existing `validation.test.ts` only checks in-string `Hello {{name}}` and marketing-shaped templates.

---

## 14. FEATURE_MATRIX drift

`docs/audit/FEATURE_MATRIX.md` Templates section still says:

- Meta library → `TemplateLibraryPanel` (file deleted; route is `/templates/library`)
- All 9 items DONE

Variable mapping, campaign Utility send, and flow template params are **not** done. Treat FEATURE_MATRIX as stale until this review’s build order is finished.

---

## 15. Self-check (questions this audit was meant to answer)

| Question | Answer |
|----------|--------|
| If a template is verified, can I use it in a campaign? | **Only if it is MARKETING.** Utility library templates fail start validation. |
| Do campaign inputs match template variables? | Count yes (wizard resizes arrays). Labels often wrong. Mapping only if localStorage hits. |
| Does the backend resolve per contact? | Designed to. Worker pre-assert + missing email + no live name reload make it unsafe. |
| Inbox same contract? | Same tokens. Server resolves. Client can shift empties. |
| Are contact fields fetched? | Name at audience-build time. Email not on recipient. Tags not used as values. |
| Tags / labels as variables? | **No, and they should not be** without an explicit field. Tags = audience. Labels = inbox. |
| Settings needed? | Not first. Persist mapping on the template, not a new settings page. |
| Campaign editable? | Draft/scheduled only. Correct. |
| Anything else connected? | Flows template node is a silent hole. Test send ignores contact. Coupon/URL incomplete. |

---

## 16. Implementation status (2026-08-14)

Code was changed after this audit, in the build order from §12. Working consent, opt-in, draft/scheduled-only edit, and billing quota `'MARKETING'` snapshots were left as they were.

| ID | Status |
|----|--------|
| C1 Utility/Auth campaign start | **Fixed.** Template validation no longer forces `category: 'MARKETING'`. |
| C2 Worker unmerged tokens | **Fixed.** Pre-loop identity check only; merge then validate per recipient. |
| H2 Live contact at send | **Fixed.** Worker + start/resume/retry look up Contact `name` / `phone` / `email`. |
| H1 `filter(Boolean)` | **Fixed.** Inbox, test-send, and interactive copy-code keep positional arrays. |
| C3 Mapping persistence | **Fixed.** `GET/PUT /api/templates/:name/variable-meta` on org settings; campaign/inbox/test-send load it. localStorage remains a cache. |
| H3 Human labels / review tokens | **Fixed.** Wizard descriptions + “Auto: customer name” on review. Utility/Auth warning copy. |
| H4 Flow template params | **Fixed.** Flow node merges mapping + live contact; optional coupon / URL suffix on the node. |
| H5 Coupon / dynamic URL | **Fixed.** Campaign wizard, Inbox template tab, template test-send, and flow node. |
| Custom attributes | **Not in this pass.** Tags still are audience-only. |

**Still later:** Contact `customAttributes`, CSV per-recipient overrides (`CampaignRecipient.variables` UI), org-default mapping in Settings.

**Recheck (same day):** Empty-name in-string `Hello {{name}}` now falls back instead of failing the batch. Inbox/test-send validate before Meta. Flow template nodes skip (and log failed) instead of sending a broken template. Mapping sync failure warns the user. Live-contact lookup normalizes phone. Quality YELLOW/RED warning in the campaign wizard.
