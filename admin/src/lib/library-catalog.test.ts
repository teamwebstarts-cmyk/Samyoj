import { describe, expect, it } from 'vitest';
import {
  draftPayload,
  emptyTemplateButton,
  bodyVariableIndexes,
  rowToDraft,
  sampleForVariable,
  type LibraryRow,
} from './library-catalog';

const row: LibraryRow = {
  id: 'r1',
  slug: 'order_update',
  title: 'Order Update',
  category: 'UTILITY',
  tags: ['orders'],
  icon: 'package',
  header: null,
  mediaFormat: null,
  body: 'Hi {{1}}, order {{2}} shipped.',
  bodyHi: '{{1}}, ऑर्डर {{2}} भेज दिया गया।',
  footer: 'Team Samyoj',
  footerHi: null,
  buttons: [
    { type: 'QUICK_REPLY', text: 'Track order' },
    { type: 'URL', text: 'Visit', url: 'https://example.com' },
    { type: 'PHONE_NUMBER', text: 'Call', phone_number: '+919876543210' },
    { type: 'COPY_CODE', text: 'Copy', example: 'SAVE20' },
    { type: 'UNKNOWN_TYPE', text: 'dropped' } as never,
  ],
  bodyExamples: ['Ravi', '10234'],
  copy: '',
  published: true,
  sortOrder: 1,
};

describe('admin template editor draft model', () => {
  it('round-trips a multi-button row through draftPayload (server catalogButtonSchema shape)', () => {
    const draft = rowToDraft(row);
    expect(draft.buttons).toHaveLength(4); // unknown types are filtered like the client formFromCatalogEntry
    expect(draft.buttons.map((b) => b.type)).toEqual(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE']);

    const payload = draftPayload(draft);
    expect(payload.buttons).toEqual([
      { type: 'QUICK_REPLY', text: 'Track order' },
      { type: 'URL', text: 'Visit', url: 'https://example.com' },
      { type: 'PHONE_NUMBER', text: 'Call', phone_number: '+919876543210' },
      { type: 'COPY_CODE', text: 'Copy', example: 'SAVE20' },
    ]);
  });

  it('drops untitled buttons from the payload instead of failing Meta validation', () => {
    const draft = rowToDraft(row);
    draft.buttons = [
      { ...emptyTemplateButton('URL'), text: '', url: 'https://x.com' },
      { ...emptyTemplateButton('QUICK_REPLY'), text: 'Ok' },
    ];
    expect(draftPayload(draft).buttons).toEqual([{ type: 'QUICK_REPLY', text: 'Ok' }]);
  });

  it('keeps variableMeta editor-local (never sent to the catalog API)', () => {
    const payload = draftPayload(rowToDraft(row));
    expect('variableMeta' in payload).toBe(false);
    expect('headerExamples' in payload).toBe(false);
  });

  it('sampleForVariable mirrors client fallbacks (description map → source → positional)', () => {
    expect(sampleForVariable('Customer name', 1)).toBe('Rahul');
    expect(sampleForVariable('', 3, 'contact.phone')).toBe('+919876543210');
    expect(sampleForVariable('Offer code', 2)).toBe('SAVE20');
    expect(sampleForVariable('', 4)).toBe('Sample 4');
  });

  it('bodyVariableIndexes lists distinct {{n}} present in the body, ascending (chip roster)', () => {
    expect(bodyVariableIndexes('Hi {{1}}, order {{2}} for {{1}} — ref {{4}}')).toEqual([1, 2, 4]);
    expect(bodyVariableIndexes('No variables here')).toEqual([]);
    expect(bodyVariableIndexes('')).toEqual([]);
  });
});
