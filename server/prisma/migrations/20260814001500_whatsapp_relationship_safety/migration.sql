/*
  Follow-up safety pass.

  The first isolation migration is already applied and cannot be rewritten.
  This migration never deletes rows. It audits/reconciles relationship scope,
  leaves ambiguous ownership unresolved, and rejects cross-organization rows
  before adding composite foreign keys.
*/

ALTER TABLE "leads"
  ADD COLUMN "whatsapp_number_id" TEXT;

ALTER TABLE "orders"
  ADD COLUMN "whatsapp_number_id" TEXT;

CREATE TEMP TABLE "number_scope_candidates" (
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "number_id" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO "number_scope_candidates" ("entity_type", "entity_id", "number_id")
SELECT 'lead', l."id", cv."whatsapp_number_id"
FROM "leads" l
JOIN "conversations" cv ON cv."id" = (
  SELECT c."id" FROM "conversations" c
  WHERE c."contact_id" = l."contact_id"
    AND c."organization_id" = l."organization_id"
    AND c."whatsapp_number_id" IS NOT NULL
  ORDER BY c."created_at", c."id"
  LIMIT 1
)
WHERE l."contact_id" IS NOT NULL
  AND cv."whatsapp_number_id" IS NOT NULL;

INSERT INTO "number_scope_candidates" ("entity_type", "entity_id", "number_id")
SELECT 'lead', l."id", c."whatsapp_number_id"
FROM "leads" l
JOIN "contacts" c
  ON c."id" = l."contact_id"
 AND c."organization_id" = l."organization_id"
WHERE c."whatsapp_number_id" IS NOT NULL;

INSERT INTO "number_scope_candidates" ("entity_type", "entity_id", "number_id")
SELECT 'order', o."id", cv."whatsapp_number_id"
FROM "orders" o
JOIN "conversations" cv
  ON cv."id" = o."conversation_id"
 AND cv."organization_id" = o."organization_id"
WHERE cv."whatsapp_number_id" IS NOT NULL;

INSERT INTO "number_scope_candidates" ("entity_type", "entity_id", "number_id")
SELECT 'order', o."id", c."whatsapp_number_id"
FROM "orders" o
JOIN "contacts" c
  ON c."id" = o."contact_id"
 AND c."organization_id" = o."organization_id"
WHERE c."whatsapp_number_id" IS NOT NULL;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('relationship-scope-conflict:' || x."entity_type" || ':' || x."entity_id")::text,
  CASE x."entity_type"
    WHEN 'lead' THEN (SELECT "organization_id" FROM "leads" WHERE "id" = x."entity_id")
    ELSE (SELECT "organization_id" FROM "orders" WHERE "id" = x."entity_id")
  END,
  'CROSS_NUMBER_RELATION_CONFLICT',
  x."entity_id",
  'REVIEW',
  jsonb_build_object('entityType', x."entity_type", 'numberIds', x."number_ids")
FROM (
  SELECT "entity_type", "entity_id", jsonb_agg(DISTINCT "number_id") AS "number_ids", COUNT(DISTINCT "number_id") AS "number_count"
  FROM "number_scope_candidates"
  GROUP BY "entity_type", "entity_id"
) x
WHERE x."number_count" > 1
ON CONFLICT ("id") DO NOTHING;

UPDATE "leads" l
SET "whatsapp_number_id" = x."number_id"
FROM (
  SELECT "entity_id", MIN("number_id") AS "number_id"
  FROM "number_scope_candidates"
  WHERE "entity_type" = 'lead'
  GROUP BY "entity_id"
  HAVING COUNT(DISTINCT "number_id") = 1
) x
WHERE l."id" = x."entity_id";

UPDATE "orders" o
SET "whatsapp_number_id" = x."number_id"
FROM (
  SELECT "entity_id", MIN("number_id") AS "number_id"
  FROM "number_scope_candidates"
  WHERE "entity_type" = 'order'
  GROUP BY "entity_id"
  HAVING COUNT(DISTINCT "number_id") = 1
) x
WHERE o."id" = x."entity_id";

UPDATE "tickets" t
SET "whatsapp_number_id" = cv."whatsapp_number_id"
FROM "conversations" cv
WHERE t."conversation_id" = cv."id"
  AND cv."organization_id" = t."organization_id"
  AND cv."whatsapp_number_id" IS NOT NULL
  AND (
    t."whatsapp_number_id" IS NULL
    OR t."whatsapp_number_id" = cv."whatsapp_number_id"
  );

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('ticket-cross-number:' || t."id")::text,
  t."organization_id",
  'CROSS_NUMBER_TICKET',
  t."id",
  'REVIEW',
  jsonb_build_object('ticketNumberId', t."whatsapp_number_id", 'conversationNumberId', cv."whatsapp_number_id")
FROM "tickets" t
JOIN "conversations" cv ON cv."id" = t."conversation_id"
WHERE t."whatsapp_number_id" IS NOT NULL
  AND cv."whatsapp_number_id" IS NOT NULL
  AND t."whatsapp_number_id" <> cv."whatsapp_number_id"
ON CONFLICT ("id") DO NOTHING;

UPDATE "calls" c
SET "whatsapp_number_id" = cv."whatsapp_number_id"
FROM "conversations" cv, "contacts" ct
WHERE c."conversation_id" = cv."id"
  AND ct."id" = c."contact_id"
  AND cv."organization_id" = c."organization_id"
  AND cv."whatsapp_number_id" IS NOT NULL
  AND ct."organization_id" = c."organization_id"
  AND ct."whatsapp_number_id" = cv."whatsapp_number_id"
  AND (
    c."whatsapp_number_id" IS NULL
    OR c."whatsapp_number_id" <> cv."whatsapp_number_id"
  );

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('call-cross-number:' || c."id")::text,
  c."organization_id",
  'CROSS_NUMBER_CALL',
  c."id",
  'REVIEW',
  jsonb_build_object('callNumberId', c."whatsapp_number_id", 'conversationId', c."conversation_id", 'contactId', c."contact_id")
FROM "calls" c
LEFT JOIN "conversations" cv ON cv."id" = c."conversation_id"
LEFT JOIN "contacts" ct ON ct."id" = c."contact_id"
WHERE (cv."whatsapp_number_id" IS NOT NULL AND c."whatsapp_number_id" IS DISTINCT FROM cv."whatsapp_number_id")
   OR (ct."whatsapp_number_id" IS NOT NULL AND c."whatsapp_number_id" IS DISTINCT FROM ct."whatsapp_number_id")
ON CONFLICT ("id") DO NOTHING;

UPDATE "calls" c
SET "whatsapp_number_id" = NULL
WHERE EXISTS (
  SELECT 1
  FROM "whatsapp_number_isolation_reports" r
  WHERE r."id" = md5('call-cross-number:' || c."id")::text
);

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('orphan-campaign-followup:' || c."id")::text,
  c."organization_id",
  'UNRESOLVED_CAMPAIGN_NUMBER',
  c."id",
  'BLOCKER',
  jsonb_build_object('reason', 'campaign ownership is null or requires explicit operator selection')
FROM "campaigns" c
WHERE c."whatsapp_number_id" IS NULL
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('orphan-lead-followup:' || l."id")::text,
  l."organization_id",
  'UNRESOLVED_LEAD_NUMBER',
  l."id",
  'REVIEW',
  jsonb_build_object('reason', 'no single number could be proven from contact/conversation')
FROM "leads" l
WHERE l."whatsapp_number_id" IS NULL
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('orphan-order-followup:' || o."id")::text,
  o."organization_id",
  'UNRESOLVED_ORDER_NUMBER',
  o."id",
  'REVIEW',
  jsonb_build_object('reason', 'no single number could be proven from contact/conversation')
FROM "orders" o
WHERE o."whatsapp_number_id" IS NULL
ON CONFLICT ("id") DO NOTHING;

/*
  These are non-null relationships. Do not weaken them or silently rehome
  them. The preflight script writes the actionable report before deployment;
  this guard prevents constraints from being changed on unsafe data.
*/
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "conversations" cv
    JOIN "contacts" c ON c."id" = cv."contact_id"
    WHERE cv."organization_id" <> c."organization_id"
       OR (cv."whatsapp_number_id" IS NOT NULL AND c."whatsapp_number_id" IS NOT NULL
           AND cv."whatsapp_number_id" <> c."whatsapp_number_id")
  ) OR EXISTS (
    SELECT 1
    FROM "calls" ca
    JOIN "contacts" c ON c."id" = ca."contact_id"
    WHERE ca."organization_id" <> c."organization_id"
  ) THEN
    RAISE EXCEPTION 'Unsafe cross-organization or cross-number non-null relationship; run db:preflight-number-isolation and remediate the report before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "contacts_organization_id_id_key"
  ON "contacts"("organization_id", "id");

