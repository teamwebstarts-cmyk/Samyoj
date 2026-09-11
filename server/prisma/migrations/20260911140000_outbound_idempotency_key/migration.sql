-- Inbox/direct send: one client click key maps to one message row.
-- Campaign send: one click key maps to one queueCampaignSend.

ALTER TABLE "messages" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "messages_conversation_id_idempotency_key_key"
ON "messages"("conversation_id", "idempotency_key");

ALTER TABLE "campaigns" ADD COLUMN "send_idempotency_key" TEXT;
CREATE UNIQUE INDEX "campaigns_send_idempotency_key_key"
ON "campaigns"("send_idempotency_key");
