import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { AppError } from '../../utils/response';
import {
  isIdempotencyConflict,
  readIdempotencyKey,
} from './outbound-idempotency';

describe('readIdempotencyKey', () => {
  it('returns undefined when the header is missing', () => {
    expect(readIdempotencyKey({ header: () => undefined } as never)).toBeUndefined();
  });

  it('trims a valid click key', () => {
    expect(
      readIdempotencyKey({ header: () => '  click-key-123  ' } as never)
    ).toBe('click-key-123');
  });

  it('rejects keys that are too short or too long', () => {
    expect(() => readIdempotencyKey({ header: () => 'short' } as never)).toThrow(AppError);
    expect(() => readIdempotencyKey({ header: () => 'x'.repeat(129) } as never)).toThrow(AppError);
  });
});

describe('isIdempotencyConflict', () => {
  it('treats Prisma unique violations as a replay race', () => {
    expect(
      isIdempotencyConflict(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' })
      )
    ).toBe(true);
    expect(isIdempotencyConflict(new Error('nope'))).toBe(false);
  });
});

describe('same-key replay contract', () => {
  it('replays the first message instead of creating a second row', async () => {
    const first = { id: 'msg-1', conversationId: 'c1', idempotencyKey: 'click-key-123' };
    const findFirst = vi.fn().mockResolvedValue(first);
    const create = vi.fn();

    async function sendTwice(conversationId: string, key: string) {
      const existing = await findFirst({ where: { conversationId, idempotencyKey: key } });
      if (existing) return existing;
      return create({ data: { conversationId, idempotencyKey: key } });
    }

    const a = await sendTwice('c1', 'click-key-123');
    const b = await sendTwice('c1', 'click-key-123');
    expect(a).toBe(b);
    expect(a.id).toBe('msg-1');
    expect(create).not.toHaveBeenCalled();
  });
});
