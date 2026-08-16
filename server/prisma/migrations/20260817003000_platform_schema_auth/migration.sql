-- SAMYOJ-57 phase A: isolated platform identities, sessions, privacy-safe telemetry
-- aggregates, audit and outreach records. Additive only: no customer rows are
-- updated, copied or deleted.

CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'ANALYST');

CREATE TYPE "PlatformProductArea" AS ENUM (
  'AUTH',
  'CONNECT',
  'INBOX',
  'CONTACTS',
  'CAMPAIGNS',
  'AUTOMATIONS',
  'CALLS',
  'AI',
  'BILLING',
  'TEMPLATES'
);

CREATE TYPE "PlatformProductEventName" AS ENUM (
  'login_ok',
  'login_fail',
  'register',
  'invite_accept',
  'whatsapp_oauth_start',
  'whatsapp_connected',
  'whatsapp_disconnect',
  'inbox_open',
  'message_out',
  'message_in',
  'contact_created',
  'csv_imported',
  'campaign_draft',
  'campaign_sent',
  'campaign_failed',
  'flow_published',
  'automation_ran',
  'automation_error',
  'call_started',
  'call_ended',
  'call_failed',
  'ai_chat',
  'ai_call',
  'stt',
  'tts',
  'embed',
  'checkout_start',
  'payment_ok',
  'payment_fail',
  'template_sync',
  'template_rejected'
);

CREATE TYPE "PlatformActivationStage" AS ENUM (
  'REGISTERED',
  'NOT_CONNECTED',
  'CONNECTED_EMPTY',
  'CONTACTS_READY',
  'OUTBOUND_ONLY',
  'LIVE'
);

CREATE TYPE "PlatformMetaErrorCategory" AS ENUM (
  'AUTHENTICATION',
  'RATE_LIMIT',
  'DELIVERY',
  'POLICY',
  'SERVICE_WINDOW',
  'TEMPLATE',
  'UNKNOWN'
);

CREATE TYPE "PlatformOutreachChannel" AS ENUM ('EMAIL');
CREATE TYPE "PlatformOutreachStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

CREATE TABLE "platform_operators" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "PlatformRole" NOT NULL,
  "totp_secret_encrypted" TEXT,
  "mfa_enabled_at" TIMESTAMP(3),
  "disabled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "platform_operators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_sessions" (
  "id" TEXT NOT NULL,
  "operator_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "csrf_token_hash" TEXT NOT NULL,
  "mfa_verified_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "area" "PlatformProductArea" NOT NULL,
  "name" "PlatformProductEventName" NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "org_health_snapshots" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "stage" "PlatformActivationStage" NOT NULL,
  "active_number_count" INTEGER NOT NULL DEFAULT 0,
  "contact_count" INTEGER NOT NULL DEFAULT 0,
  "conversation_count" INTEGER NOT NULL DEFAULT 0,
  "outbound_message_count" INTEGER NOT NULL DEFAULT 0,
  "inbound_message_count" INTEGER NOT NULL DEFAULT 0,
  "campaign_count" INTEGER NOT NULL DEFAULT 0,
  "call_count" INTEGER NOT NULL DEFAULT 0,
  "ai_tokens_month" INTEGER NOT NULL DEFAULT 0,
  "last_login_at" TIMESTAMP(3),
  "plan" TEXT NOT NULL,
  "quality_rating" TEXT,
  "ai_inactive" BOOLEAN NOT NULL DEFAULT false,
  "billing_risk" BOOLEAN NOT NULL DEFAULT false,
  "quality_risk" BOOLEAN NOT NULL DEFAULT false,
  "webhook_stale" BOOLEAN NOT NULL DEFAULT false,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "org_health_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meta_error_stats" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "whatsapp_number_id" TEXT,
  "scope_key" TEXT NOT NULL,
  "code" INTEGER NOT NULL,
  "category" "PlatformMetaErrorCategory" NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "sample_title" TEXT,
  "bucket_date" TIMESTAMP(3) NOT NULL,
  "last_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "meta_error_stats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_audit_logs" (
  "id" TEXT NOT NULL,
  "operator_id" TEXT NOT NULL,
  "organization_id" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "reason" TEXT,
  "before_state" JSONB,
  "after_state" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_logs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "operator_id" TEXT NOT NULL,
  "channel" "PlatformOutreachChannel" NOT NULL,
  "template_id" TEXT NOT NULL,
  "status" "PlatformOutreachStatus" NOT NULL DEFAULT 'QUEUED',
  "error_code" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "outreach_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_operators_email_key"
