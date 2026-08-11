CREATE TABLE "provider_webhook_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_webhook_events_organization_id_event_key_key"
ON "provider_webhook_events"("organization_id", "event_key");
CREATE INDEX "provider_webhook_events_organization_id_created_at_idx"
ON "provider_webhook_events"("organization_id", "created_at");

ALTER TABLE "provider_webhook_events"
ADD CONSTRAINT "provider_webhook_events_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "conversations_organization_id_contact_id_whatsapp_number_id_key"
ON "conversations"("organization_id", "contact_id", "whatsapp_number_id");
