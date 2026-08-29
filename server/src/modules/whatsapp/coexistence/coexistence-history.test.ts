import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

const prismaMock = vi.hoisted(() => ({
  whatsappNumber: { update: vi.fn() },
  contact: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  conversation: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  message: {
    create: vi.fn(),
  },
}));

vi.mock('../../../config/database', () => ({ default: prismaMock }));

import { processHistorySync } from './history';

describe('coexistence-history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const whatsappNumber = {
    id: 'wn1',
    organizationId: 'org1',
    phoneNumber: '+919999999999',
  };

  it('progress_tracked: updates historySyncProgress from chunk metadata', async () => {
    prismaMock.whatsappNumber.update.mockResolvedValue({});

    await processHistorySync(whatsappNumber, {
      history: [
        {
          metadata: { phase: 0, chunk_order: 1, progress: 55 },
          threads: [],
        },
      ],
    });

    expect(prismaMock.whatsappNumber.update).toHaveBeenCalledWith({
      where: { id: 'wn1' },
      data: { historySyncProgress: 55 },
    });
  });

  it('ingests history threads as INBOUND with history_sync source', async () => {
    prismaMock.whatsappNumber.update.mockResolvedValue({});
    prismaMock.contact.findFirst.mockResolvedValue(null);
    prismaMock.contact.create.mockResolvedValue({ id: 'c1' });
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    prismaMock.conversation.create.mockResolvedValue({ id: 'conv1' });
    prismaMock.message.create.mockResolvedValue({ id: 'm1' });
    prismaMock.conversation.update.mockResolvedValue({ id: 'conv1' });

    const saved = await processHistorySync(whatsappNumber, {
      history: [
        {
          metadata: { phase: 0, chunk_order: 1, progress: 10 },
          threads: [
            {
              id: '918888888888',
              messages: [
                {
                  from: '918888888888',
                  to: '919999999999',
                  id: 'wamid.hist1',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: 'Old chat' },
                  history_context: { status: 'delivered' },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(saved).toBe(1);
    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'INBOUND',
          metaMessageId: 'wamid.hist1',
          metadata: expect.objectContaining({ source: 'history_sync' }),
        }),
      })
    );
  });

  it('history_declined: sets coexistenceStatus when business declines share', async () => {
    prismaMock.whatsappNumber.update.mockResolvedValue({});

    await processHistorySync(whatsappNumber, {
      history: [
        {
          errors: [{ code: 2593109, title: 'History sync declined' }],
        },
      ],
    });

    expect(prismaMock.whatsappNumber.update).toHaveBeenCalledWith({
      where: { id: 'wn1' },
      data: { coexistenceStatus: 'history_declined' },
    });
  });

  it('dedupes duplicate metaMessageId on history retry', async () => {
    prismaMock.whatsappNumber.update.mockResolvedValue({});
    prismaMock.contact.findFirst.mockResolvedValue({ id: 'c1' });
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'conv1' });
    prismaMock.message.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' })
    );

    const saved = await processHistorySync(whatsappNumber, {
      history: [
        {
          metadata: { progress: 20 },
          threads: [
            {
              id: '918888888888',
              messages: [
                {
                  from: '918888888888',
                  to: '919999999999',
                  id: 'wamid.same',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: 'dup' },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(saved).toBe(0);
    expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
  });
});
