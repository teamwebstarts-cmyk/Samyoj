-- Add AI_STUDIO_PACK to the GenerationJobKind enum
ALTER TYPE "GenerationJobKind" ADD VALUE 'AI_STUDIO_PACK';

-- AI Studio packs: persisted generation results that the client can restore or hand off
CREATE TABLE "ai_studio_packs" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "name"            TEXT NOT NULL,
    "brief"           TEXT NOT NULL,
    "language"        TEXT NOT NULL,
    "outputs"         TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photo_names"     TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pack_data"       JSONB NOT NULL,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "ai_studio_packs_organization_created_idx" ON "ai_studio_packs" ("organization_id", "created_at");

-- AI Studio hand-off audit trail
CREATE TABLE "ai_studio_handoffs" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "pack_id"         UUID NOT NULL REFERENCES "ai_studio_packs" ("id") ON DELETE CASCADE,
    "channel"         TEXT NOT NULL,
    "payload"         JSONB,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "ai_studio_handoffs_organization_created_idx" ON "ai_studio_handoffs" ("organization_id", "created_at");
