import { MAX_DECODED_MIME_BYTES } from './constants';

export interface MimeAttachment {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface BuiltMime {
  raw: string;
  encoded: string;
  decodedBytes: number;
}

function headerValue(value: string, label: string): string {
  if (/[\r\n]/.test(value)) throw new Error(`${label} contains invalid line breaks`);
  return value.trim();
}

function encodeHeader(value: string): string {
  const safe = headerValue(value, 'Header');
  if (/^[\x20-\x7e]*$/.test(safe)) return safe;
  return `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`;
}

function wrapBase64(value: Buffer | string): string {
  const encoded = Buffer.isBuffer(value)
    ? value.toString('base64')
    : Buffer.from(value, 'utf8').toString('base64');
  return encoded.match(/.{1,76}/g)?.join('\r\n') || '';
}

const ALLOWED_HTML_TAGS = new Set([
  'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'i', 'li', 'ol', 'p',
  'span', 'strong', 'u', 'ul',
]);

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(?:#(?:x([0-9a-f]+)|([0-9]+))|([a-z]+));/gi,
    (entity, hex: string, decimal: string, named: string) => {
      if (named) {
        return ({ amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' } as Record<string, string>)[
          named.toLowerCase()
        ] ?? entity;
      }
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return Number.isSafeInteger(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
  );
}

function safeEmailUrl(value: string): string | null {
  let normalized = decodeHtmlEntities(value).trim();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(normalized);
      if (decoded === normalized) break;
      normalized = decoded;
    } catch {
      break;
    }
  }
  normalized = normalized.replace(/[\u0000-\u0020\u007f]/g, '');
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function findTagEnd(value: string, start: number): number {
  let quote = '';
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }
  return -1;
}

function sanitizeHtmlTag(rawTag: string): string {
  const closing = /^<\s*\//.test(rawTag);
  const match = rawTag.match(/^<\s*\/?\s*([a-z0-9]+)/i);
  if (!match) return '';
  const name = match[1].toLowerCase();
  if (!ALLOWED_HTML_TAGS.has(name)) return '';
  if (closing) return `</${name}>`;
  if (name !== 'a') return `<${name}${name === 'br' ? ' /' : ''}>`;

  const attributes = rawTag.slice(match[0].length, -1);
  const href = attributes.match(
    /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
  );
  const safeHref = href ? safeEmailUrl(href[1] ?? href[2] ?? href[3] ?? '') : null;
  return safeHref
    ? `<a href="${safeHref.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`
    : '<a>';
}

/** Conservative parser/allowlist sanitizer for email HTML. */
export function sanitizeEmailHtml(input: string): string {
  const html = input
    .slice(0, 100_000)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<\s*(script|style|iframe|object|embed|form|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ''
    )
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta)\b[^>]*\/?>/gi, '');
  let result = '';
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start < 0) {
      result += html.slice(cursor);
      break;
    }
    result += html.slice(cursor, start);
    const end = findTagEnd(html, start + 1);
    if (end < 0) break;
    result += sanitizeHtmlTag(html.slice(start, end + 1));
    cursor = end + 1;
  }
  return result;
}

function textPart(text: string, contentType: string): string {
  return [
    `Content-Type: ${contentType}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(text),
  ].join('\r\n');
}

function attachmentPart(attachment: MimeAttachment): string {
  return [
    `Content-Type: ${attachment.mimeType}; name="${encodeHeader(attachment.filename)}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${encodeHeader(attachment.filename)}"`,
    '',
    wrapBase64(attachment.buffer),
  ].join('\r\n');
}

export function buildMimeMessage(input: {
  from: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string | null;
  attachments?: MimeAttachment[];
}): BuiltMime {
  const from = headerValue(input.from, 'From');
  const to = headerValue(input.to, 'To');
  const subject = encodeHeader(input.subject);
  const textBody = input.textBody;
  if (!textBody.trim()) throw new Error('Plain text email body is required');

  const attachments = input.attachments ?? [];
  const mixedBoundary = `=_samyoj_mixed_${cryptoRandomBoundary()}`;
  const alternativeBoundary = `=_samyoj_alt_${cryptoRandomBoundary()}`;
  const html = input.htmlBody?.trim() ? sanitizeEmailHtml(input.htmlBody) : '';
  const body = html
    ? [
        `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
        '',
        `--${alternativeBoundary}`,
        textPart(textBody, 'text/plain'),
        `--${alternativeBoundary}`,
        textPart(html, 'text/html'),
        `--${alternativeBoundary}--`,
      ].join('\r\n')
    : textPart(textBody, 'text/plain');

  const unsubscribe = textBody.match(/https?:\/\/[^\s<>"]+\/api\/gmail\/unsubscribe\?token=[A-Za-z0-9._~%-]+/);
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    ...(unsubscribe ? [`List-Unsubscribe: <${unsubscribe[0]}>`] : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    body,
    ...attachments.flatMap((attachment) => [`--${mixedBoundary}`, attachmentPart(attachment)]),
    `--${mixedBoundary}--`,
    '',
  ].join('\r\n');

  const decodedBytes =
    Buffer.byteLength(raw, 'utf8') -
    attachments.reduce((total, attachment) => total + Buffer.byteLength(wrapBase64(attachment.buffer), 'utf8'), 0) +
    attachments.reduce((total, attachment) => total + attachment.buffer.length, 0);
  if (decodedBytes > MAX_DECODED_MIME_BYTES) {
    throw new Error(`Email exceeds the ${MAX_DECODED_MIME_BYTES} byte decoded MIME budget`);
  }

  return {
    raw,
    encoded: Buffer.from(raw, 'utf8').toString('base64url'),
    decodedBytes,
  };
}

function cryptoRandomBoundary(): string {
  return Math.random().toString(36).slice(2, 12);
}