CREATE UNIQUE INDEX "conversations_organization_id_id_key"
  ON "conversations"("organization_id", "id");

ALTER TABLE "conversations"
  DROP CONSTRAINT IF EXISTS "conversations_contact_id_fkey";

ALTER TABLE "tickets"
  DROP CONSTRAINT IF EXISTS "tickets_contact_id_fkey",
  DROP CONSTRAINT IF EXISTS "tickets_conversation_id_fkey";

ALTER TABLE "calls"
  DROP CONSTRAINT IF EXISTS "calls_contact_id_fkey",
  DROP CONSTRAINT IF EXISTS "calls_conversation_id_fkey",
  DROP CONSTRAINT IF EXISTS "calls_whatsapp_number_id_fkey";

ALTER TABLE "leads"
  DROP CONSTRAINT IF EXISTS "leads_contact_id_fkey";

ALTER TABLE "orders"
  DROP CONSTRAINT IF EXISTS "orders_contact_id_fkey",
  DROP CONSTRAINT IF EXISTS "orders_conversation_id_fkey";

ALTER TABLE "campaigns"
  DROP CONSTRAINT IF EXISTS "campaigns_whatsapp_number_ownership_fkey";

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_contact_ownership_fkey"
    FOREIGN KEY ("organization_id", "contact_id")
    REFERENCES "contacts"("organization_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_contact_ownership_fkey"
    FOREIGN KEY ("organization_id", "contact_id")
    REFERENCES "contacts"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "tickets_conversation_ownership_fkey"
    FOREIGN KEY ("organization_id", "conversation_id")
    REFERENCES "conversations"("organization_id", "id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "calls"
  ADD CONSTRAINT "calls_contact_ownership_fkey"
    FOREIGN KEY ("organization_id", "contact_id")
    REFERENCES "contacts"("organization_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "calls_conversation_ownership_fkey"
    FOREIGN KEY ("organization_id", "conversation_id")
    REFERENCES "conversations"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "calls_whatsapp_number_ownership_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_contact_ownership_fkey"
    FOREIGN KEY ("organization_id", "contact_id")
    REFERENCES "contacts"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "leads_whatsapp_number_ownership_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_contact_ownership_fkey"
    FOREIGN KEY ("organization_id", "contact_id")
    REFERENCES "contacts"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "orders_conversation_ownership_fkey"
    FOREIGN KEY ("organization_id", "conversation_id")
    REFERENCES "conversations"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "orders_whatsapp_number_ownership_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "leads_organization_id_whatsapp_number_id_idx"
  ON "leads"("organization_id", "whatsapp_number_id");

CREATE INDEX "orders_organization_id_whatsapp_number_id_idx"
  ON "orders"("organization_id", "whatsapp_number_id");

ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_whatsapp_number_ownership_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
