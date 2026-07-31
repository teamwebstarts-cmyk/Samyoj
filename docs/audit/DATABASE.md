# Database — Complete Schema Inventory

> ORM: Prisma 6.3  
> Database: PostgreSQL 16  
> Models: 48  
> Enums: 33  

---

## Multi-Tenancy Pattern

**Shared-database, shared-schema with `organizationId` foreign key.**

- Every tenant model has `organizationId` → `Organization.id`
- Isolation at application layer (no RLS)
- Cascade delete on all child records
- Single user can belong to multiple orgs via `OrganizationUser` junction
- Composite unique constraints for per-tenant uniqueness

---

## All 33 Enums

| Enum | Values |
|------|--------|
| `UserRole` | ADMIN, AGENT |
| `OrgRole` | OWNER, ADMIN, SUPERVISOR, AGENT |
| `AgentAvailability` | ONLINE, AWAY, OFFLINE |
| `TeamInviteStatus` | PENDING, ACCEPTED, EXPIRED, REVOKED |
| `TeamAuditAction` | MEMBER_ADDED, MEMBER_UPDATED, MEMBER_REMOVED, ROLE_CHANGED, INVITE_SENT, INVITE_ACCEPTED, INVITE_REVOKED, AVAILABILITY_CHANGED, DEPARTMENT_CREATED, DEPARTMENT_UPDATED, DEPARTMENT_DELETED, SETTINGS_CHANGED, SESSION_REVOKED, PASSWORD_RESET, TWO_FACTOR_ENABLED, TWO_FACTOR_DISABLED |
| `ConversationStatus` | OPEN, PENDING, CLOSED |
| `ContactSource` | MANUAL, IMPORT, INBOUND, OUTBOUND |
| `MessageDirection` | INBOUND, OUTBOUND |
| `MessageType` | TEXT, IMAGE, DOCUMENT, AUDIO, VIDEO, TEMPLATE, INTERACTIVE, LOCATION, CONTACTS |
| `MessageStatus` | PENDING, SENT, DELIVERED, READ, FAILED |
| `CallDirection` | USER_INITIATED, BUSINESS_INITIATED |
| `CallStatus` | RINGING, CONNECTING, CONNECTED, COMPLETED, FAILED, REJECTED, MISSED, TERMINATED |
| `CallHandler` | AI, AGENT, UNANSWERED |
| `TriggerType` | KEYWORD, WELCOME, AWAY, BUSINESS_HOURS, LEAD_CAPTURE, AI_CHATBOT |
| `FlowTriggerType` | WELCOME, KEYWORD, ANY_MESSAGE, BUSINESS_HOURS, OFF_HOURS, CONTACT_TAG, SEGMENT, MISSED_CALL, CAMPAIGN_REPLY, CALL_COMPLETED |
| `FlowStatus` | DRAFT, PUBLISHED |
| `FlowAssetStatus` | DRAFT, PUBLISHED, DEPRECATED |
| `CampaignStatus` | DRAFT, SCHEDULED, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED |
| `PaymentStatus` | CREATED, AUTHORIZED, CAPTURED, FAILED |
| `KnowledgeSourceType` | FAQ, URL, PDF, DOCUMENT |
| `OrderStatus` | PENDING, PROCESSING, PARTIALLY_SHIPPED, SHIPPED, COMPLETED, CANCELED |
| `OrderPaymentStatus` | PENDING, CAPTURED, FAILED |
| `MediaAssetKind` | IMAGE, VIDEO, AUDIO, DOCUMENT, LOGO |
| `MediaAssetStatus` | DRAFT, IN_REVIEW, APPROVED, PUBLISHED, ARCHIVED |
| `GenerationJobKind` | TEXT, IMAGE, VIDEO, VOICE, STT, TRANSLATION, CATALOG_DESCRIPTION, FAQ_GENERATION, POLICY_TEMPLATE |
| `GenerationJobStatus` | QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED, BLOCKED_BY_POLICY, BUDGET_EXCEEDED |
| `ContentDraftKind` | TEMPLATE_BODY, TEMPLATE_HEADER, TEMPLATE_FOOTER, BUTTON_LABEL, LIST_SECTION, LIST_ROW, FLOW_COPY, CAMPAIGN_COPY, AGENT_REPLY, FAQ, AB_VARIANT, EMAIL_SUBJECT, PUSH_NOTIFICATION, PRODUCT_DESCRIPTION, AD_COPY |
| `ContentDraftStatus` | DRAFT, IN_REVIEW, APPROVED, PUBLISHED, REJECTED, BLOCKED, ARCHIVED |
| `GenerationCreditKind` | TEXT_TOKENS, IMAGES, VIDEO_SECONDS, VOICE_MINUTES, STT_MINUTES |
| `LeadStage` | NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST |
| `TicketStatus` | OPEN, PENDING, WAITING, RESOLVED, CLOSED |
| `TicketPriority` | LOW, MEDIUM, HIGH, URGENT |
| `WebhookDeliveryStatus` | PENDING, SUCCESS, FAILED, DISABLED |

