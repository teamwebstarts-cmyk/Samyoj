# Templates Deep-Dive — 2026-09-13

## 1. Pipelines
CREATE: types.createTemplateSchema -> templates/builder.buildTemplateComponents -> Meta createMessageTemplate -> invalidateTemplateCache
SEND: campaigns/template-validation -> mergeTemplateParams -> campaigns/template-params.buildTemplateComponents -> deliverOutboundMessage -> Meta send

Routes (`server/src/modules/templates/routes.ts`, mount `/api/templates`):
GET /, GET /:name, POST /, DELETE /:name, POST /:name/resubmit, GET /library, POST /from-library,
GET /starters, POST /catalog/:slug/submit, GET/PUT /:name/variable-meta, GET /:name/usage,
POST /upload-header, POST /:name/test-send.

Guard: authenticate + requireOrg + resolveActiveWhatsappNumber + manageTemplates + plan guards. Meta context per active number.
Honest limit: Samyoj cannot pre-approve Meta on your number. Utility/Auth fast, Marketing slow.

## 2. Self-checks (own runs)
- `npx vitest run src/modules/templates/` -> 35/35 passed (starters 7, clone 28).
- grep ARCHIVED|FLAGGED|REINSTATED|code_expiration_minutes|supported_apps|unpause -> gaps confirmed. Webhook handles only REJECTED/PAUSED/DISABLED/FLAGGED (webhook-dispatcher.ts:274). No ARCHIVED/REINSTATED/LIMIT_EXCEEDED/LOCKED/IN_APPEAL handling. No code_expiration_minutes, supported_apps, unpause.
- sendDirectMessage (messages/service.ts:190-380) vs test-send (routes.ts:382-427): test-send checks hasAuditableCampaignConsent + assertApprovedCampaignTemplate + APPROVED; sendDirectMessage does none, upserts optedIn:false contact then sends.

## 3. Meta 2026 cross-check
- Lifecycle: APPROVED, PENDING, REJECTED, PAUSED, DISABLED, FLAGGED, IN_APPEAL, LIMIT_EXCEEDED, LOCKED, ARCHIVED, UNARCHIVED, REINSTATED, DELETED, PENDING_DELETION; FIRST_PAUSE 3h, SECOND 6h, third disables; ARCHIVED = 12mo inactive -> deleted after 28d.
  Docs: message_template_status_update webhook ref, message-templates guidelines.
- Auth: preset body only, no URLs/media/emoji, params max 15 chars, OTP COPY_CODE/ONE_TAP/ZERO_TAP, one-tap needs supported_apps else fallback to copy-code, expiry code_expiration_minutes 1-90, send puts OTP twice (body + button sub_type:url index 0).
  Docs: authentication-templates, new-template-guidelines.
- Pricing (Meta ledger): per-message since 2025-07-01. From 2026-10-01 service messages + utility-in-window billable at local utility/auth rate, no tiers, only 1000 service msgs/phone/month free.
  Docs: Twilio Oct 2026 notice, 360dialog service-charging, WATI pricing explainer.

## 4. Problems (ranked)
P1:
1. sendDirectMessage no consent/APPROVED/placeholder validation.
2. ARCHIVED unhandled — need block + "restore in Manager within 28 days" UX.
3. Auth send likely broken — no OTP button branch in send builder; create lacks code_expiration_minutes + supported_apps + accepts free-text AUTH bodies.
4. No campaign auto-pause on PAUSED/DISABLED, no FLAGGED/RED gate, no unpause path; resubmit = delete+recreate risks 30-day name quarantine.
P2:
5. from-library forces UTILITY|AUTH only, button inputs optional while Meta requires for utility-with-buttons.
6. Header N vars allowed (max 1), footer {{n}} unchecked (none allowed), mid-URL {{1}} accepted (suffix-only), suffix not percent-encoded.
7. Named params unsupported — externally-created templates can never send.
8. Server unusableTemplateButtonUrl weaker than client (allows localhost/private-IP/CRM paths). Unify.
9. Admin publisher drops buttons (keeps first URL only).
10. "Replies free in 24h" copy wrong after 2026-10-01. Read pricing object, expose message_send_ttl_seconds.
11. Minor: category passthrough, index string-vs-int, MIME allowlist vs 16MB flat, LIMIT_EXCEEDED/LOCKED handling, usage last-20 only, Content Studio skips invalidateTemplateCache + schema checks, resubmit rename orphans cache, catalog language free-form, headerMediaHandle raw zod error.

Catalog: starter pack GO, category+language present, Meta-library-into-our-table NO-GO.

## 5. Ponytail-review
- starters.ts:L1-7: yagni: pure re-export shim. Delete file.
- cache.ts:L44-46: native: redis.keys O(N). SCAN loop.
- catalog-store.ts:L140-142: shrink: seed+patch scan on every GET /starters. Gate behind flag.
- builder.ts:L20 + template-params.ts:L125: yagni: two buildTemplateComponents same name. Rename.
- catalog-store.ts:L154-179 + templateLibrary.ts:L480-531: shrink: two URL blocklists drifted. One shared check.
net: -40 lines possible.

No code changed. No Jira filed.
