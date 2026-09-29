import { describe, expect, it } from 'vitest';
import { buildMimeMessage, sanitizeEmailHtml } from './mime';

describe('Gmail MIME builder', () => {
  it('builds base64url RFC2822 MIME with plain text and attachment', () => {
    const result = buildMimeMessage({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Invoice',
      textBody: 'Please find the invoice attached.',
      attachments: [{ filename: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') }],
    });
    const decoded = Buffer.from(result.encoded, 'base64url').toString('utf8');
    expect(decoded).toContain('From: sender@example.com');
    expect(decoded).toContain('Content-Disposition: attachment; filename="invoice.pdf"');
    expect(result.decodedBytes).toBeGreaterThan(0);
  });

  it('removes executable HTML and preserves the plain text fallback', () => {
    const html = sanitizeEmailHtml('<p>Hello</p><script>alert(1)</script><a href="javascript:bad()">x</a>');
    expect(html).toContain('<p>Hello</p>');
    expect(html).not.toMatch(/script|javascript:/i);
    const result = buildMimeMessage({
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Hello',
      textBody: 'Fallback',
      htmlBody: html,
    });
    expect(result.raw).toContain('text/plain');
    expect(result.raw).toContain('text/html');
  });

  it('rejects encoded and whitespace-obfuscated javascript URLs and strips attributes', () => {
    const html = sanitizeEmailHtml(
      '<a class="x" onclick="alert(1)" href="java&#x09;script%3Aalert(1)">bad</a>' +
      '<a href="%6a%61%76%61%73%63%72%69%70%74:alert(1)">bad</a>' +
      '<a href="https://example.com/path?q=1">good</a>'
    );
    expect(html).toContain('<a>bad</a>');
    expect(html).toContain('<a href="https://example.com/path?q=1">good</a>');
    expect(html).not.toMatch(/onclick|class|javascript/i);
  });

  it('fails closed when the decoded MIME budget is exceeded', () => {
    expect(() =>
      buildMimeMessage({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Large',
        textBody: 'x'.repeat(20 * 1024 * 1024),
      })
    ).toThrow(/decoded MIME budget/i);
  });
});

