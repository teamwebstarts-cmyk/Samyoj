import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  whatsappNumber: { update: vi.fn() },
}));

vi.mock('../../../config/database', () => ({ default: prismaMock }));
vi.mock('../../../realtime', () => ({ emitToOrg: vi.fn() }));

import { processAccountUpdate } from './lifecycle';

describe('coexistence-lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offboarded_flag: ACCOUNT_OFFBOARDED sets coexistence flags', async () => {
    prismaMock.whatsappNumber.update.mockResolvedValue({});

    await processAccountUpdate(
      { id: 'wn1', organizationId: 'org1', phoneNumber: '+919999999999' },
      { event: 'ACCOUNT_OFFBOARDED' },
      'waba1'
    );

    expect(prismaMock.whatsappNumber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wn1' },
        data: expect.objectContaining({
          isOnBizApp: false,
          coexistenceStatus: 'offboarded',
        }),
      })
    );
  });
});
