# Feature Matrix — What's Built

> Last updated: 2026-08-14

Legend:
- **DONE** — Fully implemented (backend + frontend + DB)
- **PARTIAL** — Backend exists but frontend incomplete, or vice versa
- **BACKEND ONLY** — API exists, no UI
- **PLANNED** — In docs/roadmap but not implemented

---

## 1. AUTHENTICATION & USER MANAGEMENT

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Email/password registration | DONE | `/api/auth/register` | `RegisterPage` | Creates user + org (OWNER role) |
| Email/password login | DONE | `/api/auth/login` | `LoginPage` | |
| 2FA (TOTP) | DONE | `/api/team/me/2fa/*` | `TeamSecurityPanel` | Setup, enable, disable |
| Google OAuth | DONE | `/api/auth/oauth/google/*` | `GoogleAuthButton` | |
| Microsoft OAuth | DONE | `/api/auth/oauth/microsoft/*` | Backend only | No frontend button |
| Password reset (email) | DONE | `/api/auth/forgot-password` | `ForgotPasswordPage` | SMTP email with token |
| Token refresh | DONE | `/api/auth/refresh` | Axios interceptor | Auto-refresh on 401 |
| Multi-org support | DONE | `OrganizationUser` junction | `AuthContext` | User can belong to multiple orgs |
| Role-based access | DONE | 4 roles: OWNER, ADMIN, SUPERVISOR, AGENT | Nav filtering | |
| Granular permissions | DONE | `loadPermissions` middleware | Role permissions matrix UI | Per-role permission overrides |
| Session management | DONE | `RefreshToken` model | `TeamSecurityPanel` | List + revoke sessions |

---

## 2. WHATSAPP CONNECTION

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Meta Embedded Signup OAuth | DONE | `/api/whatsapp/connect-url` | `WhatsappCallbackPage` | Full OAuth flow |
| Manual connect (direct token) | LEGACY — REMOVE | `/api/whatsapp/connect` | Not exposed | Security hardening required |
| Multi-number support | DONE | `WhatsappNumber` model | `NumberSwitcher` | Per-number state caching |
| Disconnect number | DONE | `DELETE /api/whatsapp/numbers/:id` | Settings | |
| Webhook auto-setup | DONE | `/api/whatsapp/setup-webhook` | Automatic on connect | |
| Webhook health check | DONE | `/api/whatsapp/webhook-status` | Settings | |
| Meta App ID/Secret config | SERVER LEGACY — REMOVE | `PATCH /api/whatsapp/meta-config` | Not exposed | Platform credentials only |
| Quality rating tracking | DONE | Worker (24h poll) | `QualityRatingBanner` | |

---

## 3. INBOX & MESSAGING

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Conversation list | DONE | `GET /api/inbox/` | `InboxPage` | Paginated, filterable |
| Chat view with messages | DONE | `GET /api/inbox/:id/messages` | `MessageBubble` | |
| Send text message | DONE | `POST /api/inbox/:id/messages` | `ChatComposer` | |
| Send template message | DONE | Template type | `TemplateComposer` | |
| Send interactive message | DONE | Interactive type | `InteractiveComposer` | Buttons, lists, CTA |
| Send image/video/doc/audio | DONE | Media types | `ChatComposer` file picker | |
| Real-time message delivery | DONE | Socket.IO `message:new` | Live updates | |
| Message status tracking | DONE | Socket.IO `message:status` | Status icons | Sent/delivered/read/failed |
| Service window (24h) | DONE | `cs24hWindowOpensAt` field | `ServiceWindowBanner` | |
| Conversation assignment | DONE | `PATCH /api/inbox/:id/assign` | `InboxDetailsPanel` | |
| Conversation status | DONE | `PATCH /api/inbox/:id/status` | Filters | Open/Pending/Closed |
| Snooze conversation | DONE | `PATCH /api/inbox/:id/snooze` | Context menu | |
| Internal notes | DONE | `POST /api/inbox/:id/notes` | `InboxDetailsPanel` | Agent-only notes |
| Labels | DONE | `/api/labels/*` | `InboxDetailsPanel` | |
| Bot toggle per conversation | DONE | `PATCH /api/inbox/:id/bot` | Header actions | |
| Media viewer | DONE | `GET /api/inbox/messages/:id/media` | `MediaViewer` | Gallery with prev/next |
| New conversation | DONE | `POST /api/inbox/start` | `NewChatSlideOver` | |
| Canned replies | DONE | `/api/canned-replies/*` | `ChatComposer` | `/shortcut` trigger |
| Context menu | DONE | — | `ChatContextMenu` | Right-click actions |
| Keyboard shortcuts | DONE | — | `useInboxKeyboardShortcuts` | R=search, Esc=close, D=details |
| Payment link sending | DONE | `POST /api/billing/create-payment-link` | `ChatComposer` | Razorpay integration |

