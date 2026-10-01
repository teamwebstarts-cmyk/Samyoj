-- AI Studio packs + a minimal brand profile restored after the Content Studio wipe.
-- brand_kits is recreated with only the columns still used in code
-- (org-profile audience/value-props and AI business context).

CREATE TYPE "StudioPackStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');
CREATE TYPE "StudioOutputType" AS ENUM ('IG_IMAGE', 'IG_CAROUSEL', 'WA_TEMPLATE', 'EMAIL');

CREATE TABLE "studio_packs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "StudioPackStatus" NOT NULL DEFAULT 'GENERATING',
    "error" TEXT,
    "slides" JSONB,
    "photos" JSONB,
    "caption" TEXT,
    "hashtags" JSONB,
    "wa_name" TEXT,
    "wa_body" TEXT,
    "wa_footer" TEXT,
    "wa_buttons" JSONB,
    "email_subject" TEXT,
    "email_body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_packs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "studio_packs_organization_id_created_at_idx" ON "studio_packs"("organization_id" DESC, "created_at" DESC);

ALTER TABLE "studio_packs" ADD CONSTRAINT "studio_packs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "studio_packs" ADD CONSTRAINT "studio_packs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Minimal brand profile (subset of the pre-wipe brand_kits table).
CREATE TABLE "brand_kits" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL DEFAULT 'My Company',
    "audience" TEXT,
    "value_props" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_locale" TEXT NOT NULL DEFAULT 'en-IN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brand_kits_organization_id_key" ON "brand_kits"("organization_id");

ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
