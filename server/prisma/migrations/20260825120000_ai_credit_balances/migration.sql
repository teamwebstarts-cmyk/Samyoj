-- AI credit balances (subscription included + add-on top-ups)

CREATE TABLE "org_ai_credit_balances" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "included_used" INTEGER NOT NULL DEFAULT 0,
    "addon_balance" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_ai_credit_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_credit_purchases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "purchase_type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "credits_granted" INTEGER NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "payment_order_id" TEXT,
    "razorpay_addon_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_credit_purchases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_credit_deductions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "usage_log_id" TEXT,
    "call_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_credit_deductions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_ai_credit_balances_organization_id_pool_key" ON "org_ai_credit_balances"("organization_id", "pool");
CREATE INDEX "org_ai_credit_balances_organization_id_idx" ON "org_ai_credit_balances"("organization_id");

CREATE INDEX "ai_credit_purchases_organization_id_created_at_idx" ON "ai_credit_purchases"("organization_id", "created_at");

CREATE UNIQUE INDEX "ai_credit_deductions_usage_log_id_key" ON "ai_credit_deductions"("usage_log_id");
CREATE UNIQUE INDEX "ai_credit_deductions_call_id_key" ON "ai_credit_deductions"("call_id");
CREATE INDEX "ai_credit_deductions_organization_id_created_at_idx" ON "ai_credit_deductions"("organization_id", "created_at");

ALTER TABLE "org_ai_credit_balances" ADD CONSTRAINT "org_ai_credit_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_credit_purchases" ADD CONSTRAINT "ai_credit_purchases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
