-- Instagram comment keyword automations are organization-scoped, not tied to a WhatsApp number.
UPDATE "automations"
SET "whatsapp_number_id" = NULL
WHERE "trigger_type" = 'KEYWORD'
  AND "config"->>'platform' = 'IG'
  AND "whatsapp_number_id" IS NOT NULL;
