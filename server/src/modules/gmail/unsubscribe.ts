import jwt from 'jsonwebtoken';
import { config } from '../../config';

const AUDIENCE = 'samyoj-gmail-unsub';

export function gmailUnsubscribeUrl(organizationId: string, contactId: string): string {
  const token = jwt.sign(
    { type: 'gmail_unsub', organizationId, contactId },
    config.jwt.oauthStateSecret,
    { algorithm: 'HS256', expiresIn: '730d', audience: AUDIENCE },
  );
  return `${config.baseUrl.replace(/\/$/, '')}/api/gmail/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function verifyGmailUnsubscribeToken(
  token: string,
): { organizationId: string; contactId: string } | null {
  try {
    const payload = jwt.verify(token, config.jwt.oauthStateSecret, {
      algorithms: ['HS256'],
      audience: AUDIENCE,
    }) as { type?: string; organizationId?: string; contactId?: string };
    if (payload.type !== 'gmail_unsub' || !payload.organizationId || !payload.contactId) return null;
    return { organizationId: payload.organizationId, contactId: payload.contactId };
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`;
}

export function gmailUnsubscribeConfirmPage(token: string): string {
  return page(
    'Stop these emails',
    `<p>Confirm and Samyoj will stop email to this address from this business.</p><form method="post" action="/api/gmail/unsubscribe"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Unsubscribe</button></form>`,
  );
}

export function gmailUnsubscribedPage(): string {
  return page('Unsubscribed', '<p>You will not get more email from this business through Samyoj.</p>');
}

export function gmailUnsubscribeInvalidPage(): string {
  return page('Link not valid', '<p>This unsubscribe link is not valid. Ask the sender to remove you.</p>');
}

/** Append a confirm-link. A GET of the link does not opt the contact out. */
export function appendGmailUnsubscribe(
  textBody: string,
  htmlBody: string | null | undefined,
  url: string,
): { textBody: string; htmlBody: string | null } {
  const line = `To stop these emails, open this link and confirm: ${url}`;
  const text = textBody.includes(url) ? textBody : `${textBody.replace(/\s*$/, '')}\n\n${line}`;
  if (!htmlBody?.trim()) return { textBody: text, htmlBody: null };
  const html = htmlBody.includes(url)
    ? htmlBody
    : `${htmlBody}<p>To stop these emails, <a href="${url}">unsubscribe</a>.</p>`;
  return { textBody: text, htmlBody: html };
}
