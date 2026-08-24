-- Campaign list, org scoping, and scheduled processor lookups.
CREATE INDEX IF NOT EXISTS "campaigns_organization_id_idx" ON "campaigns"("organization_id");
CREATE INDEX IF NOT EXISTS "campaigns_organization_id_whatsapp_number_id_idx" ON "campaigns"("organization_id", "whatsapp_number_id");
CREATE INDEX IF NOT EXISTS "campaigns_organization_id_status_idx" ON "campaigns"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "campaigns_status_scheduled_at_idx" ON "campaigns"("status", "scheduled_at");
