-- Phase 5: one Ads Insights snapshot per org. Read-only. Not billing.

CREATE TABLE "meta_ads_snapshots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "spend" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "cpl" TEXT,
    "period_start" TEXT,
    "period_end" TEXT,
    "attribution_label" TEXT NOT NULL DEFAULT '7-day click / 1-day view',
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ads_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_ads_snapshots_organization_id_key"
  ON "meta_ads_snapshots"("organization_id");

ALTER TABLE "meta_ads_snapshots"
  ADD CONSTRAINT "meta_ads_snapshots_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "meta_ads_snapshots"
  ADD CONSTRAINT "meta_ads_snapshots_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
