-- CreateTable
CREATE TABLE "org_feature_flags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_feature_flags_organization_id_idx" ON "org_feature_flags"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_feature_flags_organization_id_flag_key" ON "org_feature_flags"("organization_id", "flag");

-- AddForeignKey
ALTER TABLE "org_feature_flags" ADD CONSTRAINT "org_feature_flags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
