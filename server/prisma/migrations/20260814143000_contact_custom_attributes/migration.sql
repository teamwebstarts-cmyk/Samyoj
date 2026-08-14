-- Contact custom fields for template personalization ({{order_id}}, etc.)

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "custom_attributes" JSONB NOT NULL DEFAULT '{}';
