-- Per-contact calling AI preference (Call detail header). Additive only.
-- Do not apply 20260817003000_platform_schema_auth (SAMYOJ-57).

ALTER TABLE "contacts"
ADD COLUMN IF NOT EXISTS "calling_ai_enabled" BOOLEAN NOT NULL DEFAULT true;
