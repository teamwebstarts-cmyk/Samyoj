# Templates — Production-Readiness Deep Audit (read-only, no edits)
Date: 2026-09-13. Scope: everything that creates, validates, sends, caches, or retires a WhatsApp message template.
Method: 3 parallel specialist audits + own live probes + `vitest` + `tsc --noEmit` + Meta docs cross-check. No code changed. No Jira filed.

## Verdict up front
- **Tenant create/submit/list/test-send/campaign-bulk: CONDITIONAL GO** — scoped, validated, tested. Conditions are the P1s below.
- **Shared send funnel (`sendDirectMessage` + `deliverOutboundMessage`): NOT policy-safe** — correct plumbing, zero consent/APPROVED enforcement. Safety depends on every caller remembering the checks.
- **Resubmit (delete+create): NO-GO in current form** — non-atomic + rename/cache bug + no idempotency + 30-day quarantine exposure.
- **Content Studio Meta submit: NO-GO without RBAC + validation + cache fix** — any org member can submit today, bypassing `manageTemplates`/plan gates.
- **AUTH/OTP track: NOT READY** — create accepts what Meta rejects; send omits the OTP button param entirely.
- **Lifecycle (ARCHIVED/FLAGGED/quality/pacing/unpause/quarantine/edit-limits): NOT READY** — the highest blast-radius hole is paused→delete→30-day name block.

## 1. Architecture (two pipelines, one name — read this first)
- CREATE: `types.createTemplateSchema` → `templates/builder.buildTemplateComponents` → `Meta createMessageTemplate` → `invalidateTemplateCache`.
- SEND: `campaigns/template-validation` → `mergeTemplateParams` → `campaigns/template-params.buildTemplateComponents` → `deliverOutboundMessage` → Meta send.
- The two `buildTemplateComponents` functions are different files with the same name (`builder.ts:20` create vs `template-params.ts:125` send). Import path decides semantics.
- Mount: `/api/templates` (`server/src/index.ts:256`). Global guard `routes.ts:39-40`: `authenticate + requireOrg + resolveActiveWhatsappNumber + manageTemplates` + plan guards on mutations. Number resolution fail-closed (multi-number + missing header → 409, never "latest"). Meta context per active number (`whatsapp/context.ts:44-80`).

## 2. Per-path security/tenancy/correctness scores (0-10)
| Path | Score | One-line why |
|---|---|---|
| A `GET /` list/sync `routes.ts:62-90` | 8 | Scoped read; no audit/cache, live Meta every call |
| B `GET /library` `routes.ts:92-116` | 9 | Harmless global read, org-correct token |
| C `GET /starters` `routes.ts:118-125` | 8 | Shared-catalog model right; seed+patch write-on-read |
| D `POST /catalog/:slug/submit` `routes.ts:138-193` | 6 | Scoped + URL-checked; no idempotency/audit; silent URL→QUICK_REPLY downgrade (`catalog.ts:664-666`) |
| E `GET /:name/usage` `routes.ts:196-209` | 9 | Correctly number-scoped (`analytics.ts:3-9`) |
| F `GET/PUT /:name/variable-meta` `routes.ts:238-262` | 6 | Org-only, number-blind (`variable-meta.ts:60-100`); settings-JSON lost-update race (`:84-99`); dupe `(scope:index)` correctly rejected |
| G `GET /:name` `routes.ts:266-281` | 8 | Scoped; bypasses `cache.ts` (dead cache on this path) |
| H `POST /upload-header` `routes.ts:284-309` | 6 | Scoped, 16 MB cap; MIME unvalidated; no idempotency; ~21 MB base64 body |
| I `POST /` create `routes.ts:311-334` | 7 | Strong Zod validation; no idempotency/audit |
| J `POST /from-library` `routes.ts:338-360` | 7 | Scoped; no idempotency/audit; UTILITY/AUTH only |
| K `POST /:name/test-send` `routes.ts:362-441` | 7 | Consent + APPROVED + number-scoped contact (`:381-407`) correct; TOCTOU window; `Idempotency-Key` optional/unvalidated length; no audit row; no rate limit |
| L `POST /:name/resubmit` `routes.ts:444-476` | 4 | Gate right (REJECTED/PAUSED/DISABLED) but non-atomic delete→create, rename bug (gate `:name` vs create `data.name`, cache invalidates wrong key), no idempotency/audit |
| M `DELETE /:name` `routes.ts:479-494` | 6 | Scoped; destructive, unaudited, no in-flight campaign guard |
| N `sendDirectMessage` `messages/service.ts:190-380` | 5 | Tenancy + `(conversationId,key)` idempotency pattern correct; **zero consent + zero APPROVED checks**; upserts `optedIn:false` contact then sends; TEMPLATE exempt from 24h window by design |
| O `deliverOutboundMessage` `messages/send.service.ts:198-650` | 6 | Tenancy + `providerCallStartedAt` CAS lease + AMBIGUOUS handling excellent; **APPROVED/consent-blind** — sends whatever told; TEMPLATE branch `:355-380` never validates status |
| P Campaign bulk `campaigns/service.ts` | 8 | Reference path: org+number audience, fail-closed consent (`optedIn` + snapshot `:712-716`), APPROVED via `templateValidationErrors:34`, `runVersion` CAS + quota reservation + per-recipient claim token |
| Q Studio `submit-meta`/`meta-status` `composer/routes.ts:366-502` | 6 | Number-bound (`assertDraftNumber` 409) + BLOCKED/policy guards; **no `manageTemplates`/plan gate**, non-idempotent last-writer-wins name tracking, no schema validation, no cache invalidate, `sample1/2` weak examples, no buttons/media |
| R Webhook status `webhook-dispatcher.ts:247-291` | 8 | Fail-closed routing (`resolveOrgFromWaba` ambiguous→null), claim-dedupe (`providerWebhookEventKey` + 60s reclaim), cache invalidate + alerts + `auditLog`; FLAGGED-vs-resubmit mismatch (webhook alerts FLAGGED, resubmit gate omits it) |
| S Meta thin client `meta.service.ts:796-960` | 8 | Token-in-header, structured `MetaApiError` code/subcode/fbtrace; correctness lives with callers (correctly) |
| T Cache `templates/cache.ts:1-50` | 6 | Key `tpl:org:waba:name↓` + 300s TTL + fail-open right; no singleflight (stampede), exact-key-only invalidate (rename-stale) |

