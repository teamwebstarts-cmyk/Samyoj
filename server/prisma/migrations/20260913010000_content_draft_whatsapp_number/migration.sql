ALTER TABLE "content_drafts"
  ADD COLUMN IF NOT EXISTS "whatsapp_number_id" TEXT;

CREATE INDEX IF NOT EXISTS "content_drafts_organization_id_whatsapp_number_id_idx"
  ON "content_drafts"("organization_id", "whatsapp_number_id");
