-- Recurring Samyoj billing ledger.
-- Existing one-shot PaymentOrder rows remain valid and are not auto-enrolled.

CREATE TABLE IF NOT EXISTS "billing_profiles" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "billing_email" TEXT,
  "legal_name" TEXT,
  "gstin" TEXT,
  "address" TEXT,
  "state_code" TEXT,
  "state_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_profiles_organization_id_key"
  ON "billing_profiles"("organization_id");
ALTER TABLE "billing_profiles"
  ADD CONSTRAINT "billing_profiles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "razorpay_subscription_id" TEXT NOT NULL,
  "razorpay_plan_id" TEXT NOT NULL,
  "sku_id" TEXT NOT NULL,
  "plan_tier" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "pending_sku_id" TEXT,
  "pending_plan_tier" TEXT,
  "pending_cadence" TEXT,
  "past_due_at" TIMESTAMP(3),
  "grace_ends_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_subscriptions_razorpay_subscription_id_key"
  ON "billing_subscriptions"("razorpay_subscription_id");
CREATE INDEX IF NOT EXISTS "billing_subscriptions_organization_id_status_idx"
  ON "billing_subscriptions"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "billing_subscriptions_status_grace_ends_at_idx"
  ON "billing_subscriptions"("status", "grace_ends_at");
ALTER TABLE "billing_subscriptions"
  ADD CONSTRAINT "billing_subscriptions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "billing_checkout_sessions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "billing_subscription_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "sku_id" TEXT NOT NULL,
  "plan_tier" TEXT NOT NULL,
  "cadence" TEXT NOT NULL,
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "provider_payment_id" TEXT,
  "signature_verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "billing_checkout_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_checkout_sessions_idempotency_key_key"
  ON "billing_checkout_sessions"("idempotency_key");
CREATE INDEX IF NOT EXISTS "billing_checkout_sessions_organization_id_status_created_at_idx"
  ON "billing_checkout_sessions"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "billing_checkout_sessions_organization_id_sku_id_cadence_idx"
  ON "billing_checkout_sessions"("organization_id", "sku_id", "cadence");
ALTER TABLE "billing_checkout_sessions"
  ADD CONSTRAINT "billing_checkout_sessions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_checkout_sessions"
  ADD CONSTRAINT "billing_checkout_sessions_billing_subscription_id_fkey"
  FOREIGN KEY ("billing_subscription_id") REFERENCES "billing_subscriptions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "billing_charges" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "billing_subscription_id" TEXT NOT NULL,
  "provider_payment_id" TEXT NOT NULL,
  "provider_event_id" TEXT,
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'CAPTURED',
  "period_start" TIMESTAMP(3),
  "period_end" TIMESTAMP(3),
  "failure_code" TEXT,
  "failure_message" TEXT,
  "captured_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_charges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_charges_provider_payment_id_key"
  ON "billing_charges"("provider_payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_charges_provider_event_id_key"
  ON "billing_charges"("provider_event_id");
CREATE INDEX IF NOT EXISTS "billing_charges_organization_id_created_at_idx"
  ON "billing_charges"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "billing_charges_billing_subscription_id_period_end_idx"
  ON "billing_charges"("billing_subscription_id", "period_end");
ALTER TABLE "billing_charges"
  ADD CONSTRAINT "billing_charges_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_charges"
  ADD CONSTRAINT "billing_charges_billing_subscription_id_fkey"
  FOREIGN KEY ("billing_subscription_id") REFERENCES "billing_subscriptions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "billing_invoices" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "financial_year" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'TAX_INVOICE',
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "billing_charge_id" TEXT,
  "payment_order_id" TEXT,
  "recipient_name" TEXT NOT NULL,
  "recipient_email" TEXT,
  "recipient_gstin" TEXT,
  "recipient_address" TEXT,
  "place_of_supply_state_code" TEXT,
  "supplier_name" TEXT NOT NULL DEFAULT 'Samyoj',
  "supplier_gstin" TEXT,
  "supplier_address" TEXT,
  "supplier_state_code" TEXT,
  "sac_code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "taxable_paise" INTEGER NOT NULL,
  "cgst_paise" INTEGER NOT NULL DEFAULT 0,
  "sgst_paise" INTEGER NOT NULL DEFAULT 0,
  "igst_paise" INTEGER NOT NULL DEFAULT 0,
  "total_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "provider_payment_id" TEXT,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_invoices_invoice_number_key"
  ON "billing_invoices"("invoice_number");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_invoices_billing_charge_id_key"
  ON "billing_invoices"("billing_charge_id");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_invoices_payment_order_id_key"
  ON "billing_invoices"("payment_order_id");
CREATE INDEX IF NOT EXISTS "billing_invoices_organization_id_issued_at_idx"
  ON "billing_invoices"("organization_id", "issued_at");
CREATE INDEX IF NOT EXISTS "billing_invoices_organization_id_status_idx"
  ON "billing_invoices"("organization_id", "status");
ALTER TABLE "billing_invoices"
  ADD CONSTRAINT "billing_invoices_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_invoices"
  ADD CONSTRAINT "billing_invoices_billing_charge_id_fkey"
  FOREIGN KEY ("billing_charge_id") REFERENCES "billing_charges"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "billing_invoices"
  ADD CONSTRAINT "billing_invoices_payment_order_id_fkey"
  FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "billing_credit_notes" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "credit_note_number" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "amount_paise" INTEGER NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_credit_notes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_credit_notes_credit_note_number_key"
  ON "billing_credit_notes"("credit_note_number");
CREATE INDEX IF NOT EXISTS "billing_credit_notes_organization_id_issued_at_idx"
  ON "billing_credit_notes"("organization_id", "issued_at");
ALTER TABLE "billing_credit_notes"
  ADD CONSTRAINT "billing_credit_notes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_credit_notes"
  ADD CONSTRAINT "billing_credit_notes_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "billing_invoice_sequences" (
  "financial_year" TEXT NOT NULL,
  "next_number" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_invoice_sequences_pkey" PRIMARY KEY ("financial_year")
);
