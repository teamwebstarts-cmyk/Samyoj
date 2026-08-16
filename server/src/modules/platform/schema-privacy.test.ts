import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  join(__dirname, '../../../prisma/schema.prisma'),
  'utf8'
);
const migration = readFileSync(
  join(
    __dirname,
    '../../../prisma/migrations/20260817003000_platform_schema_auth/migration.sql'
  ),
  'utf8'
);

function modelBlock(name: string): string {
  const start = schema.indexOf(`model ${name} {`);
  const next = schema.indexOf('\nmodel ', start + 1);
  return schema.slice(start, next === -1 ? schema.length : next);
}

describe('platform schema privacy boundary', () => {
  it('stores only hashed session and CSRF credentials', () => {
    const session = modelBlock('PlatformSession');
    expect(session).toContain('tokenHash');
    expect(session).toContain('csrfTokenHash');
    expect(session).not.toMatch(/\n\s+token\s+String/);
    expect(session).not.toMatch(/\n\s+csrfToken\s+String/);
  });

  it('does not add customer payload, message, contact, phone, or recipient copies', () => {
    for (const model of [
      'ProductEvent',
      'OrgHealthSnapshot',
      'MetaErrorStat',
      'PlatformAuditLog',
      'OutreachLog',
    ]) {
      const block = modelBlock(model);
      expect(block).not.toMatch(
        /\n\s+(payload|messageBody|contactName|phone|recipientEmail|accessToken|webhookToken)\s+/i
      );
    }

    expect(modelBlock('ProductEvent')).not.toContain('metadata');
    expect(modelBlock('ProductEvent')).not.toContain('userId');
    expect(modelBlock('OrgHealthSnapshot')).not.toContain(' Json');
  });

  it('enforces Meta error number ownership in Prisma and SQL', () => {
    const metaErrors = modelBlock('MetaErrorStat');
    const whatsappNumbers = modelBlock('WhatsappNumber');

    expect(metaErrors).toContain(
      '@relation(fields: [organizationId, whatsappNumberId], references: [organizationId, id], onDelete: Restrict)'
    );
    expect(metaErrors).toContain(
      '@@index([organizationId, whatsappNumberId])'
    );
    expect(whatsappNumbers).toContain('metaErrorStats');
    expect(whatsappNumbers).toContain('@@unique([organizationId, id])');

    expect(migration).toContain(
      'CONSTRAINT "meta_error_stats_organization_id_whatsapp_number_id_fkey"'
    );
    expect(migration).toContain(
      'FOREIGN KEY ("organization_id", "whatsapp_number_id")'
    );
    expect(migration).toContain(
      'REFERENCES "whatsapp_numbers"("organization_id", "id")'
    );
    expect(migration).toContain(
      'CREATE INDEX "meta_error_stats_organization_id_whatsapp_number_id_idx"'
    );
  });

  it('ships a hand-written additive migration with retention indexes', () => {
    expect(migration).not.toMatch(
      /\b(DELETE\s+FROM|TRUNCATE|DROP\s+TABLE|DROP\s+COLUMN)\b/i
    );
    for (const table of [
      'platform_operators',
      'platform_sessions',
      'product_events',
      'org_health_snapshots',
      'meta_error_stats',
      'platform_audit_logs',
      'outreach_logs',
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    expect(migration).toContain(
      'CREATE INDEX "product_events_occurred_at_idx"'
    );
    expect(migration).toContain(
      'CREATE INDEX "platform_sessions_expires_at_idx"'
    );
    expect(migration).toContain(
      'CREATE INDEX "platform_audit_logs_created_at_idx"'
    );
    expect(migration).toContain(
      'CREATE INDEX "outreach_logs_created_at_idx"'
    );
  });
});
