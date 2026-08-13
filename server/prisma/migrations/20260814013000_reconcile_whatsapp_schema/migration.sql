-- Reconcile the live database with schema.prisma without rewriting applied history.
-- This migration only removes redundant indexes and normalizes names/actions.

DROP INDEX IF EXISTS "campaign_recipients_provider_status_at_idx";
DROP INDEX IF EXISTS "leads_organization_id_whatsapp_number_id_idx";
DROP INDEX IF EXISTS "orders_organization_id_whatsapp_number_id_idx";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"tickets"'::regclass
      AND conname = 'tickets_conversation_ownership_fkey'
  ) THEN
    ALTER TABLE "tickets" DROP CONSTRAINT "tickets_conversation_ownership_fkey";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"tickets"'::regclass
      AND conname = 'tickets_organization_id_conversation_id_fkey'
  ) THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_organization_id_conversation_id_fkey"
      FOREIGN KEY ("organization_id", "conversation_id")
      REFERENCES "conversations"("organization_id", "id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  relation_name text;
  old_name text;
  new_name text;
  i integer;
  relation_names text[][] := ARRAY[
    ['calls', 'calls_contact_ownership_fkey', 'calls_organization_id_contact_id_fkey'],
    ['calls', 'calls_conversation_ownership_fkey', 'calls_organization_id_conversation_id_fkey'],
    ['calls', 'calls_whatsapp_number_ownership_fkey', 'calls_organization_id_whatsapp_number_id_fkey'],
    ['campaigns', 'campaigns_whatsapp_number_ownership_fkey', 'campaigns_organization_id_whatsapp_number_id_fkey'],
    ['contacts', 'contacts_whatsapp_number_ownership_fkey', 'contacts_organization_id_whatsapp_number_id_fkey'],
    ['conversations', 'conversations_contact_ownership_fkey', 'conversations_organization_id_contact_id_fkey'],
    ['conversations', 'conversations_whatsapp_number_ownership_fkey', 'conversations_organization_id_whatsapp_number_id_fkey'],
    ['leads', 'leads_contact_ownership_fkey', 'leads_organization_id_contact_id_fkey'],
    ['leads', 'leads_whatsapp_number_ownership_fkey', 'leads_organization_id_whatsapp_number_id_fkey'],
    ['orders', 'orders_contact_ownership_fkey', 'orders_organization_id_contact_id_fkey'],
    ['orders', 'orders_conversation_ownership_fkey', 'orders_organization_id_conversation_id_fkey'],
    ['orders', 'orders_whatsapp_number_ownership_fkey', 'orders_organization_id_whatsapp_number_id_fkey'],
    ['tickets', 'tickets_contact_ownership_fkey', 'tickets_organization_id_contact_id_fkey'],
    ['tickets', 'tickets_whatsapp_number_ownership_fkey', 'tickets_organization_id_whatsapp_number_id_fkey']
  ];
BEGIN
  FOR i IN 1..array_length(relation_names, 1) LOOP
    relation_name := relation_names[i][1];
    old_name := relation_names[i][2];
    new_name := relation_names[i][3];
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = relation_name::regclass AND conname = old_name
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = relation_name::regclass AND conname = new_name
    ) THEN
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', relation_name, old_name, new_name);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"conversations"'::regclass
      AND conname = 'conversations_organization_id_contact_id_fkey'
  ) THEN
    ALTER TABLE "conversations"
      DROP CONSTRAINT "conversations_organization_id_contact_id_fkey";
    ALTER TABLE "conversations"
      ADD CONSTRAINT "conversations_organization_id_contact_id_fkey"
      FOREIGN KEY ("organization_id", "contact_id")
      REFERENCES "contacts"("organization_id", "id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER INDEX IF EXISTS "contacts_organization_id_whatsapp_number_id_normalized_phone_ke"
  RENAME TO "contacts_organization_id_whatsapp_number_id_normalized_phon_key";
ALTER INDEX IF EXISTS "whatsapp_number_isolation_reports_organization_id_entity_type_s"
  RENAME TO "whatsapp_number_isolation_reports_organization_id_entity_ty_idx";
