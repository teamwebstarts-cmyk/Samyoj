-- Professional manual billing ledger.
-- This migration is additive and keeps Organization.plan/plan_expires_at as a
-- compatibility cache while introducing durable payment-period history.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'VERIFICATION_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REVERSED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingEventStatus') THEN
    CREATE TYPE "BillingEventStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
  END IF;
END $$;

-- AI usage rows retain a durable metering state so a provider success cannot
-- hide a failed credit deduction. A worker can retry PENDING_RETRY rows.
ALTER TABLE "ai_usage_logs"
  ADD COLUMN IF NOT EXISTS "metering_status" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "metering_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "metering_error" TEXT,
  ADD COLUMN IF NOT EXISTS "metered_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ai_usage_logs_metering_status_created_at_idx"
  ON "ai_usage_logs"("metering_status", "created_at");

ALTER TABLE "payment_orders"
  ADD COLUMN IF NOT EXISTS "amount_snapshot_paise" INTEGER,
  ADD COLUMN IF NOT EXISTS "currency_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "provider_order_status" TEXT,
  ADD COLUMN IF NOT EXISTS "provider_payment_status" TEXT,
  ADD COLUMN IF NOT EXISTS "verification_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "captured_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failure_code" TEXT,
  ADD COLUMN IF NOT EXISTS "failure_message" TEXT,
  ADD COLUMN IF NOT EXISTS "checkout_intent_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_payment_id_key"
  ON "payment_orders"("payment_id");

CREATE INDEX IF NOT EXISTS "payment_orders_organization_id_checkout_intent_key_status_idx"
  ON "payment_orders"("organization_id", "checkout_intent_key", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_organization_id_sku_id_cadence_checkout_intent_key_key"
  ON "payment_orders"("organization_id", "sku_id", "cadence", "checkout_intent_key");

CREATE TABLE IF NOT EXISTS "plan_periods" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "plan_tier" TEXT NOT NULL,
  "sku_id" TEXT,
  "cadence" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "source_payment_order_id" TEXT,
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "tax_amount_paise" INTEGER NOT NULL DEFAULT 0,
  "supersedes_id" TEXT,
  "superseded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "plan_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_periods_source_payment_order_id_key"
  ON "plan_periods"("source_payment_order_id");
CREATE INDEX IF NOT EXISTS "plan_periods_organization_id_status_ends_at_idx"
  ON "plan_periods"("organization_id", "status", "ends_at");
CREATE INDEX IF NOT EXISTS "plan_periods_organization_id_starts_at_ends_at_idx"
  ON "plan_periods"("organization_id", "starts_at", "ends_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_periods_organization_id_fkey'
  ) THEN
    ALTER TABLE "plan_periods"
      ADD CONSTRAINT "plan_periods_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_periods_source_payment_order_id_fkey'
  ) THEN
    ALTER TABLE "plan_periods"
      ADD CONSTRAINT "plan_periods_source_payment_order_id_fkey"
      FOREIGN KEY ("source_payment_order_id") REFERENCES "payment_orders"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_periods_supersedes_id_fkey'
  ) THEN
    ALTER TABLE "plan_periods"
      ADD CONSTRAINT "plan_periods_supersedes_id_fkey"
      FOREIGN KEY ("supersedes_id") REFERENCES "plan_periods"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "billing_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "payment_order_id" TEXT,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "status" "BillingEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "payload_hash" TEXT,
  "redacted_metadata" JSONB,
  "failure_code" TEXT,
  "failure_message" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_events_provider_event_id_key"
  ON "billing_events"("provider_event_id");
CREATE INDEX IF NOT EXISTS "billing_events_organization_id_created_at_idx"
  ON "billing_events"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "billing_events_payment_order_id_created_at_idx"
  ON "billing_events"("payment_order_id", "created_at");
CREATE INDEX IF NOT EXISTS "billing_events_status_created_at_idx"
  ON "billing_events"("status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_events_organization_id_fkey'
  ) THEN
    ALTER TABLE "billing_events"
      ADD CONSTRAINT "billing_events_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_events_payment_order_id_fkey'
  ) THEN
    ALTER TABLE "billing_events"
      ADD CONSTRAINT "billing_events_payment_order_id_fkey"
      FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Reconstruct periods for already-captured one-time plan payments. Existing
-- add-on orders are intentionally excluded from the plan ledger.
INSERT INTO "plan_periods" (
  "id", "organization_id", "plan_tier", "sku_id", "cadence",
  "starts_at", "ends_at", "status", "source_payment_order_id",
  "amount_paise", "currency", "tax_amount_paise"
)
SELECT
  md5(random()::text || clock_timestamp()::text || p.id),
  p."organization_id",
  CASE lower(p."plan_id")
    WHEN 'business' THEN 'pro'
    ELSE lower(p."plan_id")
  END,
  p."sku_id",
  p."cadence",
  p."paid_at",
  p."paid_at" + (
    CASE lower(coalesce(p."cadence", 'monthly'))
      WHEN 'yearly' THEN INTERVAL '365 days'
      WHEN 'quarterly' THEN INTERVAL '90 days'
      ELSE INTERVAL '30 days'
    END
  ),
  CASE
    WHEN p."paid_at" + (
      CASE lower(coalesce(p."cadence", 'monthly'))
        WHEN 'yearly' THEN INTERVAL '365 days'
        WHEN 'quarterly' THEN INTERVAL '90 days'
        ELSE INTERVAL '30 days'
      END
    ) > CURRENT_TIMESTAMP THEN 'ACTIVE'
    ELSE 'EXPIRED'
  END,
  p."id",
  p."amount_paise",
  p."currency",
  GREATEST(
    0,
    p."amount_paise" - round(p."amount_paise" / 1.18)
  )
FROM "payment_orders" p
WHERE p."status" = 'CAPTURED'
  AND p."paid_at" IS NOT NULL
  AND lower(p."plan_id") IN ('starter', 'growth', 'pro', 'business')
  AND NOT EXISTS (
    SELECT 1 FROM "plan_periods" pp
    WHERE pp."source_payment_order_id" = p."id"
  );

CREATE TABLE IF NOT EXISTS "inbound_contact_overflows" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "whatsapp_number_id" TEXT NOT NULL,
  "meta_message_id" TEXT NOT NULL,
  "contact_phone" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),

  CONSTRAINT "inbound_contact_overflows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inbound_contact_overflows_meta_message_id_key"
  ON "inbound_contact_overflows"("meta_message_id");
CREATE INDEX IF NOT EXISTS "inbound_contact_overflows_organization_id_resolved_at_received_at_idx"
  ON "inbound_contact_overflows"("organization_id", "resolved_at", "received_at");
CREATE INDEX IF NOT EXISTS "inbound_contact_overflows_whatsapp_number_id_received_at_idx"
  ON "inbound_contact_overflows"("whatsapp_number_id", "received_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inbound_contact_overflows_organization_id_fkey'
  ) THEN
    ALTER TABLE "inbound_contact_overflows"
      ADD CONSTRAINT "inbound_contact_overflows_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inbound_contact_overflows_whatsapp_number_id_fkey'
  ) THEN
    ALTER TABLE "inbound_contact_overflows"
      ADD CONSTRAINT "inbound_contact_overflows_whatsapp_number_id_fkey"
      FOREIGN KEY ("whatsapp_number_id") REFERENCES "whatsapp_numbers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "billing_events"
  ADD COLUMN IF NOT EXISTS "processing_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "billing_events"
SET "processing_at" = "created_at"
WHERE "processing_at" IS NULL;
