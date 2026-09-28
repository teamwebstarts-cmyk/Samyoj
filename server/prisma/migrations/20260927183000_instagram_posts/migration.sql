CREATE TYPE "InstagramPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELLED');

CREATE TABLE "instagram_posts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "status" "InstagramPostStatus" NOT NULL DEFAULT 'DRAFT',
    "caption" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "container_id" TEXT,
    "ig_media_id" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_posts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "instagram_posts_organization_id_channel_id_status_idx" ON "instagram_posts"("organization_id", "channel_id", "status");
CREATE INDEX "instagram_posts_status_scheduled_at_idx" ON "instagram_posts"("status", "scheduled_at");

ALTER TABLE "instagram_posts" ADD CONSTRAINT "instagram_posts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instagram_posts" ADD CONSTRAINT "instagram_posts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
