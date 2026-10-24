import { describe, expect, it } from 'vitest';
import {
  draftFromAiSuggestion,
  draftPayload,
  EMPTY_DRAFT,
  emptyTemplateButton,
  bodyVariableIndexes,
  humanizeSluggedName,
  normalizeCategory,
  rowToDraft,
  sampleForVariable,
  titleCaseCategory,
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

  it('coerces custom categories to UTILITY — Meta-only taxonomy (titleCaseCategory labels)', () => {
    const custom = rowToDraft({ ...row, category: 'FESTIVE_OFFER' });
    expect(custom.category).toBe('UTILITY');
    expect(draftPayload(custom).category).toBe('UTILITY');
    expect(rowToDraft({ ...row, category: '' }).category).toBe('UTILITY');
    expect(normalizeCategory('MARKETING')).toBe('MARKETING');
    expect(normalizeCategory('AUTHENTICATION')).toBe('AUTHENTICATION');
    expect(normalizeCategory('garbage')).toBe('UTILITY');
    expect(titleCaseCategory('UTILITY')).toBe('Utility');
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

  it('humanizeSluggedName derives the display name from a slug (Name/Slug field)', () => {
    expect(humanizeSluggedName('order_shipped')).toBe('Order Shipped');
    expect(humanizeSluggedName('FESTIVE_OFFER_2')).toBe('Festive Offer 2');
    expect(humanizeSluggedName('  hello_world ')).toBe('Hello World');
    expect(humanizeSluggedName('single')).toBe('Single');
    expect(humanizeSluggedName('')).toBe('');
  });
});

describe('draftFromAiSuggestion (AI option preview === apply)', () => {
  const base = rowToDraft({ ...row, body: 'old body', title: 'Old Title', slug: 'old_slug' });
  const suggestion = {
    title: 'Festive Offer Blast',
    slug: 'festive_offer_blast',
    category: 'MARKETING' as const,
    body: 'Hi {{1}}! Flat {{2}} off with code {{3}}.',
    bodyHi: 'नमस्ते {{1}}! कोड {{3}} से {{2}} छूट।',
    footer: 'Reply STOP to stop messages',
    footerHi: 'संदेश रोकने के लिए STOP भेजें',
    buttons: [{ type: 'URL' as const, text: 'Shop now', url: 'https://example.com', phone_number: '', example: '' }],
    variables: [
      { index: 1, description: 'Customer name', suggestedSource: 'contact.name' },
      { index: 2, description: 'Discount', suggestedSource: 'custom' },
      { index: 3, description: 'Code', suggestedSource: 'custom' },
    ],
  };

  it('overwrites copy fields and rebuilds variableMeta + examples', () => {
    const next = draftFromAiSuggestion(base, suggestion, false);
    expect(next.category).toBe('MARKETING');
    expect(next.body).toBe(suggestion.body);
    expect(next.bodyHi).toBe(suggestion.bodyHi);
    expect(next.footer).toBe('Reply STOP to stop messages');
    expect(next.footerHi).toBe('संदेश रोकने के लिए STOP भेजें');
    expect(next.buttons).toHaveLength(1);
    expect(next.variableMeta).toHaveLength(3);
    expect(next.variableMeta.every((m) => m.scope === 'body')).toBe(true);
    expect(next.bodyExamples).toHaveLength(3);
    expect(next.bodyExamples[0]).toBe(sampleForVariable('Customer name', 1, 'contact.name'));
  });

  it('derives slug + humanized title on a new row, keeps header/media untouched', () => {
    const next = draftFromAiSuggestion(EMPTY_DRAFT, suggestion, false);
    expect(next.slug).toBe('festive_offer_blast');
    expect(next.title).toBe('Festive Offer Blast');
    expect(next.header).toBe('');
    expect(next.mediaFormat).toBe('');
  });

  it('keeps the stored slug on an existing row and only updates the title', () => {
    const next = draftFromAiSuggestion(base, suggestion, true);
    expect(next.slug).toBe('old_slug');
    expect(next.title).toBe('Festive Offer Blast');
  });
});
