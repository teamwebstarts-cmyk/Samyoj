-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'WAITING', 'RESOLVED', 'CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "retention_days_messages" INTEGER NOT NULL DEFAULT 365;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "consent_source" TEXT;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "consent_at" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "snoozed_until" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_organization_id_snoozed_until_idx" ON "conversations"("organization_id", "snoozed_until");

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "title" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "assigned_agent_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "contact_id" TEXT,
    "title" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "sla_due_at" TIMESTAMP(3),
    "assigned_agent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leads_organization_id_stage_idx" ON "leads"("organization_id", "stage");
CREATE INDEX "tickets_organization_id_status_idx" ON "tickets"("organization_id", "status");
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
