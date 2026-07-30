import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AppError } from '../../utils/response';

export interface WhatsappConnectOAuthState {
  type: 'whatsapp_connect_oauth';
  organizationId: string;
  userId: string;
  /** Exact redirect_uri used in the Meta OAuth dialog — must match token exchange. */
  redirectUri: string;
}

const CALLBACK_PATH = '/settings/whatsapp/callback';

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
 * - localhost / 127.0.0.1 (local + Codespace port-forward)
 * - *.app.github.dev / *.githubpreview.dev (Codespaces)
 */
export function isAllowedOAuthRedirectUri(redirectUri: string): boolean {
  const parsed = tryParseOrigin(redirectUri);
  if (!parsed) return false;
  if (parsed.pathname.replace(/\/$/, '') !== CALLBACK_PATH) return false;
  if (parsed.search || parsed.hash) return false;

  const allowedOrigins = new Set<string>();
  const client = tryParseOrigin(config.clientUrl);
  if (client) allowedOrigins.add(client.origin);
  const configured = tryParseOrigin(config.meta.redirectUri);
  if (configured) allowedOrigins.add(configured.origin);

  if (allowedOrigins.has(parsed.origin)) return true;

  const host = parsed.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.endsWith('.app.github.dev') || host.endsWith('.githubpreview.dev')) return true;

  return false;
}

export function resolveOAuthRedirectUri(requested?: string | null): string {
  const candidate = (requested || '').trim() || config.meta.redirectUri;
  if (!isAllowedOAuthRedirectUri(candidate)) {
    throw new AppError(
      400,
      `Invalid OAuth redirect URI. Expected an allowed origin ending with ${CALLBACK_PATH}.`
    );
  }
  return candidate;
}

export function signConnectOAuthState(
  payload: Omit<WhatsappConnectOAuthState, 'type'>
): string {
  return jwt.sign(
    { ...payload, type: 'whatsapp_connect_oauth' as const },
    config.jwt.secret,
    { expiresIn: '30m' }
  );
}

export function verifyConnectOAuthState(token: string): WhatsappConnectOAuthState {
  const decoded = jwt.verify(token, config.jwt.secret) as WhatsappConnectOAuthState;
  if (decoded.type !== 'whatsapp_connect_oauth') {
    throw new Error('Invalid OAuth state');
  }
  if (!decoded.redirectUri || !decoded.organizationId || !decoded.userId) {
    throw new Error('Invalid OAuth state payload');
  }
  return decoded;
}
