/*
  Conversation analytics are returned per phone number. The previous key
  omitted phone_number_id, so polling two numbers on one WABA overwrote the
  earlier number's charge row.
*/

DROP INDEX IF EXISTS "conversation_charges_organization_id_waba_id_category_perio_key";

CREATE UNIQUE INDEX "conversation_charges_org_waba_phone_category_period_key"
  ON "conversation_charges"(
    "organization_id",
    "waba_id",
    "phone_number_id",
    "category",
    "period_start"
  );
