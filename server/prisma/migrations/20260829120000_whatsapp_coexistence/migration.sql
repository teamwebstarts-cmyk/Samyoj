-- WhatsApp coexistence + token health fields on whatsapp_numbers
ALTER TABLE "whatsapp_numbers" ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMP(3);
ALTER TABLE "whatsapp_numbers" ADD COLUMN IF NOT EXISTS "is_on_biz_app" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_numbers" ADD COLUMN IF NOT EXISTS "coexistence_status" TEXT;
ALTER TABLE "whatsapp_numbers" ADD COLUMN IF NOT EXISTS "history_sync_progress" INTEGER;
ALTER TABLE "whatsapp_numbers" ADD COLUMN IF NOT EXISTS "coexistence_offboarded_at" TIMESTAMP(3);
