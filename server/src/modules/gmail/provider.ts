import prisma from '../../config/database';
import { decrypt, encrypt } from '../../utils/crypto';
import { GMAIL_REQUEST_TIMEOUT_MS } from './constants';
import { buildMimeMessage, type MimeAttachment } from './mime';

export class GmailReconnectRequiredError extends Error {
  readonly reconnectRequired = true;
  constructor(message = 'Reconnect Gmail to continue sending') {
    super(message);
    this.name = 'GmailReconnectRequiredError';
  }
}

export class GmailProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code?: string,
    readonly providerBoundaryReached = false
  ) {
    super(message);
    this.name = 'GmailProviderError';
  }
}

function requestSignal(): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), GMAIL_REQUEST_TIMEOUT_MS).unref?.();
  return controller.signal;
}

async function refreshAccessToken(mailbox: {
  id: string;
  refreshTokenEncrypted: string | null;
}): Promise<string> {
  if (!mailbox.refreshTokenEncrypted) throw new GmailReconnectRequiredError();
  let refreshToken: string;
  try {
    refreshToken = decrypt(mailbox.refreshTokenEncrypted);
  } catch {
    throw new GmailReconnectRequiredError('Gmail credentials could not be decrypted; reconnect Gmail');
  }
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  let response: Response;
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: requestSignal(),
    });
  } catch (error) {
    throw new GmailProviderError(
      'Google token refresh failed before Gmail send',
      true,
      error instanceof Error && error.name === 'TimeoutError'
        ? 'GMAIL_TOKEN_REFRESH_TIMEOUT'
        : 'GMAIL_TOKEN_REFRESH_FAILED',
    );
  }
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || !payload.access_token) {
    if (payload.error === 'invalid_grant' || response.status === 400 || response.status === 401) {
      throw new GmailReconnectRequiredError('Google revoked this connection; reconnect Gmail');
    }
    throw new GmailProviderError(
      'Google token refresh failed',
      response.status >= 500 || response.status === 429,
      payload.error,
    );
  }
  await prisma.gmailMailbox.updateMany({
    where: { id: mailbox.id, status: 'CONNECTED' },
    data: {
      accessTokenEncrypted: encrypt(payload.access_token),
      tokenExpiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000),
    },
  });
  return payload.access_token;
}

export async function getGmailAccessToken(mailbox: {
  id: string;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  if (!mailbox.accessTokenEncrypted) throw new GmailReconnectRequiredError();
  if (mailbox.tokenExpiresAt && mailbox.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    try {
      return decrypt(mailbox.accessTokenEncrypted);
    } catch {
      throw new GmailReconnectRequiredError('Gmail credentials could not be decrypted; reconnect Gmail');
    }
  }
  return refreshAccessToken(mailbox);
}

export async function sendGmailMessage(input: {
  mailbox: {
    id: string;
    accessTokenEncrypted: string | null;
    refreshTokenEncrypted: string | null;
    tokenExpiresAt: Date | null;
  };
  from: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string | null;
  attachments: MimeAttachment[];
}): Promise<{ id: string; decodedBytes: number }> {
  const accessToken = await getGmailAccessToken(input.mailbox);
  const mime = buildMimeMessage(input);
  let response: Response;
  try {
    response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw: mime.encoded }),
      signal: requestSignal(),
    });
  } catch (error) {
    throw new GmailProviderError(
      'Gmail request outcome is unknown; reconcile before retrying',
      false,
      error instanceof Error && error.name === 'TimeoutError'
        ? 'GMAIL_REQUEST_TIMEOUT'
        : 'GMAIL_REQUEST_FAILED',
      true,
    );
  }
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { code?: number; message?: string; status?: string };
  };
  if (response.status === 401 || payload.error?.status === 'UNAUTHENTICATED') {
    throw new GmailReconnectRequiredError('Google rejected the token; reconnect Gmail');
  }
  if (!response.ok || !payload.id) {
    const code =
      response.status === 403
        ? 'GMAIL_FORBIDDEN'
        : String(payload.error?.code || response.status);
    throw new GmailProviderError(
      payload.error?.message || 'Gmail did not accept the email',
      false,
      code,
      true,
    );
  }
  return { id: payload.id, decodedBytes: mime.decodedBytes };
}

