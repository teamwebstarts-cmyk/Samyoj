-- Backfill remaining unscoped flows/automations/assets for orgs that have
-- exactly one WhatsApp number row (active or not). Never pick a number when
-- the org has more than one.

WITH single_number AS (
  SELECT "organization_id", MIN("id") AS "whatsapp_number_id"
  FROM "whatsapp_numbers"
  GROUP BY "organization_id"
  HAVING COUNT(*) = 1
)
UPDATE "flows" f
SET "whatsapp_number_id" = s."whatsapp_number_id"
FROM single_number s
WHERE f."organization_id" = s."organization_id"
  AND f."whatsapp_number_id" IS NULL;

WITH single_number AS (
  SELECT "organization_id", MIN("id") AS "whatsapp_number_id"
  FROM "whatsapp_numbers"
  GROUP BY "organization_id"
  HAVING COUNT(*) = 1
)
UPDATE "automations" a
SET "whatsapp_number_id" = s."whatsapp_number_id"
FROM single_number s
WHERE a."organization_id" = s."organization_id"
  AND a."whatsapp_number_id" IS NULL;

WITH single_number AS (
  SELECT "organization_id", MIN("id") AS "whatsapp_number_id"
  FROM "whatsapp_numbers"
  GROUP BY "organization_id"
  HAVING COUNT(*) = 1
)
UPDATE "flow_assets" fa
SET "whatsapp_number_id" = s."whatsapp_number_id"
FROM single_number s
WHERE fa."organization_id" = s."organization_id"
  AND fa."whatsapp_number_id" IS NULL;
