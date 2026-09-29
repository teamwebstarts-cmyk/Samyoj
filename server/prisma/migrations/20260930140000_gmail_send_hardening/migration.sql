-- Harden Gmail sends without changing unrelated channel fields.
ALTER TYPE "EmailSendStatus" ADD VALUE IF NOT EXISTS 'SENDING';
ALTER TYPE "EmailSendStatus" ADD VALUE IF NOT EXISTS 'AMBIGUOUS';

ALTER TABLE "email_sends"
  ADD COLUMN "sending_lease_token" TEXT,
  ADD COLUMN "sending_lease_expires_at" TIMESTAMP(3);

CREATE INDEX "email_sends_status_sending_lease_expires_at_idx"
  ON "email_sends"("status", "sending_lease_expires_at");
