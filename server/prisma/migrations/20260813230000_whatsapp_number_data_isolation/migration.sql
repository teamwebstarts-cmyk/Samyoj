/*
  Phase 1: make WhatsApp number ownership explicit without deleting history.

  The backfill deliberately keeps unresolved rows nullable and records them in
  whatsapp_number_isolation_reports. An operator can resolve those rows and
  rerun the follow-up backfill before tightening nullable fields.
*/

CREATE TABLE "whatsapp_number_isolation_reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "severity" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_number_isolation_reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "whatsapp_numbers"
  ADD COLUMN "normalized_phone_number" TEXT;

ALTER TABLE "contacts"
  ADD COLUMN "normalized_phone" TEXT,
  ADD COLUMN "whatsapp_number_id" TEXT;

ALTER TABLE "tickets"
  ADD COLUMN "whatsapp_number_id" TEXT;

UPDATE "whatsapp_numbers"
SET "normalized_phone_number" = CASE
  WHEN regexp_replace("phone_number", '[^0-9]', '', 'g') LIKE '00%'
    THEN substring(regexp_replace("phone_number", '[^0-9]', '', 'g') FROM 3)
  ELSE regexp_replace("phone_number", '[^0-9]', '', 'g')
END
WHERE "normalized_phone_number" IS NULL;

UPDATE "contacts"
SET "normalized_phone" = CASE
  WHEN regexp_replace("phone", '[^0-9]', '', 'g') LIKE '00%'
    THEN substring(regexp_replace("phone", '[^0-9]', '', 'g') FROM 3)
  ELSE regexp_replace("phone", '[^0-9]', '', 'g')
END
WHERE "normalized_phone" IS NULL;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('invalid-whatsapp-number:' || "id")::text,
  "organization_id",
  'INVALID_WHATSAPP_NUMBER_IDENTITY',
  "id",
  'BLOCKER',
  jsonb_build_object('phoneNumber', "phone_number", 'normalizedPhoneNumber', "normalized_phone_number")
FROM "whatsapp_numbers"
WHERE COALESCE("normalized_phone_number", '') = '';

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('invalid-contact-phone:' || "id")::text,
  "organization_id",
  'INVALID_CONTACT_PHONE_IDENTITY',
  "id",
  'BLOCKER',
  jsonb_build_object('phone', "phone", 'normalizedPhone', "normalized_phone")
FROM "contacts"
WHERE COALESCE("normalized_phone", '') = '';

/*
  The old organization-wide phone unique index must be removed before cloning
  contacts. The replacement uniqueness is scoped by number below.
*/
DROP INDEX IF EXISTS "contacts_organization_id_phone_key";

/*
  Build one deterministic contact per (legacy contact, WhatsApp number).
  The original row is retained for the earliest number; additional rows are
  clones. Conversations are rewired after clones exist.
*/
CREATE TEMP TABLE "contact_number_scope_map" ON COMMIT DROP AS
WITH contact_numbers AS (
  SELECT
    c."id" AS "legacy_contact_id",
    c."organization_id",
    cv."whatsapp_number_id",
    MIN(cv."created_at") AS "first_conversation_at"
  FROM "contacts" c
  JOIN "conversations" cv
    ON cv."contact_id" = c."id"
   AND cv."organization_id" = c."organization_id"
  WHERE cv."whatsapp_number_id" IS NOT NULL
  GROUP BY c."id", c."organization_id", cv."whatsapp_number_id"
),
ranked AS (
  SELECT
    contact_numbers.*,
    ROW_NUMBER() OVER (
      PARTITION BY "legacy_contact_id"
      ORDER BY "first_conversation_at", "whatsapp_number_id"
    ) AS "scope_rank"
  FROM contact_numbers
)
SELECT
  "legacy_contact_id",
  "organization_id",
  "whatsapp_number_id",
  CASE
    WHEN "scope_rank" = 1 THEN "legacy_contact_id"
    ELSE md5('contact-scope:' || "legacy_contact_id" || ':' || "whatsapp_number_id")::text
  END AS "scoped_contact_id",
  "scope_rank"
FROM ranked;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('multi-number-contact:' || m."legacy_contact_id")::text,
  m."organization_id",
  'MULTI_NUMBER_CONTACT_CLONED',
  m."legacy_contact_id",
  'INFO',
  jsonb_build_object(
    'numberIds',
    (SELECT jsonb_agg(x."whatsapp_number_id" ORDER BY x."whatsapp_number_id")
       FROM "contact_number_scope_map" x
      WHERE x."legacy_contact_id" = m."legacy_contact_id"),
    'strategy', 'original-kept-for-earliest-conversation;-clones-created-for-other-numbers'
  )
FROM "contact_number_scope_map" m
GROUP BY m."legacy_contact_id", m."organization_id"
HAVING COUNT(*) > 1;

INSERT INTO "contacts" (
  "id", "organization_id", "phone", "normalized_phone", "whatsapp_number_id",
  "name", "email", "tags", "notes", "opted_in", "consent_source",
  "consent_at", "consent_version", "consent_decision", "opt_out_at",
  "source", "created_at", "updated_at"
)
SELECT
  m."scoped_contact_id",
  c."organization_id",
  c."phone",
  c."normalized_phone",
  m."whatsapp_number_id",
  c."name",
  c."email",
  c."tags",
  c."notes",
  c."opted_in",
  c."consent_source",
  c."consent_at",
  c."consent_version",
  c."consent_decision",
  c."opt_out_at",
  c."source",
  c."created_at",
  c."updated_at"
