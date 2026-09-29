-- Bind refresh sessions to the organization selected at sign-in.
ALTER TABLE "refresh_tokens"
ADD COLUMN "organization_id" TEXT;

CREATE INDEX "refresh_tokens_organization_id_idx"
ON "refresh_tokens"("organization_id");
