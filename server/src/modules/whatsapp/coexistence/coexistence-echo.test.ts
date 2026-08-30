import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
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
vi.mock('../../../realtime', () => ({ emitToOrg: vi.fn() }));

import { processMessageEchoes } from './echoes';

describe('coexistence-echo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ingests smb_message_echoes as OUTBOUND with biz_app source', async () => {
    const contact = { id: 'c1', organizationId: 'org1' };
    const conversation = { id: 'conv1', organizationId: 'org1' };
    prismaMock.contact.findFirst.mockResolvedValue(null);
    prismaMock.contact.create.mockResolvedValue(contact);
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    prismaMock.conversation.create.mockResolvedValue(conversation);
    prismaMock.message.create.mockResolvedValue({
      id: 'm1',
      direction: 'OUTBOUND',
      metaMessageId: 'wamid.echo1',
    });
    prismaMock.conversation.update.mockResolvedValue(conversation);

    const count = await processMessageEchoes(
      { id: 'wn1', organizationId: 'org1', phoneNumber: '+919999999999' },
      {
        message_echoes: [
          {
            from: '919999999999',
            to: '918888888888',
            id: 'wamid.echo1',
            timestamp: '1700000000',
            type: 'text',
            text: { body: 'Hello from app' },
          },
        ],
      }
    );

    expect(count).toBe(1);
    expect(prismaMock.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'OUTBOUND',
        }),
      })
    );
    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'OUTBOUND',
          metaMessageId: 'wamid.echo1',
          metadata: expect.objectContaining({ source: 'biz_app' }),
        }),
      })
    );
  });

  it('keeps an existing contact source when ingesting a biz_app echo', async () => {
    prismaMock.contact.findFirst.mockResolvedValue({
      id: 'c-existing',
      source: 'IMPORT',
    });
    prismaMock.conversation.findFirst.mockResolvedValue({ id: 'conv1' });
    prismaMock.message.create.mockResolvedValue({ id: 'm2' });
    prismaMock.conversation.update.mockResolvedValue({ id: 'conv1' });

    await processMessageEchoes(
      { id: 'wn1', organizationId: 'org1', phoneNumber: '+919999999999' },
      {
        message_echoes: [
          {
            from: '919999999999',
            to: '918888888888',
            id: 'wamid.echo-existing',
            timestamp: '1700000000',
            type: 'text',
            text: { body: 'hi' },
          },
        ],
      }
    );

    expect(prismaMock.contact.create).not.toHaveBeenCalled();
    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ source: 'biz_app' }),
        }),
      })
    );
  });
});
