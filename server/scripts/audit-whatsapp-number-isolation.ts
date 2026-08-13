import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/config/database';

type AuditRow = {
  organization_id: string;
  entity_id: string | null;
  details: unknown;
};

async function query<T extends AuditRow>(sql: string): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql);
}

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2
     ) AS exists`,
    table,
    column,
  );
  return rows[0]?.exists === true;
}

async function writeReport(report: unknown) {
  const reportDir = path.resolve(process.cwd(), '../.run/reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'whatsapp-number-isolation-preflight.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.error(`Isolation preflight report: ${reportPath}`);
}

async function persistDurableReports(report: {
  blockers: Record<string, AuditRow[]>;
  review: Record<string, AuditRow[]>;
}) {
  if (!(await tableHasColumn('whatsapp_number_isolation_reports', 'details'))) return;
  for (const [severity, groups] of [
    ['BLOCKER', report.blockers],
    ['REVIEW', report.review],
  ] as const) {
    for (const [entityType, rows] of Object.entries(groups)) {
      for (const row of rows) {
        const normalizedEntityType = entityType
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .toUpperCase();
        const existing = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
          `SELECT EXISTS (
             SELECT 1 FROM whatsapp_number_isolation_reports
             WHERE entity_type = $1
               AND organization_id = $2
               AND entity_id IS NOT DISTINCT FROM $3
           ) AS exists`,
          normalizedEntityType,
          row.organization_id,
          row.entity_id,
        );
        if (existing[0]?.exists) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO whatsapp_number_isolation_reports
             (id, organization_id, entity_type, entity_id, severity, details)
           VALUES (md5($1), $2, $3, $4, $5, $6::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          `${entityType}:${row.organization_id}:${row.entity_id ?? 'group'}:${JSON.stringify(row.details)}`,
          row.organization_id,
          normalizedEntityType,
          row.entity_id,
          severity,
          JSON.stringify(row.details),
        );
      }
    }
  }
}

async function repairProvenNumberDuplicates() {
  const groups = await query<AuditRow>(`
    WITH identities AS (
      SELECT
        organization_id,
        id,
        phone_number_id,
        CASE
          WHEN regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE '00%'
            THEN substring(regexp_replace(phone_number, '[^0-9]', '', 'g') FROM 3)
          ELSE regexp_replace(phone_number, '[^0-9]', '', 'g')
        END AS normalized_phone
      FROM whatsapp_numbers
    )
    SELECT
      organization_id,
      NULL::text AS entity_id,
      jsonb_build_object(
        'normalizedPhone', normalized_phone,
        'numberIds', jsonb_agg(id ORDER BY id),
        'phoneNumberIds', jsonb_agg(DISTINCT phone_number_id)
      ) AS details
    FROM identities
    GROUP BY organization_id, normalized_phone
    HAVING normalized_phone <> '' AND COUNT(*) > 1 AND COUNT(DISTINCT phone_number_id) = 1
  `);

  if (!groups.length) return 0;

  await prisma.$transaction(async (tx) => {
    for (const group of groups) {
      const details = group.details as { numberIds: string[] };
      const ids = details.numberIds;
      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM whatsapp_numbers
         WHERE id = ANY($1::text[])
         ORDER BY is_active DESC, updated_at DESC, created_at DESC, id
         FOR UPDATE`,
        ids,
      );
      const canonical = rows[0]?.id;
      if (!canonical) continue;
      const duplicates = rows.slice(1).map((row) => row.id);
      if (!duplicates.length) continue;

      await tx.$executeRawUnsafe(
        `UPDATE conversations SET whatsapp_number_id = $1 WHERE whatsapp_number_id = ANY($2::text[])`,
        canonical,
        duplicates,
      );
      await tx.$executeRawUnsafe(
        `UPDATE calls SET whatsapp_number_id = $1 WHERE whatsapp_number_id = ANY($2::text[])`,
        canonical,
        duplicates,
      );
      await tx.$executeRawUnsafe(
        `UPDATE tickets SET whatsapp_number_id = $1 WHERE whatsapp_number_id = ANY($2::text[])`,
        canonical,
        duplicates,
      );
      await tx.$executeRawUnsafe(
        `UPDATE campaigns SET whatsapp_number_id = $1 WHERE whatsapp_number_id = ANY($2::text[])`,
        canonical,
        duplicates,
      );
      await tx.$executeRawUnsafe(
        `UPDATE whatsapp_numbers SET is_active = false, updated_at = NOW()
         WHERE id = ANY($1::text[])`,
        duplicates,
      );
    }
  });

  return groups.length;
}

