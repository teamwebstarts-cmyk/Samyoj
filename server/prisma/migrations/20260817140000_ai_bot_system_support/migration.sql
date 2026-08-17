-- Mandatory org Support bots (chat + calling). Non-deletable baseline brains.

ALTER TABLE "ai_bots"
ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN NOT NULL DEFAULT false;

-- Legacy SAMYOJ-52 clones and older defaults become system bots.
UPDATE "ai_bots"
SET "is_system" = true
WHERE "channel" = 'CHAT'
  AND "name" IN ('Support', 'Support Bot');

UPDATE "ai_bots"
SET "is_system" = true
WHERE "channel" = 'CALL'
  AND "name" IN ('Support', 'Calling support');

-- If an org had a default chat bot but no flagged support row, keep the default as system.
UPDATE "ai_bots" AS target
SET "is_system" = true
FROM (
  SELECT DISTINCT ON (organization_id) id
  FROM "ai_bots"
  WHERE "channel" = 'CHAT'
    AND "is_default" = true
    AND NOT EXISTS (
      SELECT 1
      FROM "ai_bots" s
      WHERE s.organization_id = "ai_bots".organization_id
        AND s.channel = 'CHAT'
        AND s.is_system = true
    )
  ORDER BY organization_id, created_at ASC
) AS pick
WHERE target.id = pick.id;
