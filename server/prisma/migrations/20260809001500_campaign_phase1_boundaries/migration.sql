ALTER TABLE "contacts"
  ADD COLUMN "consent_version" TEXT,
  ADD COLUMN "consent_decision" JSONB,
  ADD COLUMN "opt_out_at" TIMESTAMP(3);

ALTER TABLE "campaigns"
  ADD COLUMN "run_version" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "CampaignReservationStatus" AS ENUM ('ACTIVE', 'RELEASED');

CREATE TABLE "campaign_quota_ledgers" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "reserved_send_count" INTEGER NOT NULL DEFAULT 0,
  "reserved_budget_cents" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaign_quota_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaign_quota_reservations" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "ledger_id" TEXT NOT NULL,
  "send_count" INTEGER NOT NULL,
  "budget_cents" INTEGER NOT NULL,
  "status" "CampaignReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_at" TIMESTAMP(3),
  CONSTRAINT "campaign_quota_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_quota_ledgers_organization_id_period_start_key"
  ON "campaign_quota_ledgers"("organization_id", "period_start");
CREATE UNIQUE INDEX "campaign_quota_reservations_campaign_id_key"
  ON "campaign_quota_reservations"("campaign_id");
CREATE INDEX "campaign_quota_reservations_organization_id_status_idx"
  ON "campaign_quota_reservations"("organization_id", "status");

ALTER TABLE "campaign_quota_ledgers"
  ADD CONSTRAINT "campaign_quota_ledgers_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_quota_reservations"
  ADD CONSTRAINT "campaign_quota_reservations_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "campaign_quota_reservations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "campaign_quota_reservations_ledger_id_fkey"
  FOREIGN KEY ("ledger_id") REFERENCES "campaign_quota_ledgers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
