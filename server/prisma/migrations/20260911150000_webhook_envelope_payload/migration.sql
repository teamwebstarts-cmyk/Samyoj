-- Encrypted inbound envelope so Meta can be acked only after a durable row exists.
ALTER TABLE "provider_webhook_events"
ADD COLUMN IF NOT EXISTS "payload_ciphertext" TEXT,
ADD COLUMN IF NOT EXISTS "request_id" TEXT,
ADD COLUMN IF NOT EXISTS "phone_number_id" TEXT;
