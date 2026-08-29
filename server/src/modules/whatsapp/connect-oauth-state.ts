import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AppError } from '../../utils/response';

export interface WhatsappConnectOAuthState {
  type: 'whatsapp_connect_oauth';
  organizationId: string;
  userId: string;
  /** Exact redirect_uri used in the Meta OAuth dialog — must match token exchange. */
  redirectUri: string;
  /** standard Cloud API vs coexistence (Business app onboarding). */
  connectMode?: 'standard' | 'coexistence';
  /** Optional WABA id from WA_EMBEDDED_SIGNUP postMessage (coexistence). */
  wabaIdHint?: string;
}

const CALLBACK_PATHS = new Set([
  '/settings/whatsapp/callback',
  '/settings/whatsapp/callback/popup',
]);

function tryParseOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Allow redirect URIs that match our known frontend origins:
 * - CLIENT_URL / META_REDIRECT_URI from env
 * - Current META_WEBHOOK_URL origin (combined UI+API share proxy)
 * - localhost / Codespaces / ngrok — only when NODE_ENV is not production (mirrors cors.ts)
 */
export function isAllowedOAuthRedirectUri(redirectUri: string): boolean {
  const parsed = tryParseOrigin(redirectUri);
  if (!parsed) return false;
  if (!CALLBACK_PATHS.has(parsed.pathname.replace(/\/$/, ''))) return false;
  if (parsed.search || parsed.hash) return false;

  const allowedOrigins = new Set<string>();
  const client = tryParseOrigin(config.clientUrl);
  if (client) allowedOrigins.add(client.origin);
  const configured = tryParseOrigin(config.meta.redirectUri);
  if (configured) allowedOrigins.add(configured.origin);
  // Same public host used for inbound webhook + shared UI preview.
  const webhook = tryParseOrigin(config.meta.webhookUrl || '');
  if (webhook) allowedOrigins.add(webhook.origin);

  if (allowedOrigins.has(parsed.origin)) return true;

  // Dev-only wildcards — production must use CLIENT_URL / META_REDIRECT_URI / META_WEBHOOK_URL.
  if (config.nodeEnv !== 'production') {
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.endsWith('.app.github.dev') || host.endsWith('.githubpreview.dev')) return true;
    if (
      host.endsWith('.ngrok-free.dev') ||
      host.endsWith('.ngrok-free.app') ||
      host.endsWith('.ngrok.io')
    ) {
      return true;
    }
  }

  return false;
}

export function resolveOAuthRedirectUri(requested?: string | null): string {
  const candidate = (requested || '').trim() || config.meta.redirectUri;
  if (!isAllowedOAuthRedirectUri(candidate)) {
    throw new AppError(
      400,
      'Invalid OAuth redirect URI. Expected an allowed origin ending with /settings/whatsapp/callback.'
    );
  }
  return candidate;
}

export function signConnectOAuthState(
  payload: Omit<WhatsappConnectOAuthState, 'type'>
): string {
  return jwt.sign(
    {
      ...payload,
      type: 'whatsapp_connect_oauth' as const,
      connectMode: payload.connectMode || 'standard',
    },
    config.jwt.secret,
    { algorithm: 'HS256', expiresIn: '30m' }
  );
}

export function verifyConnectOAuthState(token: string): WhatsappConnectOAuthState {
  const decoded = jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
  }) as WhatsappConnectOAuthState;
  if (decoded.type !== 'whatsapp_connect_oauth') {
    throw new Error('Invalid OAuth state');
  }
  if (!decoded.redirectUri || !decoded.organizationId || !decoded.userId) {
    throw new Error('Invalid OAuth state payload');
  }
  return decoded;
}