Cross-cutting rule: approval/consent live at edges (K, P), not at the funnel (N, O). One guard in the shared send path is a smaller diff than one per caller — but that is a fix, out of scope for this read-only report.

## 3. Meta compliance matrix (✅ covered / 🟡 partial / 🔴 missing)
| # | Meta rule | V | Evidence |
|---|---|---|---|
| 1 | Body ≤1024 | ✅ | `types.ts:81` |
| 2 | Header ≤60 | ✅ | `types.ts:84` |
| 3 | Footer ≤60 | ✅ | `types.ts:86` |
| 4 | Button label ≤25 | ✅ | `types.ts:47` |
| 5 | URL ≤2000 | ✅ | `types.ts:48,143-144,187` |
| 6 | ≤10 buttons | ✅ | `types.ts:86,163` |
| 7 | ≤2 URL buttons | ✅ | `types.ts:135-139` |
| 8 | Unique labels | ✅ | `types.ts:126-134` |
| 9a | Examples per body/header param | ✅ | `types.ts:93-112` + `builder.ts:29-31,53-55` |
| 9b | Example required for URL-var button | 🟡 | `builder.ts:82` attaches only if ends-with-`{{n}}` + example present; schema never requires it → Meta rejects exampless dynamic URLs |
| 10 | Sequential `{{1..n}}` | ✅ | `types.ts:22-31`, `template-validation.ts:74-76` |
| 11 | No edge vars | ✅ | `types.ts:8-17,33-41`, `catalog-store.ts:251-264`, seed repair `:115-139`, `starters.test.ts:19-24` |
| 12 | **No footer vars** | 🔴 | Length-only `types.ts:86`, verbatim `builder.ts:58-60`, zero checks in `template-validation.ts` → sails to Meta rejection |
| 13 | **Max 1 header var** | 🔴 | `types.ts:104-112` counts for examples, never caps; `builder.ts:29-31` forwards N |
| 14 | URL var: exactly one, suffix-at-end | 🟡 | `builder.ts:82` end-anchored so mid-URL vars silently lose example; schema never validates position; send accepts any `{{` (`template-params.ts:209`) |
| 15 | Percent-encode suffix at send | 🔴 | `template-params.ts:201-220` raw push; zero `encodeURIComponent` on suffix paths |
| 16 | Named vs positional, one format | 🟡 | Mixed rejected at send-validation (`template-validation.ts:12-26,55-57`) but create only sees `{{\d+}}`, send never emits `parameter_name` → named templates un-sendable |
| 17 | AUTH preset body | 🔴 | `types.ts:122` only skips edge-check; `builder.ts:44-55` sends custom body; `catalog.ts:296-306` OTP body is non-preset prose |
| 18 | 15-char AUTH params | 🟡 | COPY_CODE example + couponCode capped; AUTH body OTP code uncapped (`template-params.ts:91-99`) |
| 19 | No URLs/media/emoji in AUTH | 🔴 | Schema+builder allow media headers + buttons for AUTH; no emoji/URL scan |
| 20a | OTP types | 🟡 | COPY_CODE/ONE_TAP present; ZERO_TAP/NO_BUTTONS absent |
| 20b | `supported_apps` for ONE_TAP | 🔴 | Zero refs repo-wide (proven §6) → broken Android autofill |
| 20c | `code_expiration_minutes` 1–90 | 🔴 | Zero refs; AUTH FOOTER sent as plain text, never expiry field |
| 21 | **Double OTP at send** (body + `otp_text`) | 🔴 | Zero `otp_text` refs; `template-params.ts:189-200` only COPY_CODE `coupon_code` |
| 22 | Media `header_handle` resumable | ✅ | `meta.service.ts:758-793` + `builder.ts:14-16` + 16 MB cap |
| 23 | Library-clone button inputs required | 🟡 | Client builds them (`templateLibrary.ts:576-660`) + review enforces, but schema optional; ONE_TAP→COPY_CODE downgrade (`:653-659`) |
| 24 | Lifecycle + unpause path | 🟡 | APPROVED-only gate ✅ + paused copy ✅ + resubmit ✅, but **no `POST /{id}/unpause`**; FLAGGED/ARCHIVED/IN_APPEAL/LOCKED/PENDING_DELETION unhandled |
| 25 | 30-day name quarantine | 🔴 | Local-only dedupe (`templateLibrary.ts:278-285`); resubmit deletes+recreates same name (`routes.ts:462`) into quarantine |
| 26 | 10-edits/30d, 1/24h, category immutable | 🔴 | No edit endpoint; every edit = delete+create (re-review + quarantine) |
| 27 | Quality RED/YELLOW/GREEN + pacing | 🔴 | `quality_score` in client type only; `getMessageTemplate` doesn't fetch it; no pacing; no campaign auto-halt |

