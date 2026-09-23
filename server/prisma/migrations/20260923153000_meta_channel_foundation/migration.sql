-- Phase 0 Meta foundation: Channel + ContactPlatformIdentity.
-- Additive only. Does not touch WhatsappNumber or backfill WA into Channel.

CREATE TYPE "ChannelPlatform" AS ENUM ('WA', 'FB', 'IG');

CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "platform" "ChannelPlatform" NOT NULL,
    "platform_account_id" TEXT NOT NULL,
    "access_token" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_platform_identities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "platform" "ChannelPlatform" NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_platform_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channels_organization_id_platform_platform_account_id_key"
  ON "channels"("organization_id", "platform", "platform_account_id");

CREATE INDEX "channels_platform_platform_account_id_idx"
  ON "channels"("platform", "platform_account_id");

CREATE UNIQUE INDEX "contact_platform_identities_organization_id_platform_external_id_key"
  ON "contact_platform_identities"("organization_id", "platform", "external_id");

CREATE INDEX "contact_platform_identities_organization_id_contact_id_idx"
  ON "contact_platform_identities"("organization_id", "contact_id");

ALTER TABLE "channels"
  ADD CONSTRAINT "channels_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_platform_identities"
  ADD CONSTRAINT "contact_platform_identities_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_platform_identities"
  ADD CONSTRAINT "contact_platform_identities_organization_id_contact_id_fkey"
  FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
