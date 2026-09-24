-- Bind Instagram channels to their parent Page and fail closed on active ownership races.
ALTER TABLE "channels"
  ADD COLUMN "parent_page_id" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "channels"
    WHERE "is_active" = true
    GROUP BY "platform", "platform_account_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add active Meta channel ownership index while duplicate active channels exist';
  END IF;
END $$;

-- Existing single-page test data can be safely associated with its active Page.
UPDATE "channels" AS ig
SET "parent_page_id" = fb."platform_account_id"
FROM "channels" AS fb
WHERE ig."platform" = 'IG'
  AND ig."is_active" = true
  AND ig."parent_page_id" IS NULL
  AND fb."organization_id" = ig."organization_id"
  AND fb."platform" = 'FB'
  AND fb."is_active" = true
  AND (
    SELECT COUNT(*)
    FROM "channels" AS active_fb
    WHERE active_fb."organization_id" = ig."organization_id"
      AND active_fb."platform" = 'FB'
      AND active_fb."is_active" = true
  ) = 1;

CREATE UNIQUE INDEX "channels_platform_platform_account_id_active_key"
  ON "channels"("platform", "platform_account_id")
  WHERE "is_active" = true;
