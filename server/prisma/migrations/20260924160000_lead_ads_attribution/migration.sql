ALTER TABLE "leads"
  ADD COLUMN "meta_form_id" TEXT,
  ADD COLUMN "meta_ad_id" TEXT,
  ADD COLUMN "meta_adset_id" TEXT,
  ADD COLUMN "meta_campaign_id" TEXT;

CREATE INDEX "leads_organization_id_meta_ad_id_idx"
  ON "leads"("organization_id", "meta_ad_id");