---

## 4. AUTOMATIONS

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Keyword triggers | DONE | `TriggerType.KEYWORD` | `AutomationsPage` | Word-boundary match via shared `keywordMatches`. Once per conversation / 24h (`send_reply` log) |
| Welcome message | DONE | `TriggerType.WELCOME` | | New conversation only; also frequency-capped |
| Away message | DONE | `TriggerType.AWAY` | | Org business hours |
| Business hours auto-reply | DONE | `TriggerType.BUSINESS_HOURS` | | Dual during/away copy |
| Lead capture | DONE | `TriggerType.LEAD_CAPTURE` | | Optional keyword; tags contact; frequency-capped |
| AI chatbot trigger | PARTIAL | `TriggerType.AI_CHATBOT` enum only | Sent to AI Bots page | **Not matched** by the rule engine. AI is the inbound fallback queue, not this row type |
| Automation analytics | DONE | `/api/automations/analytics` | `AutomationAnalyticsPanel` | Includes `skipped` (opt-out / CSW / frequency cap) |
| Conflict detection | DONE | `GET /conflicts` + `POST /conflicts/preview` | Banner + save toast | Preview at save (warn, not hard-block). Banner links to the overlapping flow/auto-reply |

---

## 5. FLOW BUILDER

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Visual flow editor | DONE | Flow CRUD | `FlowBuilderPage` | React Flow canvas |
| 26 node types | PARTIAL | `engine.ts` | `FlowStepNode` | `waitingFor: media` is typed but never set. CSW now gates non-template sends |
| 11 trigger types | DONE | `FlowTriggerType` enum (11, not 10) | `FlowSettingsPanel` | `ANY_MESSAGE` is a true catch-all. `CAMPAIGN_REPLY` uses a campaign picker. New starts frequency-capped once / 24h per conversation |
| Draft/publish workflow | DONE | `FlowStatus` enum | Publish / Save draft | **Live** = `PUBLISHED` **and** `enabled`. Match, in-progress, and delay resume all use that gate |
| Version history | DONE | `FlowVersion` model | `FlowVersionsPanel` | Restore to any version |
| Flow templates | DONE | `/api/flows/templates` | `FlowTemplatesSlideOver` | |
| Flow simulation | DONE | `/api/flows/simulate` | `FlowTestPanel` | Dry-run only; not a live phone test |
| Flow analytics | DONE | `/api/flows/:id/analytics` | `FlowAnalyticsPanel` | |
| Flow validation | DONE | `/api/flows/validate` | `FlowValidationWarnings` | Reachability, dangerous send-loops, HTTPS webhook URLs, list row cap |
| Duplicate flow | DONE | `/api/flows/:id/duplicate` | Flow card | OWNER/ADMIN mutation |
| Schedule flow | BACKEND ONLY | `POST /api/flows/:id/schedule` | `flowApi.scheduleStart` unused | No builder control |
| WhatsApp phone preview | DONE | — | `FlowPhoneMockup` | |
| Mobile flow builder | PARTIAL | — | `FlowMobileNav` | No version history on mobile |

---

## 6. AI BOT

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Bot CRUD | DONE | `/api/ai-bot/*` | `AiBotPage` | |
| FAQ knowledge base | DONE | `/api/ai-bot/:id/faq` | Bot detail page | |
| URL ingestion | DONE | `/api/ai-bot/:id/ingest/url` | Bot detail page | Scrape + chunk + embed |
| PDF ingestion | DONE | `/api/ai-bot/:id/ingest/pdf` | Bot detail page | Extract + chunk + embed |
| Bot test | DONE | `/api/ai-bot/:id/test` | Bot detail page | |
| Bot analytics | DONE | `/api/ai-bot/:id/analytics` | `AiBotAnalyticsPanel` | |
| Bot versioning | DONE | `AiBotVersion` model | `AiBotAuditPanel` | Restore to any version |
| Bot audit log | DONE | `AiBotAuditLog` model | `AiBotAuditPanel` | |
| Guardrails | DONE | `guardrails.ts` | — | Content safety filters |
| Rate limiting | DONE | `rate-limit.service.ts` | — | Per-conversation rate limit |
| Handoff to agent | DONE | `handoff.service.ts` | Socket.IO event | |
| Embeddings (RAG) | DONE | `embeddings.service.ts` | — | Azure OpenAI embeddings |
| Bot templates | DONE | — | `AiBotTemplatePicker` | Predefined bot configs |

