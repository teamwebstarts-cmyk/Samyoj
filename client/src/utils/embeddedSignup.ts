export type EmbeddedSignupMode = 'standard' | 'coexistence';

export interface EmbeddedSignupClientConfig {
  mode: 'ES_V4_SDK';
  appId: string;
  configId: string;
  apiVersion: string;
  state: string;
  redirectUri: string;
  connectMode: EmbeddedSignupMode;
}

export interface EmbeddedSignupResult {
  code: string;
  wabaId?: string;
  event?: string;
}

type FbLoginResponse = {
  authResponse?: { code?: string };
  status?: string;
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (response: FbLoginResponse) => void,
        opts: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const SDK_ID = 'facebook-jssdk';
let sdkLoadPromise: Promise<void> | null = null;

function loadFacebookSdk(appId: string, apiVersion: string): Promise<void> {
  if (window.FB) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SDK_ID);
    if (existing) {
      const wait = () => (window.FB ? resolve() : window.setTimeout(wait, 50));
      wait();
      return;
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        cookie: true,
        xfbml: false,
        version: apiVersion,
      });
      resolve();
    };

    const script = document.createElement('script');
    script.id = SDK_ID;
    script.async = true;
    script.defer = true;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onerror = () => reject(new Error('Failed to load Facebook SDK'));
    document.body.appendChild(script);
  });

  return sdkLoadPromise;
}

function listenForEmbeddedSignup(timeoutMs = 120_000): Promise<{ wabaId?: string; event?: string }> {
  return new Promise((resolve) => {
    const allowedOrigins = new Set([
      window.location.origin,
      'https://www.facebook.com',
      'https://web.facebook.com',
    ]);

    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve({});
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if ((data as { type?: string }).type !== 'WA_EMBEDDED_SIGNUP') return;

      const payload = data as {
        type: string;
        event?: string;
        data?: { waba_id?: string; phone_number_id?: string };
      };

      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      resolve({
        wabaId: payload.data?.waba_id,
        event: payload.event,
      });
    };

    window.addEventListener('message', onMessage);
  });
}

function buildLoginExtras(connectMode: EmbeddedSignupMode): Record<string, unknown> {
  if (connectMode === 'coexistence') {
    return {
      setup: {},
      featureType: 'whatsapp_business_app_onboarding',
      sessionInfoVersion: '3',
    };
  }
  return { setup: {}, sessionInfoVersion: '3' };
}

/** Launch ES v4 via FB.login + listen for WA_EMBEDDED_SIGNUP postMessage (dual channel with code). */
export async function launchEmbeddedSignup(
  config: EmbeddedSignupClientConfig
): Promise<EmbeddedSignupResult> {
  await loadFacebookSdk(config.appId, config.apiVersion);

  const postMessagePromise = listenForEmbeddedSignup();

  const code = await new Promise<string>((resolve, reject) => {
    window.FB?.login(
      (response) => {
        if (response.status === 'connected' && response.authResponse?.code) {
          resolve(response.authResponse.code);
          return;
        }
        if (response.status === 'not_authorized' || response.status === 'unknown') {
          reject(new Error('WhatsApp connection was cancelled.'));
          return;
        }
        reject(new Error('Facebook login did not return an authorization code.'));
      },
      {
        config_id: config.configId,
        response_type: 'code',
        override_default_response_type: true,
        redirect_uri: config.redirectUri,
        state: config.state,
        extras: buildLoginExtras(config.connectMode),
      }
    );
  });

  const postMessage = await postMessagePromise;

  return {
    code,
    wabaId: postMessage.wabaId,
    event: postMessage.event,
  };
}
