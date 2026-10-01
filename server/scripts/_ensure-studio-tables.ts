import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sql = `
CREATE TABLE IF NOT EXISTS "ai_studio_packs" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organization_id" TEXT NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "outputs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photo_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pack_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_studio_packs_organization_created_idx" ON "ai_studio_packs" ("organization_id", "created_at");
CREATE TABLE IF NOT EXISTS "ai_studio_handoffs" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organization_id" TEXT NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
    "pack_id" TEXT NOT NULL REFERENCES "ai_studio_packs" ("id") ON DELETE CASCADE,
    "channel" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ai_studio_handoffs_organization_created_idx" ON "ai_studio_handoffs" ("organization_id", "created_at");
`;

async function main() {
  for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log('studio tables ready');
}

main().finally(() => prisma.$disconnect());
