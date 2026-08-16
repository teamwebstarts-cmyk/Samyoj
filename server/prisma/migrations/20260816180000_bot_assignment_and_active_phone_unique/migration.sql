-- SAMYOJ-46: distinguish Inbox personal picks (MANUAL) from apply-all (APPLIED).
-- null source + null active_bot_id = follow the AI Bot page default.
CREATE TYPE "BotAssignmentSource" AS ENUM ('MANUAL', 'APPLIED');

ALTER TABLE "conversations"
ADD COLUMN IF NOT EXISTS "bot_assignment_source" "BotAssignmentSource";

-- Existing pinned chats were chosen before this flag existed. Treat them as
-- personal so apply-all does not overwrite Inbox picks.
UPDATE "conversations"
SET "bot_assignment_source" = 'MANUAL'
WHERE "active_bot_id" IS NOT NULL
  AND "bot_assignment_source" IS NULL;

CREATE INDEX IF NOT EXISTS "conversations_organization_id_whatsapp_number_id_bot_assignment_source_idx"
ON "conversations"("organization_id", "whatsapp_number_id", "bot_assignment_source");

-- SAMYOJ-49: inactive org A and active org B may share the same Meta phoneNumberId.
-- Additive only — do NOT delete WhatsappNumber rows (historical
-- 20260808120000_unique_whatsapp_phone_number_id DELETEs duplicates; never re-run that).
DROP INDEX IF EXISTS "whatsapp_numbers_phone_number_id_key";
ALTER TABLE "whatsapp_numbers" DROP CONSTRAINT IF EXISTS "whatsapp_numbers_phone_number_id_key";

-- One live owner per Meta id / displayed phone. Inactive history rows are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_numbers_phone_number_id_active_key"
ON "whatsapp_numbers" ("phone_number_id") WHERE "is_active" = true;

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_numbers_normalized_phone_active_key"
ON "whatsapp_numbers" ("normalized_phone_number") WHERE "is_active" = true;

CREATE INDEX IF NOT EXISTS "whatsapp_numbers_phone_number_id_idx"
ON "whatsapp_numbers" ("phone_number_id");