---

## All 48 Models

### Auth & Users

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `User` | `users` | Platform user | id, name, email, passwordHash, role |
| `PasswordResetToken` | `password_reset_tokens` | Reset tokens | userId, token, expiresAt |
| `RefreshToken` | `refresh_tokens` | JWT refresh tokens | token, userId, revokedAt |
| `OAuthAccount` | `oauth_accounts` | OAuth links | userId, provider, providerAccountId |
| `Organization` | `organizations` | Tenant entity | companyName, plan, settings, retentionDays |
| `OrganizationUser` | `organization_users` | User-Org junction | orgId, userId, role, availability, 2FA, departmentId |
| `TeamDepartment` | `team_departments` | Departments | orgId, name, color |
| `TeamInvite` | `team_invites` | Invitations | orgId, email, token, status, expiresAt |
| `TeamAuditLog` | `team_audit_logs` | Audit trail | orgId, actorId, action, targetUserId |

### Messaging

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `WhatsappNumber` | `whatsapp_numbers` | Connected WA numbers | orgId, phoneNumber, phoneNumberId, wabaId, accessToken |
| `Contact` | `contacts` | Customer contacts | orgId, phone, name, email, tags, optedIn |
| `Conversation` | `conversations` | Message threads | orgId, contactId, whatsappNumberId, assignedAgentId, status, botActive, slaDueAt |
| `Message` | `messages` | Individual messages | conversationId, metaMessageId, direction, type, content, status |
| `InternalNote` | `internal_notes` | Agent notes | conversationId, userId, content |
| `Label` | `labels` | Conversation labels | orgId, name, color |
| `ConversationLabel` | `conversation_labels` | M:M junction | conversationId, labelId |
| `CannedReply` | `canned_replies` | Saved replies | orgId, shortcut, title, content |

### Calling

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `Call` | `calls` | Voice calls | orgId, contactId, metaCallId, direction, status, handler, transcript |

### Automations & Flows

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `Automation` | `automations` | Rule-based automations | orgId, name, triggerType, config, enabled |
| `Flow` | `flows` | Visual flows | orgId, name, triggerType, nodes, draftNodes, status, version |
| `FlowVersion` | `flow_versions` | Version history | flowId, version, nodes |
| `FlowAsset` | `flow_assets` | Meta WA Flows | orgId, name, flowJson, metaFlowId, status |
| `AutomationLog` | `automation_logs` | Execution logs | orgId, automationId, flowId, triggerType, action, status |

### AI

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `AiBot` | `ai_bots` | Bot configs | orgId, name, instructions, triggerKeywords, temperature |
| `AiBotVersion` | `ai_bot_versions` | Version history | botId, version, snapshot |
| `AiBotAuditLog` | `ai_bot_audit_logs` | Audit log | botId, action, changes |
| `AiUsageLog` | `ai_usage_logs` | Token tracking | orgId, botId, promptTokens, completionTokens |
| `KnowledgeBaseItem` | `knowledge_base_items` | FAQ/docs | botId, title, content, sourceType, embedding |

