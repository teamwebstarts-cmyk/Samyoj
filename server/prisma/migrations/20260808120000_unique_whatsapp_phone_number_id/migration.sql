-- Deduplicate phone_number_id before unique index.
-- Keep the newest active row per phone_number_id (prefer is_active, then updated_at).
-- Soft-deactivate losers, then delete them so a global unique constraint can apply
-- (inactive duplicates would still violate UNIQUE on phone_number_id).

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY phone_number_id
      ORDER BY
        CASE WHEN is_active THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at DESC
    ) AS rn
  FROM "whatsapp_numbers"
)
UPDATE "whatsapp_numbers" AS wn
SET
  is_active = false,
  updated_at = NOW()
FROM ranked AS r
WHERE wn.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY phone_number_id
      ORDER BY
        CASE WHEN is_active THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at DESC
    ) AS rn
  FROM "whatsapp_numbers"
)
DELETE FROM "whatsapp_numbers" AS wn
USING ranked AS r
WHERE wn.id = r.id
  AND r.rn > 1;

-- CreateUniqueIndex
CREATE UNIQUE INDEX "whatsapp_numbers_phone_number_id_key" ON "whatsapp_numbers"("phone_number_id");
