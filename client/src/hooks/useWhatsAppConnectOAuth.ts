import { useCallback, useEffect, useRef, useState } from 'react';
import { whatsappApi } from '../services/api';
import { getWhatsAppOAuthRedirectUri, startWhatsAppOAuth } from '../utils/whatsappOAuth';
import {
  FACEBOOK_SDK_BLOCKED_MESSAGE,
  isFacebookSdkReady,
  launchEmbeddedSignup,
  preloadFacebookSdk,
  type EmbeddedSignupClientConfig,
  type EmbeddedSignupMode,
} from '../utils/embeddedSignup';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useWaOAuthPopupListener } from './useWaOAuthPopupListener';

const COEXISTENCE_FINISH_EVENT = 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING';

type LegacyOAuthConnectConfig = {
  mode: 'OAUTH_DIALOG';
  url: string;
  state: string;
  redirectUri: string;
  connectMode: EmbeddedSignupMode;
};

type ConnectLaunchConfig = EmbeddedSignupClientConfig | LegacyOAuthConnectConfig;

function pickConnectLaunch(payload: unknown): ConnectLaunchConfig | null {
  if (!payload || typeof payload !== 'object') return null;
  const row = payload as Record<string, unknown>;
  const inner = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : row;
  const connectMode: EmbeddedSignupMode =
    inner.connectMode === 'coexistence' ? 'coexistence' : 'standard';

  if (inner.mode === 'OAUTH_DIALOG') {
    if (typeof inner.url !== 'string' || typeof inner.state !== 'string') return null;
    if (typeof inner.redirectUri !== 'string') return null;
    return {
      mode: 'OAUTH_DIALOG',
      url: inner.url,
      state: inner.state,
      redirectUri: inner.redirectUri,
      connectMode,
    };
  }

  if (inner.mode !== 'ES_V4_SDK') return null;
  if (typeof inner.appId !== 'string' || typeof inner.configId !== 'string') return null;
  if (typeof inner.state !== 'string' || typeof inner.redirectUri !== 'string') return null;
  return {
    mode: 'ES_V4_SDK',
    appId: inner.appId,
    configId: inner.configId,
    apiVersion: typeof inner.apiVersion === 'string' ? inner.apiVersion : 'v21.0',
    state: inner.state,
    redirectUri: inner.redirectUri,
    connectMode,
  };
}

/** Shared Connect WhatsApp (ES v4 or legacy OAuth) for Dashboard / Settings CTAs. */
export function useWhatsAppConnectOAuth(options?: {
  returnPath?: string;
  onConnected?: () => void;
  connectMode?: EmbeddedSignupMode;
}) {
  const { refreshNumbers } = useWhatsAppNumber();
  const [connecting, setConnecting] = useState(false);
  const [signupConfig, setSignupConfig] = useState<ConnectLaunchConfig | null>(null);
  const [connectUnavailableReason, setConnectUnavailableReason] = useState<string | null>(null);
  const connectMode = options?.connectMode || 'standard';
  const onConnectedRef = useRef(options?.onConnected);
  onConnectedRef.current = options?.onConnected;

  const handleOAuthResult = useCallback(
    (data: { status: string; message?: string; phoneNumber?: string }) => {
      setConnecting(false);
      if (data.status === 'success') {
        toastSuccess(
          data.message ||
            'WhatsApp connected. Add a payment method in Meta Business Suite so templates can send.'
        );
        void refreshNumbers({ silent: true }).then(() => onConnectedRef.current?.());
        return;
      }
      if (data.status === 'cancel') {
        toastError(data.message || 'WhatsApp was not connected. You can try Connect again.');
        return;
      }
      toastError(data.message || 'WhatsApp connection failed');
    },
    [refreshNumbers]
  );

  useWaOAuthPopupListener(handleOAuthResult);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const redirectUri = getWhatsAppOAuthRedirectUri();
        const { data } = await whatsappApi.connectUrl(redirectUri, connectMode);
        if (cancelled) return;
        const cfg = pickConnectLaunch(data);
        if (!cfg) {
          setConnectUnavailableReason(
            'Could not start WhatsApp connection. Please try again.',
          );
          return;
        }
        setSignupConfig(cfg);
        setConnectUnavailableReason(null);
        if (cfg.mode === 'ES_V4_SDK') {
          await preloadFacebookSdk(cfg.appId, cfg.apiVersion);
        }
      } catch (err) {
        if (cancelled) return;
        setConnectUnavailableReason(
          getErrorMessage(err, 'Could not start WhatsApp connection. Please try again.'),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectMode]);

  const runEmbeddedSignup = useCallback(
    async (cfg: EmbeddedSignupClientConfig) => {
      setConnecting(true);
      try {
        const result = await launchEmbeddedSignup(cfg);
        if (connectMode === 'coexistence' && result.event) {
          if (/cancel/i.test(result.event)) {
            handleOAuthResult({
              status: 'cancel',
              message: 'WhatsApp Business app onboarding was cancelled.',
            });
            return;
          }
          if (
            result.event !== COEXISTENCE_FINISH_EVENT &&
            result.event !== 'FINISH' &&
            result.event !== 'FINISH_ONLY_WABA'
          ) {
            console.warn('[wa-connect] Unexpected coexistence ES event:', result.event);
          }
        }
        const { data } = await whatsappApi.completeConnect(result.code, cfg.state, result.wabaId);
        const payload = data.data;
        if (payload.requiresSelection && payload.phones?.length && payload.pendingToken) {
          sessionStorage.setItem('wa_oauth_code', result.code);
          sessionStorage.setItem('wa_oauth_state', cfg.state);
          sessionStorage.setItem('wa_oauth_phones', JSON.stringify(payload.phones));
          sessionStorage.setItem('wa_oauth_pending', payload.pendingToken);
          window.location.assign('/settings/whatsapp/callback');
          return;
        }
        if (payload.requiresSelection) {
          toastSuccess('Select your WhatsApp number to finish connecting.');
          setConnecting(false);
          return;
        }
        handleOAuthResult({ status: 'success', phoneNumber: payload.phoneNumber });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'WhatsApp connection failed';
        if (/cancel/i.test(message)) {
          handleOAuthResult({ status: 'cancel', message });
        } else {
          handleOAuthResult({ status: 'error', message });
        }
      }
    },
    [handleOAuthResult, connectMode]
  );

  const connect = useCallback(() => {
    if (!signupConfig || signupConfig.connectMode !== connectMode) {
      toastError(
        connectUnavailableReason ||
          'WhatsApp connect is still preparing. Wait a second and click Connect again.',
      );
      return;
    }
    if (signupConfig.mode === 'OAUTH_DIALOG') {
      setConnecting(true);
      startWhatsAppOAuth(signupConfig.url);
      return;
    }
    if (!isFacebookSdkReady()) {
      toastError(FACEBOOK_SDK_BLOCKED_MESSAGE);
      void preloadFacebookSdk(signupConfig.appId, signupConfig.apiVersion);
      return;
    }
    void runEmbeddedSignup(signupConfig);
  }, [signupConfig, connectMode, runEmbeddedSignup, connectUnavailableReason]);

  return { connect, connecting, connectMode, connectUnavailableReason };
}
