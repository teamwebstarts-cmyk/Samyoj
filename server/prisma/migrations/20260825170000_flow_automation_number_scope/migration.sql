-- Scope flows, legacy automations, and Meta flow assets to a WhatsApp number workspace.

ALTER TABLE "flows" ADD COLUMN "whatsapp_number_id" TEXT;
ALTER TABLE "automations" ADD COLUMN "whatsapp_number_id" TEXT;
ALTER TABLE "flow_assets" ADD COLUMN "whatsapp_number_id" TEXT;

-- Backfill orgs with exactly one active WhatsApp number.
WITH single_active AS (
  SELECT "organization_id", MIN("id") AS "whatsapp_number_id", COUNT(*) AS "cnt"
  FROM "whatsapp_numbers"
  WHERE "is_active" = true
  GROUP BY "organization_id"
  HAVING COUNT(*) = 1
)
UPDATE "flows" f
SET "whatsapp_number_id" = s."whatsapp_number_id"
FROM single_active s
WHERE f."organization_id" = s."organization_id"
  AND f."whatsapp_number_id" IS NULL;

WITH single_active AS (
  SELECT "organization_id", MIN("id") AS "whatsapp_number_id", COUNT(*) AS "cnt"
  FROM "whatsapp_numbers"
  WHERE "is_active" = true
  GROUP BY "organization_id"
  HAVING COUNT(*) = 1
)
UPDATE "automations" a
SET "whatsapp_number_id" = s."whatsapp_number_id"
FROM single_active s
WHERE a."organization_id" = s."organization_id"
  AND a."whatsapp_number_id" IS NULL;

WITH single_active AS (
  SELECT "organization_id", MIN("id") AS "whatsapp_number_id", COUNT(*) AS "cnt"
  FROM "whatsapp_numbers"
  WHERE "is_active" = true
  GROUP BY "organization_id"
  HAVING COUNT(*) = 1
)
UPDATE "flow_assets" fa
SET "whatsapp_number_id" = s."whatsapp_number_id"
FROM single_active s
WHERE fa."organization_id" = s."organization_id"
  AND fa."whatsapp_number_id" IS NULL;

-- Report unresolved rows for multi-number orgs (operator must assign manually).
INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('unscoped-flow:' || f."id")::text,
  f."organization_id",
  'UNSCOPED_FLOW',
  f."id",
  'WARNING',
  jsonb_build_object('name', f."name")
FROM "flows" f
WHERE f."whatsapp_number_id" IS NULL;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('unscoped-automation:' || a."id")::text,
  a."organization_id",
  'UNSCOPED_AUTOMATION',
  a."id",
  'WARNING',
  jsonb_build_object('name', a."name", 'triggerType', a."trigger_type"::text)
FROM "automations" a
WHERE a."whatsapp_number_id" IS NULL;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('unscoped-flow-asset:' || fa."id")::text,
  fa."organization_id",
  'UNSCOPED_FLOW_ASSET',
  fa."id",
  'WARNING',
  jsonb_build_object('name', fa."name")
FROM "flow_assets" fa
WHERE fa."whatsapp_number_id" IS NULL;

CREATE INDEX "flows_organization_id_whatsapp_number_id_enabled_idx"
  ON "flows"("organization_id", "whatsapp_number_id", "enabled");

CREATE INDEX "automations_organization_id_whatsapp_number_id_enabled_idx"
  ON "automations"("organization_id", "whatsapp_number_id", "enabled");

CREATE INDEX "flow_assets_organization_id_whatsapp_number_id_status_idx"
  ON "flow_assets"("organization_id", "whatsapp_number_id", "status");

ALTER TABLE "flows"
  ADD CONSTRAINT "flows_organization_id_whatsapp_number_id_fkey"
  FOREIGN KEY ("organization_id", "whatsapp_number_id")
  REFERENCES "whatsapp_numbers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "automations"
  ADD CONSTRAINT "automations_organization_id_whatsapp_number_id_fkey"
  FOREIGN KEY ("organization_id", "whatsapp_number_id")
  REFERENCES "whatsapp_numbers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "flow_assets"
  ADD CONSTRAINT "flow_assets_organization_id_whatsapp_number_id_fkey"
  FOREIGN KEY ("organization_id", "whatsapp_number_id")
  REFERENCES "whatsapp_numbers"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
