import { describe, expect, it, vi, beforeEach } from 'vitest';
import prisma from '../../config/database';
import { findBotNameConflict } from './bot.service';

vi.mock('../../config/database', () => ({
  default: {
    aiBot: {
      findFirst: vi.fn(),
    },
  },
}));

describe('findBotNameConflict', () => {
  beforeEach(() => {
    vi.mocked(prisma.aiBot.findFirst).mockReset();
  });

  it('queries case-insensitive name within org and channel', async () => {
    vi.mocked(prisma.aiBot.findFirst).mockResolvedValue({ id: 'b1', name: 'Support' });

    const clash = await findBotNameConflict('org-1', 'support', 'CHAT');
    expect(clash?.id).toBe('b1');
    expect(prisma.aiBot.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        channel: 'CHAT',
        name: { equals: 'support', mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });
  });

  it('excludes the bot being edited', async () => {
    vi.mocked(prisma.aiBot.findFirst).mockResolvedValue(null);

    await findBotNameConflict('org-1', 'Support', 'CHAT', 'bot-self');
    expect(prisma.aiBot.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        channel: 'CHAT',
        id: { not: 'bot-self' },
        name: { equals: 'Support', mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });
  });
});
