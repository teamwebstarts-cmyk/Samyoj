ALTER TABLE "campaign_quota_reservations"
ADD COLUMN "run_version" INTEGER NOT NULL DEFAULT 0;

UPDATE "campaign_quota_reservations" AS reservations
SET "run_version" = campaigns."run_version"
FROM "campaigns" AS campaigns
WHERE campaigns."id" = reservations."campaign_id";

ALTER TABLE "campaign_quota_reservations"
ALTER COLUMN "run_version" DROP DEFAULT;