### Campaigns

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `Campaign` | `campaigns` | Bulk campaigns | orgId, name, templateName, audienceType, status, sentCount |
| `CampaignRecipient` | `campaign_recipients` | Per-recipient | campaignId, phone, status, metaMessageId |

### Commerce

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `CatalogProduct` | `catalog_products` | Products | orgId, metaCatalogId, name, priceCents |
| `Order` | `orders` | Orders | orgId, contactId, referenceId, status, items, totalCents |

### Content Studio

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `BrandKit` | `brand_kits` | Brand identity | orgId (unique), colors, tone, bannedWords |
| `MediaAsset` | `media_assets` | Generated media | orgId, kind, status, storagePath, mimeType |
| `GenerationJob` | `generation_jobs` | AI generation queue | orgId, kind, status, prompt, resultAssetId |
| `ContentDraft` | `content_drafts` | Content drafts | orgId, kind, status, body, version |
| `ContentDraftAttachment` | `content_draft_attachments` | M:M junction | draftId, assetId, role |
| `GenerationCreditLedger` | `generation_credit_ledger` | Credit tracking | orgId, periodStart, kind, usedUnits |
| `ApprovalLog` | `approval_logs` | Approval actions | orgId, resourceKind, resourceId, action |

### Leads & Tickets

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `Lead` | `leads` | Sales leads | orgId, contactId, title, stage, assignedAgentId |
| `Ticket` | `tickets` | Support tickets | orgId, conversationId, contactId, title, status, priority |

### Integrations & Billing

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| `ApiKey` | `api_keys` | API keys | orgId, name, keyHash, keyPrefix |
| `WebhookEndpoint` | `webhook_endpoints` | Webhook URLs | orgId, url, secret, events, enabled |
| `WebhookDelivery` | `webhook_deliveries` | Delivery log | endpointId, event, status, requestBody |
| `PaymentOrder` | `payment_orders` | Razorpay orders | orgId, razorpayOrderId, planId, amountPaise |
| `ConversationCharge` | `conversation_charges` | WA charges | orgId, wabaId, category, costUsd, costInr |
| `AuditLog` | `audit_logs` | General audit | orgId, userId, action, resource |
| `OrgFeatureFlag` | `org_feature_flags` | Feature flags | orgId, flag, enabled |

---

## Key Relationships

### 1:1
- Organization ↔ BrandKit

### 1:Many (key)
- Organization → 27 child models
- Conversation → Messages, InternalNotes, Calls, Orders, Tickets
- Contact → Conversations, Calls, Orders, Leads, Tickets
- Flow → FlowVersions
- AiBot → AiBotVersions, KnowledgeBaseItems, AuditLogs
- Campaign → CampaignRecipients
- WebhookEndpoint → WebhookDeliveries

### M:M (3)
- User ↔ Organization (via OrganizationUser)
- Conversation ↔ Label (via ConversationLabel)
- ContentDraft ↔ MediaAsset (via ContentDraftAttachment)

---

## Notable Patterns

### Soft Delete
- `RefreshToken.revokedAt` — soft revoke
- `ApiKey.revokedAt` — soft revoke
- `Campaign.pausedAt/cancelledAt` — lifecycle tracking
- No global `deletedAt` pattern

### JSON Fields (25+)
Heavy use of JSON for: settings, permissions, bot state, message metadata, call transcripts, automation config, flow nodes, campaign config, order items, generation params, embeddings

### Array Fields
- `Contact.tags`, `WebhookEndpoint.events`, `AiBot.triggerKeywords/handoffKeywords`
- `BrandKit.bannedWords/mandatoryPhrases/sampleLike/sampleDislike/valueProps/locales`
- `MediaAsset.tags`, `FlowAsset.categories/validationErrors`

### Money
All monetary values stored as **integer cents/paise** (not floats)

### Versioning
- Flow → FlowVersion (1:many)
- AiBot → AiBotVersion (1:many)
- ContentDraft self-reference (parentDraftId + version)

### Denormalization
- `WebhookDelivery.organizationId` (redundant, for query perf)
- `AiBotAuditLog.organizationId` (redundant)
- `AutomationLog.organizationId` (redundant)
