import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import type { Contact, ContactSource, Prisma } from '@prisma/client';
import { sortContactIdsForLock } from './locking';
import { asCustomAttributes } from '../../utils/custom-attributes';

export interface ContactListItem extends Contact {
  lastActiveAt: Date | null;
  conversation: {
    id: string;
    status: string;
    lastMessageAt: Date | null;
    unreadCount: number;
    assignedAgent: { id: string; name: string } | null;
  } | null;
}

export interface ContactActivityItem {
  id: string;
  type: 'message' | 'call' | 'campaign';
  at: string;
  title: string;
  subtitle?: string;
  meta?: Record<string, unknown>;
}

export interface ContactDetail {
  contact: Contact;
  lead?: { id: string; stage: string; title: string } | null;
  conversations: Array<{
    id: string;
    status: string;
    lastMessageAt: Date | null;
    unreadCount: number;
    botActive: boolean;
    assignedAgent: { id: string; name: string } | null;
    createdAt: Date;
  }>;
  activity: ContactActivityItem[];
  stats: {
    totalMessages: number;
    totalCalls: number;
    campaignsReceived: number;
  };
}

function buildContactWhere(
  orgId: string,
  filters: {
    search?: string;
    tag?: string;
    named?: string;
    optedIn?: string;
    source?: string;
    activeSince?: Date;
  },
  whatsappNumberId?: string
): Prisma.ContactWhereInput {
  const andConditions: Prisma.ContactWhereInput[] = [];
  if (!whatsappNumberId) {
    andConditions.push({ id: { in: [] } });
  }

  if (filters.search) {
    andConditions.push({
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.tag === '__none__') {
    andConditions.push({ tags: { equals: [] } });
  } else if (filters.tag) {
    andConditions.push({ tags: { has: filters.tag } });
  }
  if (filters.named === 'true') {
    andConditions.push({ name: { not: null } }, { NOT: { name: '' } });
  } else if (filters.named === 'false') {
    andConditions.push({ OR: [{ name: null }, { name: '' }] });
  }
  if (filters.optedIn === 'true') {
    andConditions.push({ optedIn: true });
  } else if (filters.optedIn === 'false') {
    andConditions.push({ optedIn: false });
  }
  if (filters.source) {
    andConditions.push({ source: filters.source as ContactSource });
  }
  if (filters.activeSince) {
    andConditions.push({
      conversations: {
        some: {
          lastMessageAt: { gte: filters.activeSince },
          ...(whatsappNumberId ? { whatsappNumberId } : {}),
        },
      },
    });
  } else if (whatsappNumberId) {
    andConditions.push({ whatsappNumberId });
  }

  const where: Prisma.ContactWhereInput = { organizationId: orgId };
  if (andConditions.length > 0) where.AND = andConditions;
  return where;
}

async function enrichContacts(contacts: Contact[], whatsappNumberId?: string): Promise<ContactListItem[]> {
  if (!contacts.length) return [];

  const ids = contacts.map((c) => c.id);
  const conversations = await prisma.conversation.findMany({
    where: {
      contactId: { in: ids },
      ...(whatsappNumberId ? { whatsappNumberId } : {}),
    },
    orderBy: { lastMessageAt: 'desc' },
    select: {
      id: true,
      contactId: true,
      status: true,
      lastMessageAt: true,
      unreadCount: true,
      assignedAgent: { select: { id: true, name: true } },
    },
  });

  const convByContact = new Map<string, (typeof conversations)[number]>();
  for (const conv of conversations) {
    if (!convByContact.has(conv.contactId)) {
      convByContact.set(conv.contactId, conv);
    }
  }

  return contacts.map((contact) => {
    const conversation = convByContact.get(contact.id) ?? null;
    return {
      ...contact,
      lastActiveAt: conversation?.lastMessageAt ?? null,
      conversation: conversation
        ? {
            id: conversation.id,
            status: conversation.status,
            lastMessageAt: conversation.lastMessageAt,
            unreadCount: conversation.unreadCount,
            assignedAgent: conversation.assignedAgent,
          }
        : null,
    };
  });
}

export async function listContacts(
  orgId: string,
  query: {
    search?: string;
    tag?: string;
    named?: string;
    optedIn?: string;
    source?: string;
    active?: string;
    page?: string;
    limit?: string;
  },
  whatsappNumberId?: string
) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const where = buildContactWhere(
    orgId,
    {
      search: query.search,
      tag: query.tag,
      named: query.named,
      optedIn: query.optedIn,
      source: query.source,
      activeSince: query.active === '7d' ? sevenDaysAgo : undefined,
    },
    whatsappNumberId
  );

  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '50');
  const skip = (page - 1) * limit;

  const baseWhere: Prisma.ContactWhereInput = {
    organizationId: orgId,
    ...(whatsappNumberId ? { whatsappNumberId } : {}),
  };

  const [contacts, total, totalAll, named, optedIn, active7d, tagged] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.contact.count({ where }),
    prisma.contact.count({ where: baseWhere }),
    prisma.contact.count({
      where: { ...baseWhere, AND: [{ name: { not: null } }, { NOT: { name: '' } }] },
    }),
    prisma.contact.count({ where: { ...baseWhere, optedIn: true } }),
    prisma.contact.count({
      where: {
        ...baseWhere,
        conversations: { some: { whatsappNumberId, lastMessageAt: { gte: sevenDaysAgo } } },
      },
    }),
    prisma.contact.count({
      where: { ...baseWhere, NOT: { tags: { equals: [] } } },
    }),
  ]);

  const enriched = await enrichContacts(contacts, whatsappNumberId);

  return {
    contacts: enriched,
    total,
    page,
    limit,
    summary: { total: totalAll, named, optedIn, active7d, tagged },
  };
}