---

## 7. CAMPAIGNS

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Campaign CRUD | DONE | `/api/campaigns/*` | `CampaignsPage` | |
| Template-based sending | DONE | Template params | `CampaignAudienceSection` | |
| Audience: manual | DONE | Manual phone list | Contact picker | |
| Audience: by tag | DONE | Tag-based | Audience selector | |
| Audience: all contacts | DONE | All opted-in | Audience selector | |
| Audience: segment | DONE | Segment filter | Audience selector | |
| Scheduling | DONE | `scheduledAt` field | Campaign form | |
| Send/pause/resume/cancel | DONE | Send endpoints | Campaign cards | |
| Retry failed | DONE | `/api/campaigns/:id/retry-failed` | Campaign card | |
| Real-time progress | DONE | Socket.IO `campaign:progress` | Live updates | |
| Campaign analytics | DONE | `/api/campaigns/:id/analytics` | `CampaignAnalyticsPanel` | |
| Per-recipient tracking | DONE | `CampaignRecipient` model | `CampaignRecipientTable` | |
| Export CSV | DONE | `/api/campaigns/:id/export` | Export button | |
| Daily send quota | DONE | `/api/campaigns/quota` | `CampaignQuotaBanner` | |
| Cost estimation | DONE | `/api/billing/estimate` | Pre-send | |
| Duplicate campaign | DONE | `/api/campaigns/:id/duplicate` | Campaign card | |
| Test send | DONE | `/api/campaigns/:id/test` | Campaign form | |

---

## 8. CONTACTS & LEADS

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Contact CRUD | DONE | `/api/contacts/*` | `ContactsPage` | |
| Bulk import | DONE | `/api/contacts/import` | `ImportContactsModal` | |
| Bulk actions | DONE | `/api/contacts/bulk` | `ContactBulkBar` | Delete, add/remove tags |
| Tags | DONE | `/api/contacts/tags` | `ContactTagManager` | |
| Export (CSV/JSON) | DONE | `/api/contacts/export` | Export button | |
| Contact detail + timeline | DONE | `/api/contacts/:id/detail` | `ContactDetailPanel` | |
| Activity timeline | DONE | `/api/contacts/:id/timeline` | Timeline view | |
| Lead pipeline | DONE | `/api/leads/*` | `ContactPipelineTab` | Kanban view (7 stages) |
| Create lead from contact | DONE | `/api/leads/from-contact/:id` | Pipeline tab | |

---

## 9. TEMPLATES

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| List templates (from Meta) | DONE | `GET /api/templates/` | `TemplatesPage` | |
| Create template | DONE | `POST /api/templates/` | `TemplateCreateForm` | |
| Meta template library | DONE | `/api/templates/library` | `/templates/library` | Clone Utility/Auth from Meta. Mapping stored on org settings. |
| Template usage analytics | DONE | `/api/templates/:name/usage` | `TemplateDetailPanel` | |
| Resubmit rejected | DONE | `/api/templates/:name/resubmit` | Template card | |
| Test send | DONE | `/api/templates/:name/test-send` | Template card | |
| Upload header media | DONE | `/api/templates/upload-header` | Template form | |
| Delete template | DONE | `DELETE /api/templates/:name` | Template card | |
| Button editor | DONE | — | `TemplateButtonEditor` | |

---

## 10. VOICE CALLING

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Call list + detail | DONE | `GET /api/calling/*` | `CallsPage` | |
| AI voice agent | DONE | `ai-voice-agent.ts` | — | Auto-answer with AI |
| Agent call routing | DONE | `routing.service.ts` | Ring modal | |
| Accept/decline call | DONE | `/api/calling/:id/accept` | `CallRingModal` | |
| Live transcript | DONE | Deepgram STT | `CallDetailView` | Real-time via Socket.IO |
| Outbound callback | DONE | `/api/calling/callback` | Call detail | |
| Call analytics | DONE | `/api/calling/analytics` | `CallAnalyticsPanel` | |
| WebRTC bridge | DONE | `webrtc-bridge.ts` | Signaling | |
| Google TTS | DONE | `google-tts.service.ts` | — | AI voice response |
| Call notes | DONE | `PATCH /api/calling/:id` | Call detail | |
| Settings (enable/disable) | DONE | `/api/calling/settings` | `CallingSettingsPanel` | |