async function main() {
  const hasScopedContacts = await tableHasColumn('contacts', 'whatsapp_number_id');
  const hasScopedTickets = await tableHasColumn('tickets', 'whatsapp_number_id');

  const invalidNumberIdentities = await query(`
    SELECT organization_id, id AS entity_id,
      jsonb_build_object('phoneNumber', phone_number) AS details
    FROM whatsapp_numbers
    WHERE regexp_replace(phone_number, '[^0-9]', '', 'g') = ''
  `);

  const duplicateNumberIdentities = await query(`
    WITH identities AS (
      SELECT organization_id, id, phone_number_id,
        CASE
          WHEN regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE '00%'
            THEN substring(regexp_replace(phone_number, '[^0-9]', '', 'g') FROM 3)
          ELSE regexp_replace(phone_number, '[^0-9]', '', 'g')
        END AS normalized_phone
      FROM whatsapp_numbers
    )
    SELECT organization_id, NULL::text AS entity_id,
      jsonb_build_object(
        'normalizedPhone', normalized_phone,
        'numberIds', jsonb_agg(id ORDER BY id),
        'phoneNumberIds', jsonb_agg(DISTINCT phone_number_id),
        'identityProven', COUNT(DISTINCT phone_number_id) = 1
      ) AS details
    FROM identities
    GROUP BY organization_id, normalized_phone
    HAVING normalized_phone = '' OR COUNT(*) > 1
  `);

  const invalidContactIdentities = await query(`
    SELECT organization_id, id AS entity_id,
      jsonb_build_object('phone', phone) AS details
    FROM contacts
    WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ''
  `);

  const multiNumberContacts = await query(`
    SELECT c.organization_id, c.id AS entity_id,
      jsonb_build_object(
        'numberIds', jsonb_agg(DISTINCT cv.whatsapp_number_id),
        'conversationCount', COUNT(cv.id)
      ) AS details
    FROM contacts c
    JOIN conversations cv ON cv.contact_id = c.id
    WHERE cv.whatsapp_number_id IS NOT NULL
    GROUP BY c.organization_id, c.id
    HAVING COUNT(DISTINCT cv.whatsapp_number_id) > 1
  `);

  const duplicateScopedContacts = hasScopedContacts
    ? await query(`
        SELECT c.organization_id, NULL::text AS entity_id,
          jsonb_build_object(
            'numberId', c.whatsapp_number_id,
            'normalizedPhone', c.normalized_phone,
            'contactIds', jsonb_agg(c.id ORDER BY c.id)
          ) AS details
        FROM contacts c
        WHERE c.whatsapp_number_id IS NOT NULL
        GROUP BY c.organization_id, c.whatsapp_number_id, c.normalized_phone
        HAVING COUNT(*) > 1
      `)
    : [];

  const crossOrganizationRelationships = await query(`
    SELECT 'conversation_contact' AS relationship, cv.organization_id, cv.id AS entity_id,
      jsonb_build_object('contactId', cv.contact_id, 'contactOrganizationId', c.organization_id) AS details
    FROM conversations cv JOIN contacts c ON c.id = cv.contact_id
    WHERE cv.organization_id <> c.organization_id
    UNION ALL
    SELECT 'ticket_conversation', t.organization_id, t.id,
      jsonb_build_object('conversationId', t.conversation_id, 'conversationOrganizationId', cv.organization_id)
    FROM tickets t JOIN conversations cv ON cv.id = t.conversation_id
    WHERE t.organization_id <> cv.organization_id
    UNION ALL
    SELECT 'ticket_contact', t.organization_id, t.id,
      jsonb_build_object('contactId', t.contact_id, 'contactOrganizationId', c.organization_id)
    FROM tickets t JOIN contacts c ON c.id = t.contact_id
    WHERE t.organization_id <> c.organization_id
    UNION ALL
    SELECT 'campaign_number', ca.organization_id, ca.id,
      jsonb_build_object('numberId', ca.whatsapp_number_id, 'numberOrganizationId', n.organization_id)
    FROM campaigns ca JOIN whatsapp_numbers n ON n.id = ca.whatsapp_number_id
    WHERE ca.organization_id <> n.organization_id
    UNION ALL
    SELECT 'call_contact', ca.organization_id, ca.id,
      jsonb_build_object('contactId', ca.contact_id, 'contactOrganizationId', c.organization_id)
    FROM calls ca JOIN contacts c ON c.id = ca.contact_id
    WHERE ca.organization_id <> c.organization_id
    UNION ALL
    SELECT 'call_number', ca.organization_id, ca.id,
      jsonb_build_object('numberId', ca.whatsapp_number_id, 'numberOrganizationId', n.organization_id)
    FROM calls ca JOIN whatsapp_numbers n ON n.id = ca.whatsapp_number_id
    WHERE ca.organization_id <> n.organization_id
    UNION ALL
    SELECT 'lead_contact', l.organization_id, l.id,
      jsonb_build_object('contactId', l.contact_id, 'contactOrganizationId', c.organization_id)
    FROM leads l JOIN contacts c ON c.id = l.contact_id
    WHERE l.organization_id <> c.organization_id
    UNION ALL
    SELECT 'order_contact', o.organization_id, o.id,
      jsonb_build_object('contactId', o.contact_id, 'contactOrganizationId', c.organization_id)
    FROM orders o JOIN contacts c ON c.id = o.contact_id
    WHERE o.organization_id <> c.organization_id
    UNION ALL
    SELECT 'order_conversation', o.organization_id, o.id,
      jsonb_build_object('conversationId', o.conversation_id, 'conversationOrganizationId', cv.organization_id)
    FROM orders o JOIN conversations cv ON cv.id = o.conversation_id
    WHERE o.organization_id <> cv.organization_id
  `);

  const crossNumberRelationships = hasScopedContacts && hasScopedTickets
    ? await query(`
    SELECT 'conversation_contact', cv.organization_id, cv.id,
      jsonb_build_object('conversationNumberId', cv.whatsapp_number_id, 'contactNumberId', c.whatsapp_number_id) AS details
    FROM conversations cv JOIN contacts c ON c.id = cv.contact_id
    WHERE cv.whatsapp_number_id IS NOT NULL AND c.whatsapp_number_id IS NOT NULL
      AND cv.whatsapp_number_id <> c.whatsapp_number_id
    UNION ALL
    SELECT 'ticket_conversation', t.organization_id, t.id,
      jsonb_build_object('ticketNumberId', t.whatsapp_number_id, 'conversationNumberId', cv.whatsapp_number_id)
    FROM tickets t JOIN conversations cv ON cv.id = t.conversation_id
    WHERE t.whatsapp_number_id IS NOT NULL AND cv.whatsapp_number_id IS NOT NULL
      AND t.whatsapp_number_id <> cv.whatsapp_number_id
    UNION ALL
    SELECT 'call_contact', ca.organization_id, ca.id,
      jsonb_build_object('callNumberId', ca.whatsapp_number_id, 'contactNumberId', c.whatsapp_number_id)
    FROM calls ca JOIN contacts c ON c.id = ca.contact_id
    WHERE ca.whatsapp_number_id IS NOT NULL AND c.whatsapp_number_id IS NOT NULL
      AND ca.whatsapp_number_id <> c.whatsapp_number_id
      `)
    : [];

  const orphanContacts = await query(`
    SELECT c.organization_id, c.id AS entity_id,
      jsonb_build_object('phone', c.phone) AS details
    FROM contacts c
    WHERE NOT EXISTS (SELECT 1 FROM conversations cv WHERE cv.contact_id = c.id)
  `);
  const orphanConversations = await query(`
    SELECT organization_id, id AS entity_id,
      jsonb_build_object('contactId', contact_id) AS details
    FROM conversations WHERE whatsapp_number_id IS NULL
  `);
  const unresolvedCampaigns = await query(`
    SELECT organization_id, id AS entity_id,
      jsonb_build_object('reason', 'campaign requires explicit number ownership') AS details
    FROM campaigns WHERE whatsapp_number_id IS NULL
      AND (
        SELECT COUNT(*) FROM whatsapp_numbers n
        WHERE n.organization_id = campaigns.organization_id
      ) <> 1
  `);

  const report = {
    generatedAt: new Date().toISOString(),
    blockers: {
      invalidNumberIdentities,
      duplicateNumberIdentities,
      invalidContactIdentities,
      duplicateScopedContacts,
      crossOrganizationRelationships,
      crossNumberRelationships,
    },
    review: { multiNumberContacts, orphanContacts, orphanConversations, unresolvedCampaigns },
  };
  await writeReport(report);
  await persistDurableReports(report);
  console.log(JSON.stringify(report, null, 2));

  const hasUnprovenDuplicate = duplicateNumberIdentities.some((row) => {
    const details = row.details as { identityProven?: boolean };
    return details.identityProven !== true;
  });
  const blocked =
    invalidNumberIdentities.length > 0 ||
    invalidContactIdentities.length > 0 ||
    duplicateScopedContacts.length > 0 ||
    hasUnprovenDuplicate ||
    crossOrganizationRelationships.length > 0 ||
    crossNumberRelationships.length > 0 ||
    unresolvedCampaigns.length > 0;

  if (process.argv.includes('--repair-proven') && !blocked) {
    const repaired = await repairProvenNumberDuplicates();
    if (repaired) console.error(`Repaired ${repaired} proven duplicate number group(s); inactive rows were preserved.`);
  }
  if (blocked) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('WhatsApp number isolation preflight failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
