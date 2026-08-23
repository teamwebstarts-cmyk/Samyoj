-- New contacts and conversations default to AI off (opt-in per person / per chat).
-- Existing rows are unchanged; only affects new inserts.

ALTER TABLE "contacts"
ALTER COLUMN "calling_ai_enabled" SET DEFAULT false;

ALTER TABLE "conversations"
ALTER COLUMN "bot_active" SET DEFAULT false;
