-- Platform-wide key/value settings (SAMYOJ-57 platform admin billing config).
-- Backfills the table for the PlatformSetting Prisma model added in schema.

CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);
