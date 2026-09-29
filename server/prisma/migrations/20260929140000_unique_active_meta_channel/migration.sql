-- Prevent concurrent connects from creating an inbound-routing black hole.
-- Existing duplicate active rows must be reconciled explicitly; never choose one
-- and silently discard the other organization's channel.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "channels" a
    JOIN "channels" b
      ON a."platform" = b."platform"
     AND a."platform_account_id" = b."platform_account_id"
     AND a."id" < b."id"
    WHERE a."is_active" = true
      AND b."is_active" = true
  ) THEN
    RAISE EXCEPTION
      'Cannot add active Meta channel uniqueness: reconcile duplicate active channels first';
  END IF;
END $$;

CREATE UNIQUE INDEX "channels_active_platform_platform_account_id_key"
  ON "channels"("platform", "platform_account_id")
  WHERE "is_active" = true;
