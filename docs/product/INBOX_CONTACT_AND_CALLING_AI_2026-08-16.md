# Inbox new contact fields + strip AI calling from Calls settings

Durable product research for later implementation and for copying into Confluence when that product is connected. Dictated 2026-08-16 (set 4). Agent memory + Jira mapping: `docs/memory/PRODUCT_TASKS_2026-08-16.md` §13–14. **Shipped in code 2026-08-16:** Inbox New chat = Contacts optional fields (SAMYOJ-58). **Not built:** strip AI calling from Calls Customize (SAMYOJ-59; land with/after SAMYOJ-52).

Atlassian note (2026-08-16): the connected site `teamwebstarts.atlassian.net` currently exposes **Jira only**. Confluence wiki API returns 404. This file is the documentation space until Confluence is enabled.

---

## 1. Inbox New chat — same optional person details as Contacts

### What the user asked

From Inbox, the user can add a number and start a chat. That person must be **the same Contact** as on the Contacts page (this connected WhatsApp number). While adding, ask the **same optional details** we already ask on Contacts → Add contact. Extra fields are optional, not required — still show them.

### What the product does today

Inbox **New chat** (`NewChatSlideOver.tsx`) only asks:

- Phone (required, digits + country code)
- Contact name (optional)

`POST /inbox/start` accepts `{ phone, name? }`. It already:

- Upserts `Contact` on `(organizationId, whatsappNumberId, normalizedPhone)` — **correct** workspace isolation
- Upserts `Conversation` on `(organizationId, contactId, whatsappNumberId)` — **correct** (reopens existing chat; does not duplicate)

So “connect the chat to the contact” is **not** a missing foreign key. The gap is **incomplete contact data** plus a **consent mismatch**.

Contacts **Add contact** (`ContactsPage.tsx`) also collects:

| Field | Required? | Stored on |
|-------|-----------|-----------|
| Phone | Yes | `Contact.phone` / `normalizedPhone` |
| Name | No | `Contact.name` |
| Email | No | `Contact.email` |
| Tags | No | `Contact.tags` |
| Notes | No | `Contact.notes` (not Inbox thread internal notes) |
| Custom fields | No | `Contact.customAttributes` (`key=value` lines, templates `{{order_id}}`) |
| Allow campaign messages | No (default off) | Consent audit via `contactCreateConsentFields` |

Inbox after the chat exists can edit **tags** and conversation **internal notes**. It can *display* email and campaign status if they already exist. It cannot set them at create time.

### Consent bug (do not copy into New chat)

Inbox start **create** sets `optedIn: true` and `source: 'OUTBOUND'` with **no** `consentSource` / `consentAt`.

Contacts create uses `contactCreateConsentFields`: omit the checkbox → `{ optedIn: false }` only. Check the box → `optedIn` + `consentSource` + `consentAt` + decision JSON (`MANUAL`).

Campaigns are fail-closed (`AUDITABLE_CONSENT_WHERE`). Inbox’s silent `optedIn: true` is **not** campaign-eligible (missing provenance) and is **not** the same as the Contacts checkbox. Starting a 1:1 chat must **not** mean the person agreed to campaigns.

### Required when built

1. Inbox New chat UI lists the same optional fields as Contacts Add contact. Phone remains the only required field.
2. API persists those fields on the upserted Contact. Conversation upsert stays.
3. Consent matches Contacts. Unchecked / omitted → not campaign-eligible. Checked → same audit helper (`MANUAL` or `INBOX_START` — pick one source string and keep it).
4. If that phone already exists on this WhatsApp number: merge filled optional fields; do not blank existing name/email/tags/notes/attributes/consent when the user skipped a field.
5. Same row shows on Contacts and in Inbox profile (email, tags, campaign badge).
6. Share the form (or the field list + `validatePhone` + custom-attribute parser) so the two screens cannot drift.

### Out of scope

CSV import, changing uniqueness, cross-org Meta number ([SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49)), treating Inbox `InternalNote` as `Contact.notes`.

### Done when

A user can add a person from Inbox with or without extras; Contacts shows that same record on this number; campaigns stay fail-closed unless they checked Allow campaign messages.

Jira: [SAMYOJ-58](https://teamwebstarts.atlassian.net/browse/SAMYOJ-58).

---

## 2. Remove AI calling from Calls → Customize

### What the user asked

AI calling (personality, training, on/off, which bot, greeting/speaker) must **not** live in Calling settings. Those belong on the **AI Calling bot** ([SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52)). Set 2 said a **full** Calls → Customize replacement is later. This task **un-defers only the AI block**: delete it from Customize; leave org telephony knobs.

### What the product does today

`CallingSettingsForm.tsx` sections:

**Remove (AI calling):**

- **Who answers** — AI Bot / Human agents / AI first, human backup; **Which AI** (`defaultBotId`); link “Edit personality & training”
- **AI Bot personality** — deep link to `/ai-bot`
- **Training data** — deep link to `/ai-bot`
- **Advanced:** “Max AI call length”, checkbox “AI can answer automatically” (`aiAutoAnswer`)
- **Voice & language** and **greeting text** — AI voice; move onto the calling bot in SAMYOJ-52, then delete from Customize so they are not duplicated

**Keep (org telephony — later rewrite still deferred):**

- Call behavior (human ring)
- After hours
- Missed call reply
- Max concurrent calls / custom ring timeout
- Recording consent (compliance; may sit under Greetings today — keep the control, not the AI greeting copy)

Live agent on the same PSTN/WhatsApp call stays [SAMYOJ-12](https://teamwebstarts.atlassian.net/browse/SAMYOJ-12) (`message_only`). Do not add transfer UI here.

### Order vs SAMYOJ-52

Do **not** ship this strip **before** the calling bot has: global AI calling on/off (`aiAutoAnswer`), greeting, speaker/language, which bot answers. Relates SAMYOJ-52. Land together or after 52.

`ensureDefaultBot` must not create a Support Bot when the user turned calling AI off — that engine fix is 52, not this UI ticket.

### Done when

Calls → Customize has no Who-answers AI cards, no Which AI, no personality/training nav, no AI auto-answer, no max AI call length. Calling AI is configured on the calling bot. Ring / concurrent / after-hours / missed / recording remain.

Jira: [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59).
