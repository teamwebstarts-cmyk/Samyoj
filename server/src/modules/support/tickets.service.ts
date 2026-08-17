/**
 * Help Center ticket persistence. The Support board no longer exposes tickets
 * (assistant-only). Table + service remain so we do not drop the migration.
 */
import { z } from 'zod';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { clipTranscript, SUPPORT_TRANSCRIPT_MAX } from './chat.service';

export const SUPPORT_SUBJECT_MAX = 160;
export const SUPPORT_BODY_MAX = 4000;

export const supportTicketCreateSchema = z.object({
  subject: z.string().trim().min(3, 'Add a short subject').max(SUPPORT_SUBJECT_MAX),
  body: z.string().trim().min(8, 'Tell us a bit more').max(SUPPORT_BODY_MAX),
  source: z.enum(['manual', 'chat']).optional(),
  transcript: z.string().max(SUPPORT_TRANSCRIPT_MAX).optional(),
});

export type SupportTicketCreateInput = z.infer<typeof supportTicketCreateSchema>;

const ticketSelect = {
  id: true,
  subject: true,
  body: true,
  status: true,
  source: true,
  transcript: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Cheap readiness check — false if the table is missing or Postgres is down. */
export async function areSupportTicketsAvailable(): Promise<boolean> {
  try {
    await prisma.supportTicket.findFirst({ select: { id: true } });
    return true;
  } catch {
    return false;
  }
}

export async function listSupportTickets(organizationId: string, createdById: string) {
  return prisma.supportTicket.findMany({
    where: { organizationId, createdById },
    select: ticketSelect,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function createSupportTicket(input: {
  organizationId: string;
  createdById: string;
  data: unknown;
}) {
  const data = supportTicketCreateSchema.parse(input.data);
  const source = data.source || 'manual';
  if (source === 'chat' && !data.transcript?.trim()) {
    throw new AppError(400, 'Escalate from a chat that has at least one message.');
  }

  return prisma.supportTicket.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      subject: data.subject,
      body: data.body,
      source,
      transcript: data.transcript ? clipTranscript(data.transcript) : null,
    },
    select: ticketSelect,
  });
}