FROM "contact_number_scope_map" m
JOIN "contacts" c ON c."id" = m."legacy_contact_id"
WHERE m."scope_rank" > 1;

UPDATE "contacts" c
SET "whatsapp_number_id" = m."whatsapp_number_id"
FROM "contact_number_scope_map" m
WHERE c."id" = m."legacy_contact_id"
  AND m."scope_rank" = 1;

UPDATE "conversations" cv
SET "contact_id" = m."scoped_contact_id"
FROM "contact_number_scope_map" m
WHERE cv."contact_id" = m."legacy_contact_id"
  AND cv."whatsapp_number_id" = m."whatsapp_number_id";

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('orphan-contact:' || c."id")::text,
  c."organization_id",
  'ORPHAN_CONTACT',
  c."id",
  'REVIEW',
  jsonb_build_object('reason', 'contact has no conversation with a known WhatsApp number')
FROM "contacts" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "contact_number_scope_map" m
  WHERE m."legacy_contact_id" = c."id"
);

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('orphan-conversation:' || cv."id")::text,
  cv."organization_id",
  'ORPHAN_CONVERSATION',
  cv."id",
  'REVIEW',
  jsonb_build_object('contactId', cv."contact_id", 'reason', 'conversation has no WhatsApp number')
FROM "conversations" cv
WHERE cv."whatsapp_number_id" IS NULL;

UPDATE "tickets" t
SET "whatsapp_number_id" = cv."whatsapp_number_id"
FROM "conversations" cv
WHERE t."conversation_id" = cv."id"
  AND cv."whatsapp_number_id" IS NOT NULL
  AND t."whatsapp_number_id" IS NULL;

UPDATE "tickets" t
SET "whatsapp_number_id" = c."whatsapp_number_id"
FROM "contacts" c
WHERE t."conversation_id" IS NULL
  AND t."contact_id" = c."id"
  AND c."whatsapp_number_id" IS NOT NULL
  AND t."whatsapp_number_id" IS NULL;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('orphan-ticket:' || t."id")::text,
  t."organization_id",
  'ORPHAN_TICKET',
  t."id",
  'REVIEW',
  jsonb_build_object('conversationId', t."conversation_id", 'contactId', t."contact_id")
FROM "tickets" t
WHERE t."whatsapp_number_id" IS NULL;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('campaign-number-mismatch:' || c."id")::text,
  c."organization_id",
  'CAMPAIGN_NUMBER_OWNERSHIP_MISMATCH',
  c."id",
  'BLOCKER',
  jsonb_build_object('whatsappNumberId', c."whatsapp_number_id", 'numberOrganizationId', n."organization_id")
FROM "campaigns" c
JOIN "whatsapp_numbers" n ON n."id" = c."whatsapp_number_id"
WHERE c."whatsapp_number_id" IS NOT NULL
  AND c."organization_id" <> n."organization_id";

UPDATE "campaigns" c
SET "whatsapp_number_id" = NULL
FROM "whatsapp_numbers" n
WHERE c."whatsapp_number_id" = n."id"
  AND c."organization_id" <> n."organization_id";

UPDATE "campaigns" c
SET "whatsapp_number_id" = candidates."id"
FROM (
  SELECT "organization_id", MIN("id") AS "id"
  FROM "whatsapp_numbers"
  GROUP BY "organization_id"
  HAVING COUNT(*) = 1
) candidates
WHERE c."organization_id" = candidates."organization_id"
  AND c."whatsapp_number_id" IS NULL;

INSERT INTO "whatsapp_number_isolation_reports"
  ("id", "organization_id", "entity_type", "entity_id", "severity", "details")
SELECT
  md5('orphan-campaign:' || c."id")::text,
  c."organization_id",
  'ORPHAN_CAMPAIGN',
  c."id",
  'REVIEW',
  jsonb_build_object('reason', 'campaign number could not be inferred without ambiguity')
FROM "campaigns" c
WHERE c."whatsapp_number_id" IS NULL;

ALTER TABLE "whatsapp_numbers"
  ALTER COLUMN "normalized_phone_number" SET NOT NULL;

ALTER TABLE "contacts"
  ALTER COLUMN "normalized_phone" SET NOT NULL;

ALTER TABLE "conversations"
  DROP CONSTRAINT IF EXISTS "conversations_whatsapp_number_id_fkey";

ALTER TABLE "campaigns"
  DROP CONSTRAINT IF EXISTS "campaigns_whatsapp_number_id_fkey";

CREATE UNIQUE INDEX "whatsapp_numbers_organization_id_id_key"
  ON "whatsapp_numbers"("organization_id", "id");

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_whatsapp_number_ownership_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_whatsapp_number_ownership_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_whatsapp_number_ownership_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_whatsapp_number_ownership_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_number_isolation_reports"
  ADD CONSTRAINT "whatsapp_number_isolation_reports_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "whatsapp_numbers_organization_id_normalized_phone_number_key"
  ON "whatsapp_numbers"("organization_id", "normalized_phone_number");

CREATE UNIQUE INDEX "contacts_organization_id_whatsapp_number_id_normalized_phone_key"
  ON "contacts"("organization_id", "whatsapp_number_id", "normalized_phone");

CREATE INDEX "contacts_organization_id_whatsapp_number_id_idx"
  ON "contacts"("organization_id", "whatsapp_number_id");

CREATE INDEX "tickets_organization_id_whatsapp_number_id_status_idx"
  ON "tickets"("organization_id", "whatsapp_number_id", "status");

CREATE INDEX "whatsapp_number_isolation_reports_organization_id_entity_type_severity_idx"
  ON "whatsapp_number_isolation_reports"("organization_id", "entity_type", "severity");
