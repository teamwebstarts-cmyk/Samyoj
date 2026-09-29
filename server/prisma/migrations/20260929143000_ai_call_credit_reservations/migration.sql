ALTER TABLE "org_ai_credit_balances"
  ADD COLUMN "reserved" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ai_credit_reservations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "ai_credit_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_credit_reservations_call_id_key"
  ON "ai_credit_reservations"("call_id");

CREATE INDEX "ai_credit_reservations_organization_id_status_idx"
  ON "ai_credit_reservations"("organization_id", "status");

ALTER TABLE "ai_credit_reservations"
  ADD CONSTRAINT "ai_credit_reservations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
