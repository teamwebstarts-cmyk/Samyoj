-- AI recurring Razorpay subscription add-ons

CREATE TABLE "org_ai_recurring_addons" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "razorpay_subscription_id" TEXT NOT NULL,
    "razorpay_plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "current_period_end" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_ai_recurring_addons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "razorpay_plan_cache" (
    "sku_id" TEXT NOT NULL,
    "razorpay_plan_id" TEXT NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "razorpay_plan_cache_pkey" PRIMARY KEY ("sku_id")
);

CREATE UNIQUE INDEX "org_ai_recurring_addons_razorpay_subscription_id_key" ON "org_ai_recurring_addons"("razorpay_subscription_id");
CREATE UNIQUE INDEX "org_ai_recurring_addons_organization_id_sku_id_key" ON "org_ai_recurring_addons"("organization_id", "sku_id");
CREATE INDEX "org_ai_recurring_addons_organization_id_status_idx" ON "org_ai_recurring_addons"("organization_id", "status");

ALTER TABLE "ai_credit_purchases" ADD COLUMN "razorpay_payment_id" TEXT;
CREATE UNIQUE INDEX "ai_credit_purchases_razorpay_payment_id_key" ON "ai_credit_purchases"("razorpay_payment_id");

ALTER TABLE "org_ai_recurring_addons" ADD CONSTRAINT "org_ai_recurring_addons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
