-- Inbox/automation outbound send lease. Once this is set, a timeout must not
-- retry the Meta HTTP call (duplicate WhatsApp messages).

ALTER TABLE "messages" ADD COLUMN "provider_call_started_at" TIMESTAMP(3);
