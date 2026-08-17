import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    metaErrorStat: {
      upsert: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import {
  emitMetaErrorStat,
  extractWebhookStatusMetaError,
  metaErrorCategory,
  officialMetaErrorTitle,
  recordMetaErrorStat,
  recordWebhookStatusMetaError,
  redactMetaErrorTitle,
} from './meta-errors';

const upsert = vi.mocked(prisma.metaErrorStat.upsert);

describe('Meta error aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({} as never);
  });

  it('uses official titles and redacts identifiers from sample text', () => {
    expect(officialMetaErrorTitle(131048)).toBe('Spam rate / quality limit');
    expect(metaErrorCategory(131047)).toBe('SERVICE_WINDOW');
    expect(metaErrorCategory(131026)).toBe('DELIVERY');
    expect(metaErrorCategory(130429)).toBe('RATE_LIMIT');
    expect(
      redactMetaErrorTitle('(#131047) Re-engage wa_id=9198 wamid=wamid.HBg foo@x.com', 131047)
    ).not.toMatch(/wa_id|wamid|@/);
  });

  it('upserts a daily org/number aggregate without storing Graph payloads', async () => {
    await recordMetaErrorStat({
      organizationId: 'org-1',
      whatsappNumberId: 'num-1',
      code: 131047,
      sampleTitle: 'Re-engage required for wa_id 9198',
    });

    const args = upsert.mock.calls[0][0];
    const unique = args.where.organizationId_scopeKey_code_bucketDate;
    expect(unique?.scopeKey).toBe('num-1');
    expect(args.create).not.toHaveProperty('payload');
    expect(JSON.stringify(args)).not.toMatch(/9198|wa_id/);
    expect(args.create?.count).toBe(1);
    expect(args.update).toEqual(
      expect.objectContaining({ count: { increment: 1 } })
    );
  });

  it('never persists arbitrary provider text and isolates aggregate failures', async () => {
    await recordMetaErrorStat({
      organizationId: 'org-1',
      code: 999999,
      sampleTitle: 'Alice +919876543210 token=secret fbtrace_id=trace',
    });
    expect(JSON.stringify(upsert.mock.calls[0][0])).not.toMatch(/Alice|919876543210|secret|trace/);
    expect(upsert.mock.calls[0][0].create.sampleTitle).toBe('Meta error 999999');

    const failingUpsert = vi.fn().mockRejectedValue(new Error('database unavailable'));
    expect(() =>
      emitMetaErrorStat(
        { organizationId: 'org-1', code: 131026, sampleTitle: '+919876543210' },
        { metaErrorStat: { upsert: failingUpsert } } as never
      )
    ).not.toThrow();
    await vi.waitFor(() => expect(failingUpsert).toHaveBeenCalledTimes(1));
  });

  it('clusters Graph delivery-status failures without phones or payloads', async () => {
    expect(
      extractWebhookStatusMetaError('DELIVERED', {
        errors: [{ code: 131026, title: 'Message undeliverable for wa_id 9198' }],
        recipient_id: '919876543210',
      })
    ).toBeNull();

    const parsed = extractWebhookStatusMetaError('FAILED', {
      errors: [{ code: 131026, title: 'Message undeliverable for wa_id 9198' }],
      recipient_id: '919876543210',
    });
    expect(parsed?.code).toBe(131026);

    recordWebhookStatusMetaError({
      organizationId: 'org-1',
      whatsappNumberId: 'num-1',
      statusValue: 'FAILED',
      status: {
        errors: [{ code: 131048, title: 'Spam rate for +919876543210' }],
        recipient_id: '919876543210',
      },
    });
    await vi.waitFor(() => expect(upsert).toHaveBeenCalled());
    expect(JSON.stringify(upsert.mock.calls[0][0])).not.toMatch(/919876543210|wa_id|\+/);
    expect(upsert.mock.calls[0][0].create.sampleTitle).toBe('Spam rate / quality limit');
    expect(upsert.mock.calls[0][0].create).not.toHaveProperty('payload');
  });
});
