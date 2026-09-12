ALTER TABLE "billing_invoices"
  ADD COLUMN IF NOT EXISTS "supplier_name" TEXT NOT NULL DEFAULT 'Samyoj',
  ADD COLUMN IF NOT EXISTS "supplier_gstin" TEXT,
  ADD COLUMN IF NOT EXISTS "supplier_address" TEXT,
  ADD COLUMN IF NOT EXISTS "supplier_state_code" TEXT;
