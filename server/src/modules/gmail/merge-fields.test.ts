import { describe, expect, it } from 'vitest';
import { applyGmailMerge, extractMergeKeys, unresolvedAfterGmailMerge } from './merge-fields';

const contact = { name: 'Asha', email: 'asha@example.com', phone: '+911234567890' };

describe('gmail merge fields', () => {
  it('extracts unique keys from subject and body', () => {
    expect(extractMergeKeys('Hi {{name}}', 'Order {{order_id}} and {{name}}')).toEqual(['name', 'order_id']);
  });

  it('fills contact, company, and custom merge fields', () => {
    const out = applyGmailMerge(
      'Hi {{name}}, order {{order_id}} — {{company}}',
      contact,
      { companyName: 'Samyoj', mergeFields: { order_id: 'ORD-9' } },
    );
    expect(out).toBe('Hi Asha, order ORD-9 — Samyoj');
  });

  it('contact fields override client merge for name/email/phone', () => {
    const out = applyGmailMerge('{{name}} {{email}}', contact, {
      mergeFields: { name: 'Wrong', email: 'wrong@x.com', phone: '0' },
    });
    expect(out).toBe('Asha asha@example.com');
  });

  it('reports unresolved tokens after merge', () => {
    const keys = unresolvedAfterGmailMerge(
      'Order {{order_id}}',
      'Thanks {{company}}',
      null,
      contact,
      { companyName: 'Acme', mergeFields: {} },
    );
    expect(keys).toEqual(['order_id']);
  });
});