export async function getContactDetail(
  orgId: string,
  contactId: string,
  whatsappNumberId?: string
): Promise<ContactDetail> {
  if (!whatsappNumberId) throw new AppError(404, 'Contact not found');
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId: orgId, whatsappNumberId },
  });
  if (!contact) throw new AppError(404, 'Contact not found');

  const conversations = await prisma.conversation.findMany({
    where: { contactId, organizationId: orgId, whatsappNumberId },
    orderBy: { lastMessageAt: 'desc' },
    select: {
      id: true,
      status: true,
      lastMessageAt: true,
      unreadCount: true,
      botActive: true,
      assignedAgent: { select: { id: true, name: true } },
      createdAt: true,
    },
  });

  const conversationIds = conversations.map((c) => c.id);

  const [messages, calls, campaignRecipients, totalMessages, totalCalls, campaignsReceived, lead] =
    await Promise.all([
      conversationIds.length
        ? prisma.message.findMany({
            where: { conversationId: { in: conversationIds } },
            orderBy: { createdAt: 'desc' },
            take: 25,
            select: {
              id: true,
              direction: true,
              type: true,
              content: true,
              status: true,
              createdAt: true,
              conversationId: true,
            },
          })
        : Promise.resolve([]),
      prisma.call.findMany({
        where: { contactId, organizationId: orgId, whatsappNumberId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          direction: true,
          status: true,
          durationSeconds: true,
          createdAt: true,
          conversationId: true,
        },
      }),
      prisma.campaignRecipient.findMany({
        where: { phone: contact.phone, campaign: { organizationId: orgId, whatsappNumberId } },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          status: true,
          sentAt: true,
          createdAt: true,
          campaign: { select: { id: true, name: true, status: true } },
        },
      }),
      conversationIds.length
        ? prisma.message.count({ where: { conversationId: { in: conversationIds } } })
        : Promise.resolve(0),
      prisma.call.count({ where: { contactId, organizationId: orgId, whatsappNumberId } }),
      prisma.campaignRecipient.count({
        where: { phone: contact.phone, campaign: { organizationId: orgId, whatsappNumberId } },
      }),
      prisma.lead.findFirst({
        where: { organizationId: orgId, contactId: contact.id, whatsappNumberId },
        select: { id: true, stage: true, title: true },
      }),
    ]);

  const activity: ContactActivityItem[] = [
    ...messages.map((m) => ({
      id: m.id,
      type: 'message' as const,
      at: m.createdAt.toISOString(),
      title: m.direction === 'INBOUND' ? 'Received message' : 'Sent message',
      subtitle: m.content.slice(0, 120) || m.type,
      meta: {
        direction: m.direction,
        type: m.type,
        status: m.status,
        conversationId: m.conversationId,
      },
    })),
    ...calls.map((c) => ({
      id: c.id,
      type: 'call' as const,
      at: (c.createdAt).toISOString(),
      title: c.direction === 'USER_INITIATED' ? 'Inbound call' : 'Outbound call',
      subtitle: c.status,
      meta: { durationSeconds: c.durationSeconds, callId: c.id, conversationId: c.conversationId },
    })),
    ...campaignRecipients.map((r) => ({
      id: r.id,
      type: 'campaign' as const,
      at: (r.sentAt || r.createdAt).toISOString(),
      title: `Campaign: ${r.campaign.name}`,
      subtitle: r.status,
      meta: { campaignId: r.campaign.id, campaignStatus: r.campaign.status },
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  return {
    contact,
    lead,
    conversations,
    activity,
    stats: { totalMessages, totalCalls, campaignsReceived },
  };
}

export async function bulkUpdateContacts(
  orgId: string,
  input: {
    ids: string[];
    action: 'delete' | 'addTags' | 'removeTags' | 'setOptedIn';
    tags?: string[];
    optedIn?: boolean;
  },
  whatsappNumberId?: string
) {
  if (!whatsappNumberId) throw new AppError(400, 'Connect a WhatsApp number before updating contacts');
  const contacts = await prisma.contact.findMany({
    where: { organizationId: orgId, whatsappNumberId, id: { in: input.ids } },
    select: {
      id: true,
      tags: true,
      _count: { select: { conversations: true, calls: true, orders: true, leads: true, tickets: true } },
    },
  });

  if (!contacts.length) throw new AppError(400, 'No matching contacts found');

  const ids = contacts.map((c) => c.id);

  if (input.action === 'delete') {
    return prisma.$transaction(async (tx) => {
      const matching = await tx.contact.findMany({
        where: { organizationId: orgId, whatsappNumberId, id: { in: ids } },
        select: { id: true },
      });
      if (!matching.length) throw new AppError(400, 'No matching contacts found');

      // Lock every parent before checking history. Foreign-key inserts acquire
      // a conflicting key-share lock, so concurrent history writes cannot race
      // this check and be removed by the delete.
      const lockOrder = sortContactIdsForLock(matching.map((contact) => contact.id));
      for (const contactId of lockOrder) {
        await tx.$queryRaw`SELECT id FROM contacts WHERE id = ${contactId} FOR UPDATE`;
      }

      const locked = await tx.contact.findMany({
        where: { organizationId: orgId, whatsappNumberId, id: { in: matching.map((contact) => contact.id) } },
        select: {
          id: true,
          _count: { select: { conversations: true, calls: true, orders: true, leads: true, tickets: true } },
        },
      });
      const historical = locked.filter((contact) =>
        Object.values(contact._count).some((count) => count > 0)
      );
      if (historical.length) {
        throw new AppError(
          409,
          `Cannot delete contacts with history. Archive or retain them instead (${historical
            .map((contact) => contact.id)
            .join(', ')})`
        );
      }

      const deleted = await tx.contact.deleteMany({
        where: { id: { in: locked.map((contact) => contact.id) }, organizationId: orgId, whatsappNumberId },
      });
      return { affected: deleted.count };
    });
  }

  if (input.action === 'setOptedIn') {
    await prisma.contact.updateMany({
      where: { id: { in: ids }, organizationId: orgId, whatsappNumberId },
      data: { optedIn: Boolean(input.optedIn) },
    });
    return { affected: ids.length };
  }

  const tagList = (input.tags || []).map((t) => t.trim()).filter(Boolean);
  if (!tagList.length) throw new AppError(400, 'At least one tag is required');

  for (const contact of contacts) {
    let nextTags = [...contact.tags];
    if (input.action === 'addTags') {
      const set = new Set([...nextTags, ...tagList]);
      nextTags = [...set];
    } else {
      const remove = new Set(tagList);
      nextTags = nextTags.filter((t) => !remove.has(t));
    }
    await prisma.contact.update({
      where: { id: contact.id },
      data: { tags: nextTags },
    });
  }

  return { affected: ids.length };
}

export async function renameTag(orgId: string, from: string, to: string, whatsappNumberId?: string) {
  if (!whatsappNumberId) return { affected: 0 };
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  if (!trimmedFrom || !trimmedTo) throw new AppError(400, 'Both tag names are required');
  if (trimmedFrom === trimmedTo) throw new AppError(400, 'Tag names must be different');

  const contacts = await prisma.contact.findMany({
    where: { organizationId: orgId, whatsappNumberId, tags: { has: trimmedFrom } },
    select: { id: true, tags: true },
  });

  for (const contact of contacts) {
    const nextTags = contact.tags.map((t) => (t === trimmedFrom ? trimmedTo : t));
    const unique = [...new Set(nextTags)];
    await prisma.contact.update({ where: { id: contact.id }, data: { tags: unique } });
  }

  return { affected: contacts.length };
}

export async function deleteTag(orgId: string, tag: string, whatsappNumberId?: string) {
  if (!whatsappNumberId) return { affected: 0 };
  const trimmed = tag.trim();
  if (!trimmed) throw new AppError(400, 'Tag name is required');

  const contacts = await prisma.contact.findMany({
    where: { organizationId: orgId, whatsappNumberId, tags: { has: trimmed } },
    select: { id: true, tags: true },
  });

  for (const contact of contacts) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { tags: contact.tags.filter((t) => t !== trimmed) },
    });
  }

  return { affected: contacts.length };
}