Top blast radius: (1) no-unpause + delete-recreate → 30-day name brick; (2) missing `otp_text` → AUTH sends fail; (3) missing `supported_apps` + expiry → ONE_TAP broken; (4)(5) footer/multi-header vars → post-form rejections; (6) quarantine invisible; (7) quality/pacing invisible; (8) URL-var strictness; (9) AUTH preset; (10) suffix encoding.

## 4. Catalog / Studio / Admin / Client scores
| Surface | Score | Why |
|---|---|---|
| Catalog (41 seeds + store + submit) | 8 | Bilingual seeds, edge guard+patch, honest copy, fail-closed binding, correct invalidate, strong tests. −2: seed-once flag (new seeds never deploy), zero PHONE seed, mid-URL example drop |
| Content Studio submit | 4 | Bound + policy-gated good. −6: missing RBAC/plan gate (highest-priority gap), no schema validation, no invalidate, sample1/2, no buttons/media, 502-wrapped errors, timestamp collisions |
| Admin publisher | 5 | Audit-logged CRUD + reason gate good. −5: drawer drops buttons (first-URL-only rebuild), comma-split examples corrupt, hard delete, silent seed-patch revert, no re-seed, under-validated button schema |
| Client wizard | 7 | Browse→review→submit, collision-proof names, prefill, preview, per-number reload good. −3: 3 divergent URL validators, phone-min client-only, silent `hi` fallback, media check on `selected` vs payload |

Catalog decision: ship 3-pattern pack as-is (OTP + UTILITY-with-URL + MARKETING-with-COPY_CODE, en_US+hi_IN); keep per-number submit; **NO-GO on bulk-cloning Meta public library into `PlatformLibraryTemplate`** — keep `/from-library` as the only Meta-library path.
Client-vs-server drifts D1-D8 (full detail in working notes): admin buttons under-validated; example 15 vs 2000; 3 URL validators diverge (server accepts `https://localhost`, proven §6); button-count only on create; language silent fallback; media/phone messages differ; Studio validates almost nothing vs catalog full parse.

## 5. Live proofs I executed (not claims)
- `npx vitest run src/modules/templates/` → **35/35 passed** (`starters` 7, `clone` 28).
- `npx tsc --noEmit` (server) → **exit 0**.
- Probe `templateTextHasEdgeParams`: start `{{1}}...` → true; end `...{{1}}.` → true; middle `...{{1}} for login` → false. ✅ rule works.
- Probe `unusableTemplateButtonUrl('https://localhost/shop')` → **null (accepted)** ❌ — server lets localhost through; client `libraryButtonUrlError` blocks it. Drift proven live.
- Probe `templateValidationErrors` with APPROVED + footer `use {{1}} now` + 2-var header, all values supplied → **`[]` (zero errors)** ❌ — Meta would reject both; Samyoj passes. Gaps #12/#13 proven live.
- Probe same template with PAUSED → `["status is PAUSED, not APPROVED"]` ✅ — status gate works.
- `rg otp_text|code_expiration_minutes|supported_apps` over `server/src` → **zero matches** ❌ — AUTH send/expiry/autofill gaps proven.

