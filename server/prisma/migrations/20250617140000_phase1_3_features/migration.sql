-- AlterTable: 24h CSW tracking
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "cs24h_window_opens_at" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "FlowAssetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- CreateTable
CREATE TABLE "flow_assets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "flow_json" JSONB NOT NULL,
    "meta_flow_id" TEXT,
    "meta_status" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "FlowAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "validation_errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "flow_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flow_assets_organization_id_status_idx" ON "flow_assets"("organization_id", "status");
ALTER TABLE "flow_assets" ADD CONSTRAINT "flow_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Order enums and tables
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'COMPLETED', 'CANCELED');
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'CAPTURED', 'FAILED');

CREATE TABLE "catalog_products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meta_catalog_id" TEXT NOT NULL,
    "meta_product_id" TEXT,
    "retailer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "image_url" TEXT,
    "availability" TEXT NOT NULL DEFAULT 'in stock',
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_products_organization_id_meta_catalog_id_retailer_id_key" ON "catalog_products"("organization_id", "meta_catalog_id", "retailer_id");
CREATE INDEX "catalog_products_organization_id_meta_catalog_id_idx" ON "catalog_products"("organization_id", "meta_catalog_id");
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "conversation_id" TEXT,
    "reference_id" TEXT NOT NULL,
    "catalog_id" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "items" JSONB NOT NULL,
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "shipping_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status_note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orders_organization_id_reference_id_key" ON "orders"("organization_id", "reference_id");
CREATE INDEX "orders_organization_id_status_idx" ON "orders"("organization_id", "status");
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Content Studio enums and tables
CREATE TYPE "MediaAssetKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'LOGO');
CREATE TYPE "MediaAssetStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "GenerationJobKind" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'VOICE', 'STT', 'TRANSLATION', 'CATALOG_DESCRIPTION', 'FAQ_GENERATION', 'POLICY_TEMPLATE');
CREATE TYPE "GenerationJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED_BY_POLICY', 'BUDGET_EXCEEDED');
CREATE TYPE "ContentDraftKind" AS ENUM ('TEMPLATE_BODY', 'TEMPLATE_HEADER', 'TEMPLATE_FOOTER', 'BUTTON_LABEL', 'LIST_SECTION', 'LIST_ROW', 'FLOW_COPY', 'CAMPAIGN_COPY', 'AGENT_REPLY', 'FAQ', 'AB_VARIANT', 'EMAIL_SUBJECT', 'PUSH_NOTIFICATION', 'PRODUCT_DESCRIPTION', 'AD_COPY');
CREATE TYPE "ContentDraftStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'BLOCKED', 'ARCHIVED');
CREATE TYPE "GenerationCreditKind" AS ENUM ('TEXT_TOKENS', 'IMAGES', 'VIDEO_SECONDS', 'VOICE_MINUTES', 'STT_MINUTES');

CREATE TABLE "brand_kits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "logo_primary_asset_id" TEXT,
    "logo_mono_asset_id" TEXT,
    "color_primary" TEXT,
    "color_secondary" TEXT,
    "color_accent" TEXT,
    "font_heading" TEXT,
    "font_body" TEXT,
    "tone_formal" INTEGER NOT NULL DEFAULT 60,
    "tone_brief" INTEGER NOT NULL DEFAULT 40,
    "tone_friendly" INTEGER NOT NULL DEFAULT 70,
    "tone_playful" INTEGER NOT NULL DEFAULT 30,
    "banned_words" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mandatory_phrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sample_like" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sample_dislike" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience" TEXT,
    "value_props" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_locale" TEXT NOT NULL DEFAULT 'en-IN',
    "locales" TEXT[] DEFAULT ARRAY['en-IN']::TEXT[],
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_kits_organization_id_key" ON "brand_kits"("organization_id");
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "provider" TEXT,
    "model_used" TEXT,
    "prompt" TEXT,
    "negative_prompt" TEXT,
    "params" JSONB,
    "storage_driver" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "public_url" TEXT,
    "cdn_url" TEXT,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "width_px" INTEGER,
    "height_px" INTEGER,
    "locale" TEXT,
    "brand_kit_id" TEXT,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "folder" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "media_assets_organization_id_kind_status_idx" ON "media_assets"("organization_id", "kind", "status");
CREATE INDEX "media_assets_organization_id_created_at_idx" ON "media_assets"("organization_id", "created_at");
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "GenerationJobKind" NOT NULL,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "model_used" TEXT,
    "prompt" TEXT,
    "params" JSONB,
    "result_asset_id" TEXT,
    "cost_cents" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "triggered_by" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "generation_jobs_organization_id_created_at_idx" ON "generation_jobs"("organization_id", "created_at");
CREATE INDEX "generation_jobs_organization_id_kind_status_idx" ON "generation_jobs"("organization_id", "kind", "status");
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_result_asset_id_fkey" FOREIGN KEY ("result_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "content_drafts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "kind" "ContentDraftKind" NOT NULL,
    "status" "ContentDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "body" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "template_category" TEXT,
    "meta_template_name" TEXT,
    "meta_template_status" TEXT,
    "meta_rejection_reason" TEXT,
    "brand_kit_id" TEXT,
    "parent_draft_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "content_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_drafts_organization_id_status_kind_idx" ON "content_drafts"("organization_id", "status", "kind");
CREATE INDEX "content_drafts_organization_id_created_at_idx" ON "content_drafts"("organization_id", "created_at");
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "content_draft_attachments" (
    "draft_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "content_draft_attachments_pkey" PRIMARY KEY ("draft_id", "asset_id")
);

ALTER TABLE "content_draft_attachments" ADD CONSTRAINT "content_draft_attachments_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "content_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_draft_attachments" ADD CONSTRAINT "content_draft_attachments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "generation_credit_ledger" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "kind" "GenerationCreditKind" NOT NULL,
    "used_units" BIGINT NOT NULL DEFAULT 0,
    "soft_limit_units" BIGINT NOT NULL DEFAULT 0,
    "hard_limit_units" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "generation_credit_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "generation_credit_ledger_organization_id_period_start_kind_key" ON "generation_credit_ledger"("organization_id", "period_start", "kind");
CREATE INDEX "generation_credit_ledger_organization_id_kind_idx" ON "generation_credit_ledger"("organization_id", "kind");
ALTER TABLE "generation_credit_ledger" ADD CONSTRAINT "generation_credit_ledger_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "approval_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "resource_kind" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_logs_organization_id_resource_kind_resource_id_idx" ON "approval_logs"("organization_id", "resource_kind", "resource_id");
CREATE INDEX "approval_logs_organization_id_created_at_idx" ON "approval_logs"("organization_id", "created_at");
ALTER TABLE "approval_logs" ADD CONSTRAINT "approval_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
