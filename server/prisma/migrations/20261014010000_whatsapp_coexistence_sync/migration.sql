ALTER TABLE "whatsapp_numbers" ADD COLUMN IF NOT EXISTS "contacts_sync_request_id" TEXT;
ALTER TABLE "whatsapp_numbers" ADD COLUMN IF NOT EXISTS "history_sync_request_id" TEXT;