ON "platform_operators"("email");

CREATE INDEX "platform_operators_role_disabled_at_idx"
ON "platform_operators"("role", "disabled_at");

CREATE UNIQUE INDEX "platform_sessions_token_hash_key"
ON "platform_sessions"("token_hash");

CREATE INDEX "platform_sessions_operator_id_revoked_at_expires_at_idx"
ON "platform_sessions"("operator_id", "revoked_at", "expires_at");

CREATE INDEX "platform_sessions_expires_at_idx"
ON "platform_sessions"("expires_at");

CREATE INDEX "product_events_organization_id_occurred_at_idx"
ON "product_events"("organization_id", "occurred_at");

CREATE INDEX "product_events_area_name_occurred_at_idx"
ON "product_events"("area", "name", "occurred_at");

CREATE INDEX "product_events_occurred_at_idx"
ON "product_events"("occurred_at");

CREATE UNIQUE INDEX "org_health_snapshots_organization_id_captured_at_key"
ON "org_health_snapshots"("organization_id", "captured_at");

CREATE INDEX "org_health_snapshots_stage_captured_at_idx"
ON "org_health_snapshots"("stage", "captured_at");

CREATE INDEX "org_health_snapshots_captured_at_idx"
ON "org_health_snapshots"("captured_at");

CREATE UNIQUE INDEX "meta_error_stats_organization_id_scope_key_code_bucket_date_key"
ON "meta_error_stats"("organization_id", "scope_key", "code", "bucket_date");

CREATE INDEX "meta_error_stats_organization_id_whatsapp_number_id_idx"
ON "meta_error_stats"("organization_id", "whatsapp_number_id");

CREATE INDEX "meta_error_stats_code_last_at_idx"
ON "meta_error_stats"("code", "last_at");

CREATE INDEX "meta_error_stats_organization_id_last_at_idx"
ON "meta_error_stats"("organization_id", "last_at");

CREATE INDEX "meta_error_stats_last_at_idx"
ON "meta_error_stats"("last_at");

CREATE INDEX "platform_audit_logs_operator_id_created_at_idx"
ON "platform_audit_logs"("operator_id", "created_at");

CREATE INDEX "platform_audit_logs_organization_id_created_at_idx"
ON "platform_audit_logs"("organization_id", "created_at");

CREATE INDEX "platform_audit_logs_action_created_at_idx"
ON "platform_audit_logs"("action", "created_at");

CREATE INDEX "platform_audit_logs_created_at_idx"
ON "platform_audit_logs"("created_at");

CREATE INDEX "outreach_logs_organization_id_created_at_idx"
ON "outreach_logs"("organization_id", "created_at");

CREATE INDEX "outreach_logs_operator_id_created_at_idx"
ON "outreach_logs"("operator_id", "created_at");

CREATE INDEX "outreach_logs_status_created_at_idx"
ON "outreach_logs"("status", "created_at");

CREATE INDEX "outreach_logs_created_at_idx"
ON "outreach_logs"("created_at");

ALTER TABLE "platform_sessions"
ADD CONSTRAINT "platform_sessions_operator_id_fkey"
FOREIGN KEY ("operator_id") REFERENCES "platform_operators"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_events"
ADD CONSTRAINT "product_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "org_health_snapshots"
ADD CONSTRAINT "org_health_snapshots_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meta_error_stats"
ADD CONSTRAINT "meta_error_stats_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meta_error_stats"
ADD CONSTRAINT "meta_error_stats_organization_id_whatsapp_number_id_fkey"
FOREIGN KEY ("organization_id", "whatsapp_number_id")
REFERENCES "whatsapp_numbers"("organization_id", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_audit_logs"
ADD CONSTRAINT "platform_audit_logs_operator_id_fkey"
FOREIGN KEY ("operator_id") REFERENCES "platform_operators"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "platform_audit_logs"
ADD CONSTRAINT "platform_audit_logs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "outreach_logs"
ADD CONSTRAINT "outreach_logs_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outreach_logs"
ADD CONSTRAINT "outreach_logs_operator_id_fkey"
FOREIGN KEY ("operator_id") REFERENCES "platform_operators"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
