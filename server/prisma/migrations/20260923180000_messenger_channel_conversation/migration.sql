-- Phase 3 Messenger: Conversation.channelId for Page-scoped threads (not WhatsApp).

ALTER TABLE "conversations" ADD COLUMN "channel_id" TEXT;

CREATE UNIQUE INDEX "conversations_organization_id_channel_id_contact_id_key"
  ON "conversations"("organization_id", "channel_id", "contact_id");

CREATE INDEX "conversations_organization_id_channel_id_last_message_at_idx"
  ON "conversations"("organization_id", "channel_id", "last_message_at");

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
