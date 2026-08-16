import { describe, expect, it } from 'vitest';
import { inboxStartCreateData, inboxStartMergeUpdate } from './merge';

describe('inbox start contact merge', () => {
  it('creates without campaign consent when the checkbox is omitted', () => {
    expect(inboxStartCreateData({ name: 'Ada' })).toMatchObject({
      name: 'Ada',
      optedIn: false,
    });
    expect(inboxStartCreateData({ name: 'Ada' }).consentSource).toBeUndefined();
  });

  it('creates with INBOX_START audit when campaign consent is checked', () => {
    const data = inboxStartCreateData({ optedIn: true });
    expect(data.optedIn).toBe(true);
    expect(data.consentSource).toBe('INBOX_START');
    expect(data.consentAt).toBeInstanceOf(Date);
  });

  it('does not wipe existing name, tags, or consent when extras are blank', () => {
    const update = inboxStartMergeUpdate(
      { tags: ['vip'], customAttributes: { city: 'Mumbai' } },
      { optedIn: false }
    );
    expect(update).toEqual({});
  });

  it('merges provided tags and attributes without dropping current ones', () => {
    const update = inboxStartMergeUpdate(
      { tags: ['vip'], customAttributes: { city: 'Mumbai' } },
      { name: 'Ada', tags: ['lead'], customAttributes: { order_id: '1' }, optedIn: true }
    );
    expect(update.name).toBe('Ada');
    expect(update.tags).toEqual(['vip', 'lead']);
    expect(update.customAttributes).toEqual({ city: 'Mumbai', order_id: '1' });
    expect(update.optedIn).toBe(true);
    expect(update.consentSource).toBe('INBOX_START');
  });
});
