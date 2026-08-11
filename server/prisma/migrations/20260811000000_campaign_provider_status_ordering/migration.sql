ALTER TABLE "campaign_recipients"
  ADD COLUMN "provider_status_at" TIMESTAMP(3),
  ADD COLUMN "provider_event_key" TEXT;

CREATE INDEX "campaign_recipients_provider_status_at_idx"
  ON "campaign_recipients"("provider_status_at");
