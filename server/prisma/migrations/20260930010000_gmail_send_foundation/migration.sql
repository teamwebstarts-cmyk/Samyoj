-- Additive Gmail send foundation. Existing contacts, messages, and media remain untouched.
CREATE TYPE "GmailMailboxStatus" AS ENUM ('CONNECTED', 'RECONNECT_REQUIRED', 'DISCONNECTED');
CREATE TYPE "EmailSendStatus" AS ENUM ('QUEUED', 'ACCEPTED', 'FAILED', 'RECONNECT_REQUIRED');

ALTER TABLE "contacts"
  ADD COLUMN "email_opted_in" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "email_consent_source" TEXT,
  ADD COLUMN "email_consent_at" TIMESTAMP(3),
  ADD COLUMN "email_consent_version" TEXT,
  ADD COLUMN "email_opt_out_at" TIMESTAMP(3);

CREATE TABLE "gmail_mailboxes" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "provider_account_id" TEXT,
  "access_token_encrypted" TEXT,
  "refresh_token_encrypted" TEXT,
  "token_expires_at" TIMESTAMP(3),
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "GmailMailboxStatus" NOT NULL DEFAULT 'CONNECTED',
  "reconnect_reason" TEXT,
  "connected_by_id" TEXT NOT NULL,
  "disconnected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gmail_mailboxes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_templates" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "mailbox_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "text_body" TEXT NOT NULL,
  "html_body" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_sends" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "mailbox_id" TEXT NOT NULL,
  "template_id" TEXT,
  "contact_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "recipient_email" TEXT NOT NULL,
  "recipient_name" TEXT,
  "subject" TEXT NOT NULL,
  "text_body" TEXT NOT NULL,
  "html_body" TEXT,
  "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED',
  "status_reason" TEXT,
  "error_code" TEXT,
  "gmail_message_id" TEXT,
  "idempotency_key" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "provider_call_started_at" TIMESTAMP(3),
  "accepted_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_attachments" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "email_send_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "gmail_mailboxes"
  ADD CONSTRAINT "gmail_mailboxes_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "gmail_mailboxes_connected_by_id_fkey"
  FOREIGN KEY ("connected_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_templates"
  ADD CONSTRAINT "email_templates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "email_templates_mailbox_id_fkey"
  FOREIGN KEY ("mailbox_id") REFERENCES "gmail_mailboxes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "email_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_sends"
  ADD CONSTRAINT "email_sends_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "email_sends_mailbox_id_fkey"
  FOREIGN KEY ("mailbox_id") REFERENCES "gmail_mailboxes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "email_sends_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "email_sends_contact_fkey"
  FOREIGN KEY ("organization_id", "contact_id") REFERENCES "contacts"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "email_sends_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_attachments"
  ADD CONSTRAINT "email_attachments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "email_attachments_email_send_id_fkey"
  FOREIGN KEY ("email_send_id") REFERENCES "email_sends"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "email_attachments_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "gmail_mailboxes_active_organization_id_key"
  ON "gmail_mailboxes"("organization_id")
  WHERE "status" IN ('CONNECTED', 'RECONNECT_REQUIRED');
CREATE INDEX "gmail_mailboxes_organization_id_status_idx"
  ON "gmail_mailboxes"("organization_id", "status");
CREATE INDEX "gmail_mailboxes_connected_by_id_idx"
  ON "gmail_mailboxes"("connected_by_id");
CREATE UNIQUE INDEX "email_templates_organization_id_name_key"
  ON "email_templates"("organization_id", "name");
CREATE INDEX "email_templates_organization_id_updated_at_idx"
  ON "email_templates"("organization_id", "updated_at");
CREATE UNIQUE INDEX "email_sends_organization_id_idempotency_key_key"
  ON "email_sends"("organization_id", "idempotency_key");
CREATE INDEX "email_sends_organization_id_status_created_at_idx"
  ON "email_sends"("organization_id", "status", "created_at");
CREATE INDEX "email_sends_mailbox_id_status_created_at_idx"
  ON "email_sends"("mailbox_id", "status", "created_at");
CREATE INDEX "email_attachments_organization_id_expires_at_idx"
  ON "email_attachments"("organization_id", "expires_at");
CREATE INDEX "email_attachments_email_send_id_idx"
  ON "email_attachments"("email_send_id");