## 6. Test/evidence inventory
Measured: server templates 35/35; `tsc` clean; CRM leftover ledger `3/3` (`crm-leftover-recheck-ok`); inherited (not re-run): server 1120/client 183 suites, Platform Admin 9/19, `npm audit` high=0, number-isolation preflight, migration-chain fail-closed, local deploy health. Live gates still open: real WABA Connect→send→approved-template→consented campaign + double-click observation; 2-org/2-number isolation live; restore on customer-like host; real AI-call media/failure/consent behavior; S3/CDN ACL + signed-URL policy in deployed env.

## 7. Production-readiness verdict + fix order (recommendations only, no edits made)
**Do not claim customer-production GO.** Internal test-deploy (`bash start.sh`) = yes.
Fix order smallest-first (scoping only): (1) Studio `withPermission('manageTemplates')` + plan guard (mirrors `routes.ts:39-40`); (2) Studio `createTemplateSchema.parse` + `invalidateTemplateCache` on success; (3) Admin drawer full `buttons[]` round-trip + array editor for examples; (4) reuse `templateButtonSchema` for admin schema + version seed flag; (5) unify URL validation into one shared function; then AUTH track (preset body, 15-char, no-URL/media/emoji, `supported_apps`, `code_expiration_minutes`, `otp_text` send branch), footer/header-var guards, suffix encoding, unpause endpoint + campaign auto-halt + FLAGGED/RED surfacing, quarantine visibility, edit-limit handling.
Natural Jira home (no ticket filed — needs your go-ahead): comment on SAMYOJ-11/SAMYOJ-2/SAMYOJ-8 family, not a new sibling.

## 8. Ponytail cut-list (complexity only)
- `server/src/modules/templates/starters.ts:L1-7: yagni: pure re-export shim. Delete file, import catalog directly.`
- `server/src/modules/templates/cache.ts:L44-46: native: redis.keys(pattern) O(N) sweep. SCAN cursor loop.`
- `server/src/modules/templates/catalog-store.ts:L140-142: shrink: seed+patch 30-row scan on every GET /starters. Gate behind seed flag.`
- `server/src/modules/templates/builder.ts:L20 + campaigns/template-params.ts:L125: yagni: two buildTemplateComponents same name. Rename buildCreateComponents/buildSendComponents.`
- `server/src/modules/templates/catalog-store.ts:L154-179 + client/src/utils/templateLibrary.ts:L481-532: shrink: two URL blocklists drifted. One shared isPrivateOrLocalHost.`
- `net: -40 lines possible.`

## 9. Resources (every claim traceable)
- Template fundamentals/limits/named-vs-positional/quality/pausing/archival/pacing: https://developers.facebook.com/docs/whatsapp/message-templates/guidelines · https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/
- Components (header/body/footer/buttons, URL-var-at-end, examples, encoding): https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components/
- Auth (preset text, `add_security_recommendation`, `code_expiration_minutes` 1–90): https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates/ · .../authentication-templates/authentication-templates · .../copy-code-button-authentication-templates/ · bulk: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/upsert_message_templates/
- Management (edit 10/30d + 1/24h, category immutable, 30-day reuse, archive/unarchive): https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management
- Pausing (3h→6h→DISABLED, unpause API): https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing/
- Send shapes (`sub_type:url`, quick-reply): https://developers.facebook.com/docs/whatsapp/api/messages/message-templates/interactive-message-templates/
- Graph (`library_template_button_inputs` base_url/url_suffix_example): https://developers.facebook.com/docs/graph-api/reference/page/message_templates/
- Webhook (`message_template_status_update`): https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/message_template_status_update
- Categorization: https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/
- Pricing Oct-2026 (service + utility-in-window billable, 1000/mo free): https://help.twilio.com/articles/53100480177819 · https://360dialog.com/blog/whatsapp-service-message-charging-october-2026/ · https://www.wati.io/en/blog/whatsapp-service-message-pricing/
- Repo anchors: `server/src/modules/templates/{routes.ts,types.ts,builder.ts,variable-meta.ts,cache.ts,analytics.ts,catalog.ts,catalog-store.ts}` · `server/src/modules/campaigns/{template-validation.ts,template-params.ts}` · `server/src/modules/messages/{service.ts,send.service.ts}` · `server/src/modules/content-studio/composer/routes.ts` · `server/src/modules/whatsapp/{meta.service.ts,webhook-dispatcher.ts,context.ts,active-number.ts}` · `server/prisma/schema.prisma` · `client/src/{pages/TemplateLibraryPage.tsx,components/templates/TemplateCreateForm.tsx,utils/templateLibrary.ts}` · `admin/src/pages/TemplateCatalogPage.tsx` · prior audits `docs/audit/CRM_SURFACE_AUDIT_2026-09-12.md`, `docs/memory/STATUS_AND_FUTURE.md`.
