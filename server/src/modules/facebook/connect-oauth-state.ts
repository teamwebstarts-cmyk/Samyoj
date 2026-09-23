import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AppError } from '../../utils/response';
import { isAllowedOAuthRedirectUri } from '../whatsapp/connect-oauth-state';

export interface FacebookPageConnectOAuthState {
  type: 'facebook_page_connect_oauth';
  organizationId: string;
  userId: string;
  redirectUri: string;
  /** FB.login JS SDK codes are not bound to redirect_uri. */
  codeVia?: 'js_sdk' | 'redirect';
}

const FACEBOOK_CALLBACK_PATHS = new Set([
  '/settings/facebook/callback',
  '/settings/facebook/callback/popup',
]);

function tryParse(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export function resolveFacebookOAuthRedirectUri(requested?: string | null): string {
  const candidate = (requested || '').trim() || `${config.clientUrl.replace(/\/$/, '')}/settings/facebook/callback`;
  const parsed = tryParse(candidate);
  if (!parsed || !FACEBOOK_CALLBACK_PATHS.has(parsed.pathname.replace(/\/$/, ''))) {
    throw new AppError(
      400,
      'Invalid OAuth redirect URI. Expected an allowed origin ending with /settings/facebook/callback.'
    );
  }
  if (!isAllowedOAuthRedirectUri(candidate)) {
    throw new AppError(
      400,
      'Invalid OAuth redirect URI. Expected an allowed origin ending with /settings/facebook/callback.'
    );
  }
  return candidate;
}

export function signFacebookPageOAuthState(
  payload: Omit<FacebookPageConnectOAuthState, 'type'>
): string {
  return jwt.sign(
    {
      ...payload,
      type: 'facebook_page_connect_oauth' as const,
    },
    config.jwt.secret,
    { algorithm: 'HS256', expiresIn: '30m' }
  );
}

export function verifyFacebookPageOAuthState(token: string): FacebookPageConnectOAuthState {
  const decoded = jwt.verify(token, config.jwt.secret, {
    algorithms: ['HS256'],
  }) as FacebookPageConnectOAuthState;
  if (decoded.type !== 'facebook_page_connect_oauth') {
    throw new Error('Invalid OAuth state');
  }
  if (!decoded.redirectUri || !decoded.organizationId || !decoded.userId) {
    throw new Error('Invalid OAuth state payload');
  }
  return decoded;
}

/** Scopes used for Page pick + leadgen + Messenger. No ads editor. */
export const FACEBOOK_PAGE_LEADGEN_SCOPES = [
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_messaging',
  'leads_retrieval',
].join(',');

export function buildFacebookPageOAuthUrl(opts: {
  appId: string;
  state: string;
  redirectUri: string;
}): { mode: 'OAUTH_DIALOG'; url: string; state: string; redirectUri: string } {
  const version = (config.meta.apiVersion || 'v21.0').replace(/^\//, '');
  const params = new URLSearchParams({
    client_id: opts.appId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    response_type: 'code',
    scope: FACEBOOK_PAGE_LEADGEN_SCOPES,
  });
  return {
    mode: 'OAUTH_DIALOG',
    url: `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`,
    state: opts.state,
    redirectUri: opts.redirectUri,
  };
}
