ALTER TABLE "instagram_comments" ADD COLUMN "private_reply_text" TEXT;
ALTER TABLE "instagram_comments" ADD COLUMN "public_reply_text" TEXT;
ALTER TABLE "instagram_comments" ADD COLUMN "public_reply_sent_at" TIMESTAMP(3);
