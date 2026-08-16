-- SAMYOJ-52: Chat vs Calling bots (separate brains / Train rows).
-- SAMYOJ-56: number-scoped AI usage rows.
-- Additive only — do NOT delete WhatsappNumber or bot rows.

CREATE TYPE "AiBotChannel" AS ENUM ('CHAT', 'CALL');

ALTER TABLE "ai_bots"
ADD COLUMN IF NOT EXISTS "channel" "AiBotChannel" NOT NULL DEFAULT 'CHAT',
ADD COLUMN IF NOT EXISTS "offer_handoff" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "voice_greeting" TEXT,
ADD COLUMN IF NOT EXISTS "voice_speaker" TEXT,
ADD COLUMN IF NOT EXISTS "voice_language" TEXT;

CREATE INDEX IF NOT EXISTS "ai_bots_organization_id_channel_idx"
ON "ai_bots"("organization_id", "channel");

ALTER TABLE "ai_usage_logs"
ADD COLUMN IF NOT EXISTS "whatsapp_number_id" TEXT;

CREATE INDEX IF NOT EXISTS "ai_usage_logs_organization_id_whatsapp_number_id_created_at_idx"
ON "ai_usage_logs"("organization_id", "whatsapp_number_id", "created_at");

-- Existing orgs had one brain for chat + calls. Copy the default (or oldest)
-- chat bot into a CALL bot with its own Train rows so calling keeps working
-- without sharing the chat bot's knowledge.
WITH sources AS (
  SELECT DISTINCT ON (organization_id)
    id,
    organization_id,
    name,
    enabled,
    instructions,
    handoff_message,
    trigger_keywords,
    handoff_keywords,
    business_hours_only,
    temperature,
    max_tokens,
    rate_limit_per_min
  FROM "ai_bots"
  WHERE "channel" = 'CHAT'
  ORDER BY organization_id, is_default DESC, created_at ASC
),
inserted AS (
  INSERT INTO "ai_bots" (
    id,
    organization_id,
    name,
    enabled,
    is_default,
    channel,
    instructions,
    handoff_message,
    trigger_keywords,
    handoff_keywords,
    offer_handoff,
    business_hours_only,
    temperature,
    max_tokens,
    rate_limit_per_min,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid()::text,
    s.organization_id,
    CASE
      WHEN s.name = 'Support Bot' THEN 'Calling support'
      ELSE s.name || ' (calls)'
    END,
    s.enabled,
    false,
    'CALL'::"AiBotChannel",
    s.instructions,
    s.handoff_message,
    s.trigger_keywords,
    s.handoff_keywords,
    true,
    s.business_hours_only,
    s.temperature,
    s.max_tokens,
    s.rate_limit_per_min,
    NOW(),
    NOW()
  FROM sources s
  WHERE NOT EXISTS (
    SELECT 1
    FROM "ai_bots" existing
    WHERE existing.organization_id = s.organization_id
      AND existing.channel = 'CALL'
  )
  RETURNING id, organization_id
)
INSERT INTO "knowledge_base_items" (
  id,
  bot_id,
  title,
  content,
  source_type,
  source_url,
  embedding,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid()::text,
  i.id,
  kb.title,
  kb.content,
  kb.source_type,
  kb.source_url,
  kb.embedding,
  NOW(),
  NOW()
FROM inserted i
JOIN sources s ON s.organization_id = i.organization_id
JOIN "knowledge_base_items" kb ON kb.bot_id = s.id;
