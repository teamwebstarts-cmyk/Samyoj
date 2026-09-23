-- Phase 1 Lead Ads: Lead.metaLeadId + channelId, Channel.name.
-- Additive only. Contact.phone stays required. No Lead.amount.

ALTER TABLE "channels" ADD COLUMN "name" TEXT;

ALTER TABLE "leads" ADD COLUMN "channel_id" TEXT;
ALTER TABLE "leads" ADD COLUMN "meta_lead_id" TEXT;

CREATE UNIQUE INDEX "leads_organization_id_meta_lead_id_key"
  ON "leads"("organization_id", "meta_lead_id");

CREATE INDEX "leads_organization_id_source_idx"
  ON "leads"("organization_id", "source");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
