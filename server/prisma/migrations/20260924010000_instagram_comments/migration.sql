-- Phase 4 Instagram comments (DMs reuse Conversation.channelId).

CREATE TABLE "instagram_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "ig_comment_id" TEXT NOT NULL,
    "ig_media_id" TEXT,
    "from_id" TEXT,
    "from_username" TEXT,
    "text" TEXT NOT NULL DEFAULT '',
    "commented_at" TIMESTAMP(3) NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "private_reply_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "instagram_comments_organization_id_ig_comment_id_key"
  ON "instagram_comments"("organization_id", "ig_comment_id");

CREATE INDEX "instagram_comments_organization_id_channel_id_commented_at_idx"
  ON "instagram_comments"("organization_id", "channel_id", "commented_at");

ALTER TABLE "instagram_comments"
  ADD CONSTRAINT "instagram_comments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "instagram_comments"
  ADD CONSTRAINT "instagram_comments_channel_id_fkey"
  FOREIGN KEY ("channel_id") REFERENCES "channels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
