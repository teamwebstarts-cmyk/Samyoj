import { describe, expect, it } from 'vitest';
import { libraryTemplateAiDraftSchema } from './ai-draft';

// The AI reply is validated against this schema before reaching the editor —
// these tests pin the contract the admin AiAssistBar depends on.
describe('libraryTemplateAiDraftSchema (AI draft contract)', () => {
  const valid = {
    title: 'Festive Offer Blast',
    slug: 'festival_offer_blast',
    category: 'MARKETING',
    body: 'Hi {{1}}! Flat {{2}} off with code {{3}}.',
    bodyHi: 'नमस्ते {{1}}! कोड {{3}} से {{2}} छूट।',
    footer: 'Reply STOP to stop messages',
    footerHi: 'संदेश रोकने के लिए STOP भेजें',
    buttons: [{ type: 'URL', text: 'Shop now', url: 'https://example.com' }],
    variables: [
      { index: 1, description: 'Customer name', suggestedSource: 'contact.name' },
      { index: 2, description: 'Discount', suggestedSource: 'custom' },
      { index: 3, description: 'Code', suggestedSource: 'custom' },
    ],
  };

  it('accepts a well-formed bilingual draft', () => {
    expect(libraryTemplateAiDraftSchema.safeParse(valid).success).toBe(true);
  });

  it('defaults footer and buttons when the model omits them', () => {
    const parsed = libraryTemplateAiDraftSchema.parse({
      title: 'OTP code',
      slug: 'otp_code',
      category: 'AUTHENTICATION',
      body: '{{1}} is your code.',
      bodyHi: '{{1}} आपका कोड है।',
      variables: [{ index: 1, description: 'Code', suggestedSource: 'custom' }],
    });
    expect(parsed.buttons).toEqual([]);
    expect(parsed.footer).toBe('');
    expect(parsed.footerHi).toBe('');
  });

  it('rejects an uppercase or spaced slug', () => {
    expect(libraryTemplateAiDraftSchema.safeParse({ ...valid, slug: 'Festival Offer' }).success).toBe(false);
  });

  it('rejects a non-allowlisted suggestedSource', () => {
    expect(
      libraryTemplateAiDraftSchema.safeParse({
        ...valid,
        variables: [{ index: 1, description: 'X', suggestedSource: 'crm.field' }],
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown button type', () => {
    expect(
      libraryTemplateAiDraftSchema.safeParse({
        ...valid,
        buttons: [{ type: 'WEBHOOK', text: 'Ping' }],
      }).success,
    ).toBe(false);
  });

  it('rejects empty bodies (both languages are required)', () => {
    expect(libraryTemplateAiDraftSchema.safeParse({ ...valid, bodyHi: '' }).success).toBe(false);
  });
});
