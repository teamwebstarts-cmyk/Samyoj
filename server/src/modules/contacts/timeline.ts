import prisma from '../../config/database';

export async function getContactTimeline(
  organizationId: string,
  contactId: string,
  whatsappNumberId?: string
) {
  if (!whatsappNumberId) return null;
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, organizationId, whatsappNumberId },
  });
  if (!contact) return null;

  const [messages, calls, campaignRecipients, notes, conversations] = await Promise.all([
    prisma.message.findMany({
      where: { conversation: { organizationId, contactId, whatsappNumberId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        direction: true,
        type: true,
        content: true,
        status: true,
        createdAt: true,
        conversationId: true,
      },
    }),
    prisma.call.findMany({
      where: { organizationId, contactId, whatsappNumberId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        direction: true,
        status: true,
        durationSeconds: true,
        createdAt: true,
      },
    }),
    prisma.campaignRecipient.findMany({
      where: {
        phone: contact.phone,
        campaign: { organizationId, whatsappNumberId },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        campaign: { select: { id: true, name: true, templateName: true } },
      },
    }),
    prisma.internalNote.findMany({
      where: {
        conversation: { organizationId, contactId, whatsappNumberId },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, name: true } },
        conversation: { select: { id: true } },
      },
    }),
    prisma.conversation.findMany({
      where: { organizationId, contactId, whatsappNumberId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  type TimelineEntry = {
    id: string;
    type: string;
    title: string;
    detail?: string;
    at: string;
    meta?: Record<string, unknown>;
  };

  const entries: TimelineEntry[] = [];

  for (const m of messages) {
    entries.push({
      id: `msg-${m.id}`,
      type: 'message',
      title: m.direction === 'INBOUND' ? 'Inbound message' : 'Outbound message',
      detail: m.content?.slice(0, 120) || m.type,
      at: m.createdAt.toISOString(),
      meta: { messageId: m.id, conversationId: m.conversationId, status: m.status },
    });
  }

  for (const c of calls) {
    entries.push({
      id: `call-${c.id}`,
      type: 'call',
      title: `${c.direction === 'USER_INITIATED' ? 'Inbound' : 'Outbound'} call`,
      detail: `${c.status}${c.durationSeconds ? ` · ${c.durationSeconds}s` : ''}`,
      at: c.createdAt.toISOString(),
      meta: { callId: c.id },
    });
  }

  for (const r of campaignRecipients) {
    entries.push({
      id: `campaign-${r.id}`,
      type: 'campaign',
      title: `Campaign: ${r.campaign.name}`,
      detail: `${r.campaign.templateName} · ${r.status}`,
      at: (r.sentAt || r.createdAt).toISOString(),
      meta: { campaignId: r.campaign.id, status: r.status },
    });
  }

  for (const n of notes) {
    entries.push({
      id: `note-${n.id}`,
      type: 'note',
      title: `Note by ${n.user.name}`,
      detail: n.content.slice(0, 120),
      at: n.createdAt.toISOString(),
      meta: { conversationId: n.conversation.id },
    });
  }

  for (const conv of conversations) {
    entries.push({
      id: `conv-${conv.id}`,
      type: 'conversation',
      title: `Conversation ${conv.status.toLowerCase()}`,
      at: conv.createdAt.toISOString(),
      meta: { conversationId: conv.id, status: conv.status },
    });
  }

  entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { contact, timeline: entries.slice(0, 150) };
}
