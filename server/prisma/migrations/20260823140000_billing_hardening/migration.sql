-- Billing hardening: SKU metadata on payment orders + Razorpay webhook idempotency
ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "sku_id" TEXT;
ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "cadence" TEXT;

CREATE TABLE IF NOT EXISTS "razorpay_webhook_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "razorpay_webhook_events_event_id_key"
ON "razorpay_webhook_events"("event_id");
