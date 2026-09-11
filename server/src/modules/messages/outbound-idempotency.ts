import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';

export function readIdempotencyKey(req: Request): string | undefined {
  const header = req.header('Idempotency-Key');
  const raw = typeof header === 'string' ? header.trim() : '';
  if (!raw) return undefined;
  if (raw.length < 8 || raw.length > 128) {
    throw new AppError(400, 'Invalid Idempotency-Key');
  }
  return raw;
}

export function isIdempotencyConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function findMessageByIdempotencyKey(conversationId: string, key: string) {
  return prisma.message.findFirst({
    where: { conversationId, idempotencyKey: key },
  });
}

export async function findCampaignBySendIdempotencyKey(organizationId: string, key: string) {
  return prisma.campaign.findFirst({
    where: { organizationId, sendIdempotencyKey: key },
  });
}
