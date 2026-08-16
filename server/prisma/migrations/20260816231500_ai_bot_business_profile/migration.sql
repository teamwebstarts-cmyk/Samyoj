-- Bot-scoped extras for Setup → Write personality / generate FAQs.
-- Additive only — do NOT delete bot rows. Do not apply 20260817003000 (SAMYOJ-57).

ALTER TABLE "ai_bots"
ADD COLUMN IF NOT EXISTS "business_website" TEXT,
ADD COLUMN IF NOT EXISTS "business_notes" TEXT;
