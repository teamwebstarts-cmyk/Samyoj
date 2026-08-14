import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    automationLog: {
      findFirst: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import {
  FREQUENCY_CAP_WINDOW_MS,
  frequencyCapSince,
  hasRecentFlowStart,
  hasRecentStaticReply,
} from './frequency';

const logMock = vi.mocked(prisma.automationLog.findFirst);

describe('frequency cap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a 24h window', () => {
    const now = Date.parse('2026-08-14T12:00:00.000Z');
    expect(frequencyCapSince(now).toISOString()).toBe('2026-08-13T12:00:00.000Z');
    expect(FREQUENCY_CAP_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('treats a successful start in-window as capped', async () => {
    logMock.mockResolvedValue({ id: 'log-1' } as never);
    await expect(
      hasRecentFlowStart({
        organizationId: 'org-1',
        conversationId: 'conv-1',
        flowId: 'flow-1',
      })
    ).resolves.toBe(true);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          conversationId: 'conv-1',
          flowId: 'flow-1',
          action: 'start',
          status: 'success',
        }),
      })
    );
  });

  it('allows a new start when no in-window log exists', async () => {
    logMock.mockResolvedValue(null);
    await expect(
      hasRecentFlowStart({
        organizationId: 'org-1',
        conversationId: 'conv-1',
        flowId: 'flow-1',
      })
    ).resolves.toBe(false);
  });

  it('caps static auto-replies on successful send_reply', async () => {
    logMock.mockResolvedValue({ id: 'log-2' } as never);
    await expect(
      hasRecentStaticReply({
        organizationId: 'org-1',
        conversationId: 'conv-1',
        automationId: 'auto-1',
      })
    ).resolves.toBe(true);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          automationId: 'auto-1',
          action: 'send_reply',
          status: 'success',
        }),
      })
    );
  });
});
