import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const prismaMock = vi.hoisted(() => ({
  message: { create: vi.fn() },
  contact: { findFirst: vi.fn(), create: vi.fn() },
  conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

vi.mock('../../../config/database', () => ({ default: prismaMock }));
vi.mock('../../../realtime', () => ({ emitToOrg: vi.fn() }));

import { processMessageEchoes } from './echoes';

describe('coexistence-dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dedupes same metaMessageId on retry', async () => {
    prismaMock.contact.findFirst.mockResolvedValue({ id: 'c1' });
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'conv1' });
    prismaMock.message.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' })
    );

    const payload = {
      message_echoes: [
        {
          from: '919999999999',
          to: '918888888888',
          id: 'wamid.same',
          timestamp: '1700000000',
          type: 'text',
          text: { body: 'dup' },
        },
      ],
    };

    const count = await processMessageEchoes(
      { id: 'wn1', organizationId: 'org1', phoneNumber: '+919999999999' },
      payload
    );

    expect(count).toBe(0);
    expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
  });
});
