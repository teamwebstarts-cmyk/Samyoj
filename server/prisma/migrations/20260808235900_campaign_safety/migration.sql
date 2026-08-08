ALTER TABLE "campaign_recipients" ADD COLUMN "claim_token" TEXT, ADD COLUMN "claimed_at" TIMESTAMP(3), ADD COLUMN "consent_snapshot" JSONB;
CREATE UNIQUE INDEX "campaign_recipients_claim_token_key" ON "campaign_recipients"("claim_token");