---

## 11. BILLING & SUBSCRIPTION

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Plans (starter/growth/business/enterprise) | DONE | `plans.ts` | `BillingPage` | |
| Razorpay checkout | DONE | `/api/billing/create-order` | `BillingPlanCard` | |
| Payment verification | DONE | `/api/billing/verify` | Callback | |
| Razorpay webhook | DONE | `/api/billing/webhook` | — | Auto-activate plan |
| Usage tracking | DONE | `/api/billing/usage` | `BillingUsageWidget` | |
| Payment history | DONE | `PaymentOrder` model | Billing page | |
| Payment links | DONE | `/api/billing/payment-links` | `ChatComposer` | Send via chat |
| Campaign cost estimation | DONE | `/api/billing/estimate` | Pre-send | |

---

## 12. TEAM MANAGEMENT

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Member CRUD | DONE | `/api/team/*` | `TeamPage` | |
| Roles (OWNER/ADMIN/SUPERVISOR/AGENT) | DONE | `OrgRole` enum | `RoleBadge` | |
| Departments | DONE | `/api/team/departments` | `TeamDepartmentsTab` | |
| Invites (email) | DONE | `/api/team/invites` | `TeamInvitesTab` | |
| Accept invite (public) | DONE | `/api/team/invites/accept` | `AcceptInvitePage` | |
| Availability (ONLINE/AWAY/OFFLINE) | DONE | `/api/team/me/availability` | `AvailabilityBadge` | |
| Auto-assignment strategies | DONE | `assignment.ts` | Team settings | |
| Audit log | DONE | `/api/team/audit` | `TeamAuditTab` | |
| Role permissions matrix | DONE | `/api/team/role-permissions` | `TeamRolesTab` | |
| Conversation reassignment | DONE | `/api/team/:id/reassign` | Member detail | |

---

## 13. ANALYTICS & REPORTING

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Dashboard overview | DONE | `/api/analytics/overview` | `DashboardPage` | 30-day stats |
| Detailed reports | DONE | `/api/analytics/reports` | `ReportsPage` | 7/30/90 day |
| Agent leaderboard | DONE | `/api/analytics/leaderboard` | `ReportsLeaderboardTable` | |
| Agent performance | DONE | Reports endpoint | `ReportsAgentTable` | |
| Template analytics | DONE | `/api/analytics/templates` | `ReportsTemplateTable` | |
| SLA stats | DONE | `/api/compliance/sla` | `ReportsSlaPanel` | |

---

## 14. SETTINGS & CONFIGURATION

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Business hours | DONE | `PATCH /api/settings/business-hours` | Settings page | |
| AI config (Azure OpenAI) | DONE | `PATCH /api/settings/ai` | Settings page | |
| Campaign limits | DONE | `PATCH /api/settings/campaigns` | Settings page | |
| Feature flags | DONE | `/api/settings/feature-flags` | Settings page | Per-org toggles |
| Template rejection alerts | DONE | `/api/settings/alerts` | Settings page | |
| Onboarding wizard | DONE | `/api/onboarding/*` | `OnboardingGate` | 4-step setup |

---

## 15. INTEGRATIONS

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| API keys | DONE | `/api/integrations/api-keys` | `IntegrationsPanel` | |
| Outbound webhooks | DONE | `/api/integrations/webhooks` | `IntegrationsPanel` | 5 events |
| Webhook delivery log | DONE | `/api/integrations/webhooks/:id/deliveries` | Integrations panel | |
| Webhook replay | DONE | `/api/integrations/webhooks/deliveries/:id/replay` | Integrations panel | |
| Zapier integration | DONE | `/api/integrations/zapier` | — | Backend only |
| Google Sheets export | DONE | `/api/integrations/google-sheets/export` | Integrations panel | |
| Public API (v1) | DONE | `/api/v1/*` | — | API key auth |
| OpenAPI spec | DONE | `/api/integrations/openapi` | — | |

---

