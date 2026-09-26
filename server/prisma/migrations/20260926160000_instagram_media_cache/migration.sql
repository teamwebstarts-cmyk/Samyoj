-- Cache Instagram post/reel thumbnails per connected IG channel (Graph media_url / thumbnail_url).
CREATE TABLE "instagram_media_cache" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "ig_media_id" TEXT NOT NULL,
    "media_type" TEXT,
    "thumbnail_url" TEXT,
    "permalink" TEXT,
    "caption" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_media_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "instagram_media_cache_channel_id_ig_media_id_key" ON "instagram_media_cache"("channel_id", "ig_media_id");

CREATE INDEX "instagram_media_cache_channel_id_idx" ON "instagram_media_cache"("channel_id");

ALTER TABLE "instagram_media_cache" ADD CONSTRAINT "instagram_media_cache_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
