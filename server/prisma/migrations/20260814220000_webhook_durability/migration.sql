-- Claim/processing/complete for provider webhooks so a crash cannot
-- permanently suppress Meta/BullMQ retries. Existing rows are COMPLETED.
ALTER TABLE "provider_webhook_events"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "provider_webhook_events_organization_id_status_claimed_at_idx"
ON "provider_webhook_events"("organization_id", "status", "claimed_at");

-- Status ticks that arrived before the local Meta message id was saved.
CREATE TABLE IF NOT EXISTS "unmatched_provider_statuses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "whatsapp_number_id" TEXT,
    "meta_message_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recipient_phone" TEXT,
    "event_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unmatched_provider_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "unmatched_provider_statuses_org_meta_status_event_key"
ON "unmatched_provider_statuses"("organization_id", "meta_message_id", "status", "event_at");

CREATE INDEX IF NOT EXISTS "unmatched_provider_statuses_org_meta_applied_idx"
ON "unmatched_provider_statuses"("organization_id", "meta_message_id", "applied_at");

ALTER TABLE "unmatched_provider_statuses"
ADD CONSTRAINT "unmatched_provider_statuses_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "unmatched_provider_statuses"
ADD CONSTRAINT "unmatched_provider_statuses_org_number_fkey"
FOREIGN KEY ("organization_id", "whatsapp_number_id") REFERENCES "whatsapp_numbers"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