## 16. COMPLIANCE

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| GDPR data export | DONE | `GET /api/compliance/export` | Integrations panel | |
| GDPR data deletion | DONE | `POST /api/compliance/delete-request` | Integrations panel | 30-day delay |
| Opt-out detection | DONE | `opt-out.service.ts` | — | Auto-detect opt-out messages |
| SLA tracking | DONE | `sla/service.ts` | Reports | |

---

## 17. COMMERCE & CATALOG

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Catalog sync from Meta | DONE | `/api/catalog/sync` | — | Backend only |
| Product listing | DONE | `/api/catalog/products` | — | Backend only |
| Order management | DONE | `/api/commerce/orders` | `CommercePage` | |
| Order status updates | DONE | `PATCH /api/commerce/orders/:id/status` | `CommerceOrderDetailPanel` | |
| Order from inbound | DONE | `createOrderFromInbound` | — | Auto-create from WhatsApp |

---

## 18. CONTENT STUDIO (AI)

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Brand kit | DONE | `/api/content-studio/brand-kit` | Content studio | |
| AI text generation | DONE | `/api/content-studio/composer` | Content studio | |
| AI image generation | DONE | `/api/content-studio/images` | Content studio | |
| AI voice generation | DONE | `/api/content-studio/voices` | Content studio | |
| AI video generation | DONE | `/api/content-studio/videos` | Content studio | |
| Content library | DONE | `/api/content-studio/library` | Content studio | |
| Content calendar | DONE | `/api/content-studio/calendar` | Content studio | |
| Approval workflow | DONE | `/api/content-studio/approvals` | Content studio | |
| Credit tracking | DONE | `GenerationCreditLedger` | Credit display | |

---

## 19. WHATSAPP FLOWS (META NATIVE)

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| WA Forms CRUD | DONE | `/api/wa-forms/*` | `WaFormPicker` in conversation flows | Not the orphan `/automations/meta-flows` builder (`flow-assets`). Promo no longer opens the chat-tree builder as if it were Forms |
| Flow assets CRUD | DONE | `/api/flows-assets/*` | — | |
| Publish to Meta | DONE | `/api/flows-assets/:id/publish` | — | |
| Encrypted data endpoint | DONE | `/api/flows-assets/data` | — | AES encryption |

---

## 20. TICKETS

| Feature | Status | Backend | Frontend | Notes |
|---------|--------|---------|----------|-------|
| Ticket CRUD | DONE | `/api/tickets/*` | `TicketsPage` | |
| Create from conversation | DONE | `/api/tickets/from-conversation/:id` | Ticket card | |
| SLA tracking | DONE | `slaDueAt` field | Ticket detail | |
| Priority levels | DONE | `TicketPriority` enum | Ticket cards | |

---

## SUMMARY

| Category | Feature Count | Status |
|----------|--------------|--------|
| Auth & Users | 11 | All DONE |
| WhatsApp Connection | 8 | All DONE |
| Inbox & Messaging | 21 | All DONE |
| Automations | 8 | 7 DONE, 1 PARTIAL (`AI_CHATBOT` ghost type) |
| Flow Builder | 13 | Mixed — schedule BACKEND ONLY; 2 PARTIAL |
| AI Bot | 13 | All DONE |
| Campaigns | 17 | All DONE |
| Contacts & Leads | 9 | All DONE |
| Templates | 9 | All DONE |
| Voice Calling | 11 | All DONE |
| Billing | 8 | All DONE |
| Team Management | 10 | All DONE |
| Analytics | 6 | All DONE |
| Settings | 6 | All DONE |
| Integrations | 8 | All DONE |
| Compliance | 4 | All DONE |
| Commerce | 5 | All DONE |
| Content Studio | 9 | All DONE |
| WA Forms | 4 | All DONE |
| Tickets | 4 | All DONE |
| **TOTAL** | **184** | **Not all DONE — see category rows** |

### Not Yet Built (from docs/roadmap)

| Feature | Status | Source |
|---------|--------|--------|
| Multi-language UI (i18n) | PLANNED | Enhancement plan |
| Advanced segmentation | PLANNED | Enhancement plan |
| SMS fallback | BACKEND ONLY | `sms-fallback.ts` exists |
| Webhook signature rotation | PLANNED | AUDIT.md |
| Rate limit per-plan tiers | PLANNED | AUDIT.md |
| ESLint / Prettier | MISSING | No config files |
| Client-side tests | PARTIAL | 10 vitest files (inbox/flow-live/flow-waiting); no E2E |
| End-to-end tests | MISSING | No E2E framework |
