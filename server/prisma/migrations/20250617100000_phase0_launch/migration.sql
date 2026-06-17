-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'DISABLED');

-- AlterTable
ALTER TABLE "webhook_endpoints" ADD COLUMN "failure_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "whatsapp_numbers" ADD COLUMN "quality_rating" TEXT;

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_status_code" INTEGER,
    "last_error" TEXT,
    "request_body" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_charges" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "waba_id" TEXT NOT NULL,
    "phone_number_id" TEXT,
    "category" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "conversation_count" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost_inr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_deliveries_organization_id_created_at_idx" ON "webhook_deliveries"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_endpoint_id_status_idx" ON "webhook_deliveries"("endpoint_id", "status");

-- CreateIndex
CREATE INDEX "conversation_charges_organization_id_period_start_idx" ON "conversation_charges"("organization_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_charges_organization_id_waba_id_category_period_start_key" ON "conversation_charges"("organization_id", "waba_id", "category", "period_start");

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
