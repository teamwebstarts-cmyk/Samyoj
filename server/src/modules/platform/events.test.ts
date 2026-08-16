import { describe, expect, it, vi } from 'vitest';
import { PlatformProductEventName } from '@prisma/client';
import {
  areaForProductEvent,
  emitProductEvent,
  recordProductEvent,
  validateProductEvent,
} from './events';

describe('allowlisted product events', () => {
  it('maps every enum name to a product area and rejects extra fields', () => {
    expect(areaForProductEvent('LOGIN_OK')).toBe('AUTH');
    expect(areaForProductEvent('MESSAGE_IN')).toBe('INBOX');
    expect(areaForProductEvent('WHATSAPP_CONNECTED')).toBe('CONNECT');
    expect(Object.values(PlatformProductEventName).length).toBeGreaterThan(10);

    expect(() =>
      validateProductEvent({
        organizationId: 'org-1',
        name: 'LOGIN_OK',
        metadata: { phone: '+91' },
      })
    ).toThrow(/unsupported fields/);
    expect(() =>
      validateProductEvent({
        organizationId: 'org-1',
        name: 'not_an_event',
      })
    ).toThrow(/allowlisted/);
  });

  it('writes only the derived area, enum name, count, and timestamp', async () => {
    const create = vi.fn().mockResolvedValue({});
    const occurredAt = new Date('2026-08-17T00:00:00.000Z');

    await recordProductEvent(
      { organizationId: 'org-1', name: 'CSV_IMPORTED', count: 20, occurredAt },
      { productEvent: { create } } as never
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        area: 'CONTACTS',
        name: 'CSV_IMPORTED',
        count: 20,
        occurredAt,
      },
    });
  });

  it('rejects PII/free-form metadata and isolates write failures', async () => {
    for (const key of ['phone', 'wa_id', 'wamid', 'payload', 'metadata', 'token']) {
      expect(() =>
        validateProductEvent({
          organizationId: 'org-1',
          name: 'MESSAGE_OUT',
          [key]: 'sensitive',
        })
      ).toThrow(/unsupported fields/);
    }

    const create = vi.fn().mockRejectedValue(new Error('database unavailable'));
    expect(() =>
      emitProductEvent(
        { organizationId: 'org-1', name: 'MESSAGE_OUT' },
        { productEvent: { create } } as never
      )
    ).not.toThrow();
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });
});
