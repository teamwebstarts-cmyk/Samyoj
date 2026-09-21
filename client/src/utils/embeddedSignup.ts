import { facebookLoginHttpsBlockedReason, canUseFacebookJsSdk } from './facebookLoginHttps';

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
  phoneNumberId?: string;
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
const SDK_OFFICIAL = 'https://connect.facebook.net/en_US/sdk.js';
/** Same-origin Vite proxy — Brave/ad-block often block connect.facebook.net. */
const SDK_PROXIED = '/__fb-sdk/en_US/sdk.js';
const SDK_LOAD_MS = 8_000;
const POSTMESSAGE_AFTER_CODE_MS = 3_000;

export const FACEBOOK_SDK_BLOCKED_MESSAGE =
  'Facebook was blocked in this browser (often Brave Shields). Allow Facebook on this site or use Chrome, then click Connect WhatsApp again.';

let sdkLoadPromise: Promise<void> | null = null;

function initFacebookSdk(appId: string, apiVersion: string): void {
  window.FB?.init({
    appId,
    cookie: true,
    xfbml: false,
    version: apiVersion,
  });
}

function loadSdkFromSrc(src: string, appId: string, apiVersion: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) {
        document.getElementById(SDK_ID)?.remove();
        reject(err);
        return;
      }
      resolve();
    };

    window.fbAsyncInit = () => {
      initFacebookSdk(appId, apiVersion);
      finish();
    };

    const script = document.createElement('script');
    script.id = SDK_ID;
    script.async = true;
    script.src = src;
    script.onload = () => {
      if (!window.FB) return;
      initFacebookSdk(appId, apiVersion);
      finish();
    };
    script.onerror = () => finish(new Error('Failed to load Facebook SDK'));
    window.setTimeout(() => {
      if (window.FB) {
        initFacebookSdk(appId, apiVersion);
        finish();
        return;
      }
      finish(new Error('Failed to load Facebook SDK'));
    }, SDK_LOAD_MS);
    document.body.appendChild(script);
  });
}

function srcOrderForPage(): string[] {
  // Vite-only proxy. Production has no /__fb-sdk (404) and CSP must allow the official SDK.
  if (import.meta.env.DEV) return [SDK_PROXIED, SDK_OFFICIAL];
  return [SDK_OFFICIAL];
}

function loadFacebookSdk(appId: string, apiVersion: string): Promise<void> {
  if (window.FB) {
    initFacebookSdk(appId, apiVersion);
    return Promise.resolve();
  }
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = (async () => {
    const sources = srcOrderForPage();
    let lastErr: Error | null = null;
    for (const src of sources) {
      try {
        await loadSdkFromSrc(src, appId, apiVersion);
        return;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error('Failed to load Facebook SDK');
      }
    }
    sdkLoadPromise = null;
    throw lastErr || new Error(FACEBOOK_SDK_BLOCKED_MESSAGE);
  })();

  return sdkLoadPromise;
}

export function preloadFacebookSdk(appId: string, apiVersion: string): Promise<void> {
  return loadFacebookSdk(appId, apiVersion);
}

export function isFacebookSdkReady(): boolean {
  return typeof window !== 'undefined' && typeof window.FB?.login === 'function';
}

const EMBEDDED_FINISH_EVENTS = new Set([
  'FINISH',
  'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
  'FINISH_ONLY_WABA',
]);

function listenForEmbeddedSignup(timeoutMs = 120_000): Promise<{
  wabaId?: string;
  phoneNumberId?: string;
  event?: string;
}> {
  return new Promise((resolve) => {
    const allowedOrigins = new Set([
      window.location.origin,
      'https://www.facebook.com',
      'https://web.facebook.com',
      'https://business.facebook.com',
      'https://m.facebook.com',
    ]);

    const latest: { wabaId?: string; phoneNumberId?: string; event?: string } = {};
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(latest);
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
      if (payload.data?.waba_id) latest.wabaId = payload.data.waba_id;
      if (payload.data?.phone_number_id) latest.phoneNumberId = payload.data.phone_number_id;
      if (payload.event) latest.event = payload.event;

      const finished =
        (payload.event && EMBEDDED_FINISH_EVENTS.has(payload.event)) ||
        /cancel/i.test(payload.event || '');
      if (!finished) return;

      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
      resolve(latest);
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

function runFbLogin(config: EmbeddedSignupClientConfig): Promise<EmbeddedSignupResult> {
  const postMessagePromise = listenForEmbeddedSignup();

  const codePromise = new Promise<string>((resolve, reject) => {
    if (!window.FB?.login) {
      reject(new Error(FACEBOOK_SDK_BLOCKED_MESSAGE));
      return;
    }

    // FB.login's callback fires when the customer finishes or cancels.
    // Embedded Signup often takes many minutes; a short timer rejects a live popup.
    window.FB.login(
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
        state: config.state,
        extras: buildLoginExtras(config.connectMode),
      }
    );
  });

  return codePromise.then(async (code) => {
    const postMessage = await Promise.race([
      postMessagePromise,
      new Promise<{ wabaId?: string; phoneNumberId?: string; event?: string }>((resolve) => {
        window.setTimeout(() => resolve({}), POSTMESSAGE_AFTER_CODE_MS);
      }),
    ]);
    return {
      code,
      wabaId: postMessage.wabaId,
      phoneNumberId: postMessage.phoneNumberId,
      event: postMessage.event,
    };
  });
}

/**
 * ES v4 must call FB.login in the same user-gesture turn as the click.
 * Do not await network/SDK load here — preload those before Connect is clicked.
 */
export function launchEmbeddedSignup(
  config: EmbeddedSignupClientConfig
): Promise<EmbeddedSignupResult> {
  const httpsBlock = facebookLoginHttpsBlockedReason(
    window.location,
    typeof import.meta.env.VITE_CODESPACE_HTTPS_ORIGIN === 'string'
      ? import.meta.env.VITE_CODESPACE_HTTPS_ORIGIN
      : '',
  );
  if (httpsBlock) {
    return Promise.reject(new Error(httpsBlock));
  }
  if (!canUseFacebookJsSdk(window.location)) {
    return Promise.reject(
      new Error(
        'Facebook will not finish WhatsApp Connect on http://. Open the HTTPS preview URL, then click Connect WhatsApp again.',
      ),
    );
  }
  if (!isFacebookSdkReady()) {
    return Promise.reject(new Error(FACEBOOK_SDK_BLOCKED_MESSAGE));
  }
  return runFbLogin(config);
}
