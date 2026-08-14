import { describe, expect, it } from 'vitest';
import {
  isCurrentNumberRequest,
  resolveActiveNumber,
  retainActiveNumberId,
  shouldRevalidateNumberCache,
} from './whatsappWorkspace';
import type { WhatsappNumberOption } from '../contexts/WhatsAppNumberContext';

const number = (id: string, phoneNumberId: string): WhatsappNumberOption => ({
  id,
  phoneNumber: `+91${id}`,
  phoneNumberId,
  wabaId: 'waba-1',
  isActive: true,
});

describe('WhatsApp workspace restoration', () => {
  it('restores a reconnected database row by stable Meta phoneNumberId', () => {
    const reconnected = number('new-db-row', 'meta-phone-1');
    expect(resolveActiveNumber([reconnected], 'meta-phone-1')?.id).toBe('new-db-row');
  });

  it('retains the known internal scope after a transient list failure', () => {
    expect(retainActiveNumberId([number('db-1', 'meta-phone-1')], 'db-1')).toBe('db-1');
    expect(retainActiveNumberId([], 'db-1')).toBeNull();
  });

  it('rejects responses that belong to another active number', () => {
    expect(isCurrentNumberRequest('db-a', 'db-b')).toBe(false);
    expect(isCurrentNumberRequest('db-b', 'db-b')).toBe(true);
  });

  it('always revalidates a restored snapshot', () => {
    expect(shouldRevalidateNumberCache()).toBe(true);
  });
});
