import { config } from '../../config';

export type LegacyOAuthConnectConfig = {
  mode: 'OAUTH_DIALOG';
  url: string;
  state: string;
  redirectUri: string;
  connectMode: 'standard' | 'coexistence';
};

/**
 * Pre-ES v4 Connect: Facebook Login with WhatsApp scopes, no config_id.
 * Lets a developer who already admins a WABA grant the app access without
 * Tech Provider "onboard customers". Not the customer-onboarding product.
 */
export function buildLegacyOAuthConnectUrl(opts: {
  appId: string;
  state: string;
  redirectUri: string;
  connectMode: 'standard' | 'coexistence';
}): LegacyOAuthConnectConfig {
  const version = (config.meta.apiVersion || 'v21.0').replace(/^\//, '');
  const params = new URLSearchParams({
    client_id: opts.appId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    response_type: 'code',
    scope: 'whatsapp_business_management,whatsapp_business_messaging',
  });
  return {
    mode: 'OAUTH_DIALOG',
    url: `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`,
    state: opts.state,
    redirectUri: opts.redirectUri,
    connectMode: opts.connectMode,
  };
}
