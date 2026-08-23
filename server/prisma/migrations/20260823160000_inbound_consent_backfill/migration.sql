-- Backfill auditable consent for inbound contacts created before INBOUND consent was recorded.
-- Skips anyone who opted out (opt_out_at set).

UPDATE "contacts"
SET
  "consent_source" = 'INBOUND',
  "consent_at" = COALESCE("consent_at", "created_at"),
  "consent_version" = 'inbound-v1',
  "opted_in" = true
WHERE "source" = 'INBOUND'
  AND "opt_out_at" IS NULL
  AND ("consent_source" IS NULL OR "consent_at" IS NULL);
