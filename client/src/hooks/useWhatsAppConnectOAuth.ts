import { useCallback, useEffect, useRef, useState } from 'react';
import { whatsappApi } from '../services/api';
import {
  getWhatsAppOAuthRedirectUri,
  handleWaOAuthPopupClosed,
  startWhatsAppOAuth,
} from '../utils/whatsappOAuth';
import {
  FACEBOOK_SDK_BLOCKED_MESSAGE,
  isFacebookSdkReady,
  launchEmbeddedSignup,
  preloadFacebookSdk,
  type EmbeddedSignupClientConfig,
  type EmbeddedSignupMode,
} from '../utils/embeddedSignup';
import { getErrorMessage, sanitizeUserErrorMessage } from '../utils/errors';
import { toastError } from '../utils/toast';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useWaOAuthPopupListener } from './useWaOAuthPopupListener';
import { closeWaNumberPick, openWaNumberPick, stashConnectNotice } from '../utils/waNumberPick';

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
  prefetch?: boolean;
}) {
  const { refreshNumbers } = useWhatsAppNumber();
  const [connecting, setConnecting] = useState(false);
  const [signupConfig, setSignupConfig] = useState<ConnectLaunchConfig | null>(null);
  const [connectUnavailableReason, setConnectUnavailableReason] = useState<string | null>(null);
  const connectMode = options?.connectMode || 'standard';
  const returnPath = options?.returnPath || '/';
  const prefetch = options?.prefetch !== false;
  const popupPollRef = useRef<number | null>(null);
  const connectingRef = useRef(false);
  const onConnectedRef = useRef(options?.onConnected);
  onConnectedRef.current = options?.onConnected;

  const clearPopupPoll = useCallback(() => {
    if (popupPollRef.current !== null) {
      window.clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
  }, []);

  const handleOAuthResult = useCallback(
    (data: { status: string; message?: string; phoneNumber?: string }) => {
      clearPopupPoll();
      connectingRef.current = false;
      setConnecting(false);
      if (data.status === 'success') {
        closeWaNumberPick();
        stashConnectNotice(data.message || 'WhatsApp connected.');
        window.location.reload();
        return;
      }
      if (data.status === 'cancel') {
        toastError(data.message || 'WhatsApp was not connected. You can try Connect again.');
        return;
      }
      toastError(sanitizeUserErrorMessage(data.message || 'WhatsApp connection failed'));
    },
    [clearPopupPoll]
  );

  useEffect(() => {
    if (!connecting) return;
    const tick = () => {
      void refreshNumbers({ silent: true });
    };
    const interval = window.setInterval(tick, 2_000);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [connecting, refreshNumbers]);

  useWaOAuthPopupListener(handleOAuthResult);

  useEffect(() => {
    if (!prefetch) return;
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
  }, [connectMode, prefetch]);

  useEffect(() => clearPopupPoll, [clearPopupPoll]);

  const runEmbeddedSignup = useCallback(
    async (cfg: EmbeddedSignupClientConfig) => {
      connectingRef.current = true;
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
        const { data } = await whatsappApi.completeConnect(
          result.code,
          cfg.state,
          result.wabaId,
          result.phoneNumberId
        );
        const payload = data.data;
        if (payload.requiresSelection && payload.phones?.length && payload.pendingToken) {
          const hinted = payload.phones.find((phone) => phone.phoneNumberId === result.phoneNumberId);
          const digits = new Set(payload.phones.map((phone) => phone.phoneNumber.replace(/\D/g, '')));
          if (hinted || payload.phones.length === 1 || digits.size === 1) {
            const chosen = hinted || payload.phones[0];
            const selected = await whatsappApi.selectConnect(
              payload.pendingToken,
              chosen.phoneNumberId,
              chosen.wabaId
            );
            handleOAuthResult({
              status: 'success',
              message: selected.data.data.notice,
              phoneNumber: selected.data.data.phoneNumber || chosen.phoneNumber,
            });
            return;
          }
          openWaNumberPick({
            phones: payload.phones,
            confirm: async (phone) => {
              const selected = await whatsappApi.selectConnect(
                payload.pendingToken!,
                phone.phoneNumberId,
                phone.wabaId
              );
              handleOAuthResult({
                status: 'success',
                message: selected.data.data.notice,
                phoneNumber: selected.data.data.phoneNumber || phone.phoneNumber,
              });
            },
          });
          connectingRef.current = false;
          setConnecting(false);
          return;
        }
        if (payload.requiresSelection) {
          toastError('WhatsApp did not return a number. Close the window and click Connect again.');
          connectingRef.current = false;
          setConnecting(false);
          return;
        }
        handleOAuthResult({
          status: 'success',
          message: payload.notice,
          phoneNumber: payload.phoneNumber,
        });
      } catch (err) {
        const message = getErrorMessage(err, 'WhatsApp connection failed');
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
    if (connectingRef.current) return;
    if (!signupConfig || signupConfig.connectMode !== connectMode) {
      toastError(
        connectUnavailableReason ||
          'WhatsApp connect is still preparing. Wait a second and click Connect again.',
      );
      return;
    }
    if (signupConfig.mode === 'OAUTH_DIALOG') {
      connectingRef.current = true;
      setConnecting(true);
      const { mode, popup } = startWhatsAppOAuth(signupConfig.url, { returnPath });
      if (mode === 'redirect') return;
      clearPopupPoll();
      popupPollRef.current = window.setInterval(() => {
        if (popup && popup.closed) {
          clearPopupPoll();
          handleWaOAuthPopupClosed(handleOAuthResult, {
            onClosedWithoutResult: () => {
              connectingRef.current = false;
              setConnecting(false);
              void refreshNumbers({ silent: true });
            },
          });
        }
      }, 500);
      return;
    }
    if (!isFacebookSdkReady()) {
      toastError(FACEBOOK_SDK_BLOCKED_MESSAGE);
      void preloadFacebookSdk(signupConfig.appId, signupConfig.apiVersion);
      return;
    }
    void runEmbeddedSignup(signupConfig);
  }, [
    signupConfig,
    connectMode,
    runEmbeddedSignup,
    connectUnavailableReason,
    returnPath,
    clearPopupPoll,
    handleOAuthResult,
    refreshNumbers,
  ]);

  return { connect, connecting, connectMode, connectUnavailableReason };
}
