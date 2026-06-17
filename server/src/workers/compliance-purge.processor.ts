import prisma from '../config/database';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('compliance-purge');

export async function processCompliancePurge(organizationId: string): Promise<void> {
  log.info('Starting GDPR compliance purge', { organizationId });

  const contacts = await prisma.contact.findMany({
    where: { organizationId },
    select: { id: true },
  });

  for (const contact of contacts) {
    await prisma.message.updateMany({
      where: { conversation: { contactId: contact.id, organizationId } },
      data: { content: '[deleted]', metadata: {} },
    });

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        name: null,
        email: null,
        phone: `deleted-${contact.id.slice(0, 8)}`,
        notes: null,
        tags: [],
        optedIn: false,
      },
    });
  }

  await prisma.conversation.updateMany({
    where: { organizationId },
    data: { status: 'CLOSED' },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      action: 'gdpr_purge_completed',
      resource: 'organization',
      details: {
        purgedAt: new Date().toISOString(),
        contactsAffected: contacts.length,
      },
    },
  });

  log.info('GDPR compliance purge completed', {
    organizationId,
    contactsAffected: contacts.length,
  });
}
