import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import getRedis from '../../config/redis';
import { GMAIL_SCOPES } from './constants';

export interface GmailOAuthState {
  type: 'gmail_connect';
  organizationId: string;
  userId: string;
  redirectUri: string;
  returnUri: string;
  nonce: string;
}

const GMAIL_OAUTH_STATE_PREFIX = 'gmail:oauth-state:';
const memoryOAuthStates = new Map<string, { organizationId: string; userId: string; expiresAt: number }>();

export function gmailRedirectUri(): string {
  return process.env.GMAIL_REDIRECT_URI?.trim() || `${config.baseUrl.replace(/\/$/, '')}/api/gmail/oauth/callback`;
}

export function googleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  if (!clientId || !clientSecret) throw new Error('Google Gmail OAuth is not configured');
  return { clientId, clientSecret };
}

export function signGmailOAuthState(
  payload: Omit<GmailOAuthState, 'type' | 'redirectUri' | 'returnUri' | 'nonce'>
): string {
  return jwt.sign(
    {
      ...payload,
      nonce: crypto.randomBytes(24).toString('hex'),
      type: 'gmail_connect',
      redirectUri: gmailRedirectUri(),
      returnUri: `${config.clientUrl.replace(/\/$/, '')}/settings?gmail=1`,
    },
    config.jwt.oauthStateSecret,
    { algorithm: 'HS256', expiresIn: '10m', audience: 'samyoj-gmail-oauth' }
  );
}

export function verifyGmailOAuthState(token: string): GmailOAuthState {
  const state = jwt.verify(token, config.jwt.oauthStateSecret, {
    algorithms: ['HS256'],
    audience: 'samyoj-gmail-oauth',
  }) as GmailOAuthState;
  if (
    state.type !== 'gmail_connect' ||
    !state.organizationId ||
    !state.userId ||
    !state.nonce ||
    state.redirectUri !== gmailRedirectUri() ||
    !state.returnUri.startsWith(`${config.clientUrl.replace(/\/$/, '')}/`)
  ) {
    throw new Error('Invalid Gmail OAuth state');
  }
  return state;
}

export async function storeGmailOAuthState(
  state: GmailOAuthState,
): Promise<void> {
  const payload = JSON.stringify({
    organizationId: state.organizationId,
    userId: state.userId,
  });
  try {
    await getRedis().set(
      `${GMAIL_OAUTH_STATE_PREFIX}${state.nonce}`,
      payload,
      'EX',
      600,
      'NX',
    );
  } catch {
    memoryOAuthStates.set(state.nonce, {
      organizationId: state.organizationId,
      userId: state.userId,
      expiresAt: Date.now() + 600_000,
    });
  }
}

export async function consumeGmailOAuthState(
  state: GmailOAuthState,
): Promise<boolean> {
  try {
    const key = `${GMAIL_OAUTH_STATE_PREFIX}${state.nonce}`;
    const raw = await getRedis().eval(
      "local value = redis.call('get', KEYS[1]); if value then redis.call('del', KEYS[1]); end; return value",
      1,
      key,
    ) as string | null;
    if (!raw) return false;
    const payload = JSON.parse(raw) as { organizationId?: string; userId?: string };
    return payload.organizationId === state.organizationId && payload.userId === state.userId;
  } catch {
    const stored = memoryOAuthStates.get(state.nonce);
    memoryOAuthStates.delete(state.nonce);
    return Boolean(
      stored &&
      stored.expiresAt >= Date.now() &&
      stored.organizationId === state.organizationId &&
      stored.userId === state.userId
    );
  }
}

export function buildGmailOAuthUrl(state: string): string {
  const { clientId } = googleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: gmailRedirectUri(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES.join(' '),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

const GOOGLE_IDENTITY_SCOPE_ALIASES = new Set([
  'openid',
  'email',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.send',
]);

function assertGmailScopeAllowlist(scope?: string): void {
  if (!scope) return;
  const returned = scope.split(/\s+/).filter(Boolean);
  if (
    !returned.includes('https://www.googleapis.com/auth/gmail.send') ||
    returned.some((value) => !GOOGLE_IDENTITY_SCOPE_ALIASES.has(value))
  ) {
    throw new Error('Google returned scopes outside the Gmail send-only allowlist');
  }
}

export async function exchangeGmailCode(code: string): Promise<GoogleTokenResponse> {
  const credentials = googleCredentials();
  const body = new URLSearchParams({
    code,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    redirect_uri: gmailRedirectUri(),
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as GoogleTokenResponse & { error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google OAuth token exchange failed: ${payload.error || response.status}`);
  }
  assertGmailScopeAllowlist(payload.scope);
  return payload;
}

export async function fetchGoogleIdentity(accessToken: string): Promise<{ id: string; email: string }> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  if (!response.ok || !payload.sub || !payload.email || payload.email_verified !== true) {
    throw new Error('Google did not return a verified Gmail identity');
  }
  return { id: payload.sub, email: payload.email.toLowerCase().trim() };
}

