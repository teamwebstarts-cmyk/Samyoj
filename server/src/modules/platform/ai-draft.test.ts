import { describe, expect, it } from 'vitest';
import { libraryTemplateAiDraftSchema, normalizeDraft, type LibraryTemplateAiDraft } from './ai-draft';

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

describe('variant coalescing (clientOf /drafts parsing rules)', () => {
  // Mirrors the parsing rules in fetchTemplateDraftsFromLlm so the contract is pinned
  // without hitting the network: accept {drafts:[…]} / bare array / single object,
  // keep only schema-valid drafts, dedupe, cap at 3.
  const coalesce = (parsed: unknown): LibraryTemplateAiDraft[] => {
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { drafts?: unknown[] }).drafts)
        ? ((parsed as { drafts: unknown[] }).drafts)
        : [parsed];
    const validated = list
      .map((item) => libraryTemplateAiDraftSchema.safeParse(item))
      .filter((r): r is typeof r & { success: true } => r.success)
      .map((r) => r.data);
    const seen = new Set<string>();
    return validated
      .filter((draft) => {
        const key = `${draft.category}::${draft.body}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  };

  const draftOf = (body: string, category = 'MARKETING') => ({
    title: body,
    slug: body.replace(/[^a-z0-9]+/g, '_').slice(0, 20),
    category,
    body,
    bodyHi: body,
    variables: [{ index: 1, description: 'Name', suggestedSource: 'contact.name' }],
  });

  it('unwraps a bare array', () => {
    expect(coalesce([draftOf('a'), draftOf('b')])).toHaveLength(2);
  });

  it('unwraps a single object into one option', () => {
    expect(coalesce(draftOf('solo'))).toHaveLength(1);
  });

  it('drops schema-invalid drafts instead of failing the whole batch', () => {
    expect(coalesce([...[] , draftOf('good'), { nope: true }])).toHaveLength(1);
  });

  it('dedupes identical category+body pairs', () => {
    expect(coalesce([draftOf('same'), draftOf('same'), draftOf('other')])).toHaveLength(2);
  });

  it('caps at three options', () => {
    expect(coalesce(['a', 'b', 'c', 'd', 'e'].map((n) => draftOf(n)))).toHaveLength(3);
  });

  it('signals invalid when nothing survives', () => {
    expect(coalesce([{ nope: true }])).toHaveLength(0);
  });
});

describe('normalizeDraft (real Sarvam failure shapes caught in probes)', () => {
  // Probe run 2026-10-24 caught these exact shapes live:
  // 1) variables entries WITHOUT index (~half of 3-draft replies)
  // 2) lowercase/alias sources, "auth" category shorthand
  // 3) {{n}} in bodies with no variables entry at all
  it('fills missing variable indexes from array order (probe: variables.0.index Required)', () => {
    const normalized = normalizeDraft({
      title: 'Diwali Offer',
      slug: 'diwali_offer',
      category: 'MARKETING',
      body: 'Hi {{1}}, get {{2}} off with {{3}}.',
      bodyHi: 'नमस्ते {{1}}, {{2}} छूट {{3}} कोड से।',
      variables: [
        { description: 'Customer name', suggestedSource: 'contact.name' },
        { description: 'Discount', suggestedSource: 'custom' },
        { description: 'Code', suggestedSource: 'custom' },
      ],
    });
    expect(normalized).not.toBeNull();
    const parsed = libraryTemplateAiDraftSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    // Raw shape (missing index) fails the schema — normalization is what saves it.
    expect(libraryTemplateAiDraftSchema.safeParse({
      title: 'D', slug: 'd', category: 'MARKETING', body: 'x', bodyHi: 'y',
      variables: [{ description: 'A', suggestedSource: '' }],
    }).success).toBe(false);
  });

  it('maps category shorthand and source aliases (probe: AUTH / NAME / uppercase)', () => {
    const normalized = normalizeDraft({
      title: 'OTP',
      slug: 'otp_code',
      category: 'auth',
      body: '{{1}} is your code.',
      bodyHi: '{{1}} आपका कोड है।',
      variables: [{ index: 1, description: 'Code', suggestedSource: 'CONTACT.CUSTOM' }],
    });
    expect(normalized?.category).toBe('AUTHENTICATION');
    expect(normalized?.variables?.[0]).toMatchObject({ index: 1, suggestedSource: 'contact.custom' });
  });

  it('synthesizes variables entries for {{n}} used in bodies but missing from the roster', () => {
    const normalized = normalizeDraft({
      title: 'Sale',
      slug: 'sale',
      category: 'MARKETING',
      body: 'Hi {{1}}, {{2}} off today!',
      bodyHi: 'नमस्ते {{1}}, आज {{2}} छूट!',
      variables: [{ index: 1, description: 'Customer name', suggestedSource: 'contact.name' }],
    });
    const parsed = libraryTemplateAiDraftSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.variables.map((v) => v.index)).toEqual([1, 2]);
      expect(parsed.data.variables[1].description).toBe('Variable 2');
    }
  });

  it('returns null for drafts without both language bodies (schema-required)', () => {
    expect(normalizeDraft({ title: 'X', slug: 'x', category: 'MARKETING', body: 'only', variables: [] })).toBeNull();
    expect(normalizeDraft('prose, not an object')).toBeNull();
  });
});

describe('clarify union (vague-prompt reply contract)', () => {
  // Mirrors the parseClarify guard in fetchTemplateDraftsFromLlm: a reply with a
  // non-empty "clarify" string array is a question set, not drafts — it must
  // short-circuit BEFORE draft parsing and never produce a 502.
  const parseClarifyShape = (parsed: Record<string, unknown>): string[] | null => {
    const raw = parsed.clarify;
    if (!Array.isArray(raw)) return null;
    const questions = raw
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0 && q.trim().length <= 200)
      .map((q) => q.trim())
      .slice(0, 3);
    return questions.length > 0 ? questions : null;
  };

  it('parses a valid clarify reply into ≤3 questions', () => {
    expect(parseClarifyShape({ clarify: ['What business?', 'What offer?', 'What tone?', 'Extra ignored'] })).toEqual([
      'What business?',
      'What offer?',
      'What tone?',
    ]);
  });

  it('falls through to drafts when clarify is absent, empty, or non-string', () => {
    expect(parseClarifyShape({ drafts: [] })).toBeNull();
    expect(parseClarifyShape({ clarify: [] })).toBeNull();
    expect(parseClarifyShape({ clarify: ['ok', 42, '   '] })).toEqual(['ok']);
  });
});
