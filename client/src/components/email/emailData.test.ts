import { describe, expect, it } from 'vitest';
import {
  EMAIL_TEMPLATE_LIBRARY,
  nextTemplateName,
  safeHtmlFromMarkup,
} from './emailData';

describe('email data helpers', () => {
  it('keeps the read-only library at exactly twelve distinct entries', () => {
    expect(EMAIL_TEMPLATE_LIBRARY).toHaveLength(12);
    expect(new Set(EMAIL_TEMPLATE_LIBRARY.map((template) => template.id)).size).toBe(12);
    expect(new Set(EMAIL_TEMPLATE_LIBRARY.map((template) => template.name)).size).toBe(12);
  });

  it('generates only the supported safe HTML subset', () => {
    const html = safeHtmlFromMarkup('**Bold** *italic* [link](https://example.com) <script>alert(1)</script>');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('<script>');
  });

  it('chooses deterministic copy names', () => {
    expect(nextTemplateName('Welcome', [])).toBe('Welcome');
    expect(nextTemplateName('Welcome', [
      { id: '1', name: 'Welcome', subject: '', textBody: '', htmlBody: null, createdAt: '', updatedAt: '' },
    ])).toBe('Welcome (Copy)');
  });
});