export async function exportContacts(
  orgId: string,
  filters: {
    search?: string;
    tag?: string;
    named?: string;
    optedIn?: string;
    source?: string;
    format?: string;
  },
  whatsappNumberId?: string
) {
  const where = buildContactWhere(orgId, {
    search: filters.search,
    tag: filters.tag,
    named: filters.named,
    optedIn: filters.optedIn,
    source: filters.source,
  }, whatsappNumberId);

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      phone: true,
      name: true,
      email: true,
      tags: true,
      notes: true,
      optedIn: true,
      source: true,
      createdAt: true,
      customAttributes: true,
    },
  });

  if (filters.format === 'csv') {
    const extraKeys = [
      ...new Set(contacts.flatMap((c) => Object.keys(asCustomAttributes(c.customAttributes)))),
    ].sort();
    const headers = ['phone', 'name', 'email', 'tags', 'notes', 'opted_in', 'source', 'created_at', ...extraKeys];
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = contacts.map((c) => {
      const attrs = asCustomAttributes(c.customAttributes);
      return [
        c.phone,
        c.name || '',
        c.email || '',
        c.tags.join(','),
        c.notes || '',
        c.optedIn ? 'true' : 'false',
        c.source,
        c.createdAt.toISOString(),
        ...extraKeys.map((key) => attrs[key] || ''),
      ]
        .map(escape)
        .join(',');
    });
    return { contentType: 'text/csv', body: [headers.join(','), ...rows].join('\n') + '\n' };
  }

  return {
    contentType: 'application/json',
    body: JSON.stringify(contacts, null, 2),
  };
}
