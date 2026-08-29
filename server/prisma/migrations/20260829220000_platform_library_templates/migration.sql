-- Samyoj-owned template catalog. Published rows appear in the tenant Template Library.
-- This is not Meta pre-approval: each org still submits to their own WABA.

CREATE TABLE "platform_library_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "icon" TEXT NOT NULL DEFAULT 'file',
    "header" TEXT,
    "body" TEXT NOT NULL,
    "body_hi" TEXT NOT NULL,
    "footer" TEXT,
    "footer_hi" TEXT,
    "buttons" JSONB NOT NULL DEFAULT '[]',
    "body_examples" JSONB NOT NULL DEFAULT '[]',
    "copy" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_library_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_library_templates_slug_key" ON "platform_library_templates"("slug");
CREATE INDEX "platform_library_templates_published_sort_order_idx" ON "platform_library_templates"("published", "sort_order");
