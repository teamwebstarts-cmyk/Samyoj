import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import { assertAiCreditsAvailable } from './ai-credits/service';
import {
  isSubscriptionEnforcementEnabled,
  resetSubscriptionEnforcementCache,
  setSubscriptionEnforcementEnabled,
} from './subscription-enforcement';

vi.mock('../../config/database', () => ({
  default: {
    platformSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe('subscription enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSubscriptionEnforcementCache();
  });

  it('stays off until an admin turns it on, and skips AI credit blocks while off', async () => {
    vi.mocked(prisma.platformSetting.findUnique).mockResolvedValue(null);
    expect(await isSubscriptionEnforcementEnabled()).toBe(false);

    vi.mocked(prisma.platformSetting.findUnique).mockResolvedValue({
      value: { enabled: true },
    } as never);
    expect(await isSubscriptionEnforcementEnabled()).toBe(false);

    resetSubscriptionEnforcementCache();
    expect(await isSubscriptionEnforcementEnabled()).toBe(true);

    vi.mocked(prisma.platformSetting.upsert).mockResolvedValue({} as never);
    await setSubscriptionEnforcementEnabled(false);
    expect(await isSubscriptionEnforcementEnabled()).toBe(false);
    await expect(assertAiCreditsAvailable('org-open', 'chat', 5)).resolves.toBeUndefined();

    console.log('subscription enforcement gates passed');
  });
});
