import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, updateMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  default: {
    contact: {
      findMany,
      updateMany,
    },
  },
}));

import { subscribeUnsubscribedContacts } from './service';

describe('subscribeUnsubscribedContacts', () => {
  beforeEach(() => {
    findMany.mockReset();
    updateMany.mockReset();
  });

  it('requires an active WhatsApp number', async () => {
    await expect(subscribeUnsubscribedContacts('org-1', undefined)).rejects.toThrow(
      /Connect a WhatsApp number/
    );
  });

  it('returns zero when everyone is already subscribed', async () => {
    findMany.mockResolvedValue([]);
    await expect(subscribeUnsubscribedContacts('org-1', 'wa-1')).resolves.toEqual({ updated: 0 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('subscribes pending contacts with auditable consent fields', async () => {
    findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    updateMany.mockResolvedValue({ count: 2 });

    await expect(subscribeUnsubscribedContacts('org-1', 'wa-1')).resolves.toEqual({ updated: 2 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          whatsappNumberId: 'wa-1',
          optOutAt: null,
        }),
      })
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c2'] } },
      data: expect.objectContaining({
        optedIn: true,
        consentSource: 'MANUAL_BULK',
        optOutAt: null,
      }),
    });
  });
});
