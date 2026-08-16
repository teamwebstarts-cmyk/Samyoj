-- Repeat cadence + per-run recipient rows. Does not delete campaign or recipient history.
ALTER TABLE "campaigns"
ADD COLUMN IF NOT EXISTS "repeat_interval_days" INTEGER,
ADD COLUMN IF NOT EXISTS "repeat_until" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "repeat_max_occurrences" INTEGER,
ADD COLUMN IF NOT EXISTS "repeat_occurrence_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "campaign_recipients"
ADD COLUMN IF NOT EXISTS "run_generation" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "campaign_recipients_campaign_id_phone_key";

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_recipients_campaign_id_phone_run_generation_key"
ON "campaign_recipients"("campaign_id", "phone", "run_generation");
