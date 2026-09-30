-- Scope Gmail contact-derived data to the active WhatsApp workspace.
-- Existing rows remain nullable and are intentionally fail-closed in runtime
-- queries until they are explicitly recreated in a selected workspace.
ALTER TABLE "email_sends"
  ADD COLUMN "whatsapp_number_id" TEXT;

ALTER TABLE "email_attachments"
  ADD COLUMN "whatsapp_number_id" TEXT;

DROP INDEX "email_sends_organization_id_idempotency_key_key";

CREATE UNIQUE INDEX "email_sends_organization_id_whatsapp_number_id_idempotency_key_key"
  ON "email_sends"("organization_id", "whatsapp_number_id", "idempotency_key");

CREATE UNIQUE INDEX "contacts_organization_id_whatsapp_number_id_id_key"
  ON "contacts"("organization_id", "whatsapp_number_id", "id");

CREATE UNIQUE INDEX "email_sends_organization_id_whatsapp_number_id_id_key"
  ON "email_sends"("organization_id", "whatsapp_number_id", "id");

CREATE INDEX "email_sends_organization_id_whatsapp_number_id_status_created_at_idx"
  ON "email_sends"("organization_id", "whatsapp_number_id", "status", "created_at");

CREATE INDEX "email_attachments_organization_id_whatsapp_number_id_expires_at_idx"
  ON "email_attachments"("organization_id", "whatsapp_number_id", "expires_at");

ALTER TABLE "email_sends"
  DROP CONSTRAINT "email_sends_contact_fkey",
  ADD CONSTRAINT "email_sends_whatsapp_number_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "email_sends_contact_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id", "contact_id")
    REFERENCES "contacts"("organization_id", "whatsapp_number_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_attachments"
  DROP CONSTRAINT "email_attachments_email_send_id_fkey",
  ADD CONSTRAINT "email_attachments_whatsapp_number_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id")
    REFERENCES "whatsapp_numbers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "email_attachments_email_send_id_fkey"
    FOREIGN KEY ("organization_id", "whatsapp_number_id", "email_send_id")
    REFERENCES "email_sends"("organization_id", "whatsapp_number_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
