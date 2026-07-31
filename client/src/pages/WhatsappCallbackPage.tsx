import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2, Smartphone } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { whatsappApi, type WhatsappPhoneOption, type WhatsappConnectResult } from '../services/api';
import { clearAuthBackup, restoreAuthBackupIfNeeded } from '../utils/authStorage';
import { logError, normalizeError } from '../utils/errors';
import { notifyOpenerAndClose } from '../utils/whatsappOAuth';

type PageStatus = 'loading' | 'select' | 'connecting' | 'success' | 'error';

const CODE_KEY = 'wa_oauth_code';
const STATE_KEY = 'wa_oauth_state';

/** Share one in-flight exchange across React Strict Mode double-mount. */
const inflightExchanges = new Map<string, Promise<WhatsappConnectResult>>();

function stashOAuthParams(code: string | null, state: string | null) {
  if (code) sessionStorage.setItem(CODE_KEY, code);
  if (state) sessionStorage.setItem(STATE_KEY, state);
}

function readStashedOAuthParams() {
  return {
    code: sessionStorage.getItem(CODE_KEY),
    state: sessionStorage.getItem(STATE_KEY),
  };
}

function clearStashedOAuthParams() {
  sessionStorage.removeItem(CODE_KEY);
  sessionStorage.removeItem(STATE_KEY);
}

function finishInPopup(payload: {
  status: 'success' | 'error' | 'cancel';
  phoneNumber?: string;
  message?: string;
}) {
  if (window.opener && !window.opener.closed) {
    notifyOpenerAndClose(payload);
    return true;
  }
  return false;
}

function exchangeCodeOnce(code: string, state: string): Promise<WhatsappConnectResult> {
  const existing = inflightExchanges.get(code);
  if (existing) {
    console.info('[wa-oauth] Reusing in-flight code exchange (Strict Mode remount)');
    return existing;
  }

  console.info('[wa-oauth] Starting code exchange', {
    codePrefix: `${code.slice(0, 8)}…`,
    hasState: Boolean(state),
  });

  const promise = whatsappApi
    .completeConnect(code, state)
    .then(({ data }) => data.data)
    .finally(() => {
      // Keep briefly so a remount within the same tick can still attach.
      window.setTimeout(() => inflightExchanges.delete(code), 5_000);
    });

  inflightExchanges.set(code, promise);
  return promise;
}

function isCodeAlreadyUsed(message: string) {
  return /authorization code has been used|already completed/i.test(message);
}

export default function WhatsappCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refreshNumbers } = useWhatsAppNumber();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [message, setMessage] = useState('Connecting your WhatsApp number...');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phones, setPhones] = useState<WhatsappPhoneOption[]>([]);
  const [pendingToken, setPendingToken] = useState('');
  const [selectedKey, setSelectedKey] = useState('');

  useEffect(() => {
    restoreAuthBackupIfNeeded();

    const codeFromUrl = searchParams.get('code');
    const stateFromUrl = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    stashOAuthParams(codeFromUrl, stateFromUrl);

    if (error) {
      clearStashedOAuthParams();
      clearAuthBackup();
      const msg = errorDescription || error || 'Sign-in was cancelled.';
      logError(msg, {
        source: 'auth',
        action: 'WhatsApp OAuth cancelled/rejected by Meta',
        component: 'WhatsappCallbackPage',
      });
      if (finishInPopup({ status: 'error', message: msg })) return;
      setStatus('error');
      setMessage(msg);
      return;
    }

    if (authLoading) return;

    if (!user) {
      const returnTo = `/settings/whatsapp/callback${window.location.search}`;
      console.info('[wa-oauth] Not signed in — redirecting to login with returnTo');
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }

    const stashed = readStashedOAuthParams();
    const code = codeFromUrl || stashed.code;
    const state = stateFromUrl || stashed.state;

    if (!code || !state) {
      const msg = 'WhatsApp connection was cancelled. Your dashboard session is still active.';
      logError(msg, {
        source: 'auth',
        action: 'WhatsApp OAuth missing code/state',
        component: 'WhatsappCallbackPage',
      });
      if (finishInPopup({ status: 'cancel', message: msg })) return;
      setStatus('error');
      setMessage('Something went wrong. Please try connecting again from Settings.');
      return;
    }

    let alive = true;

    exchangeCodeOnce(code, state)
      .then((result) => {
        if (!alive) return;
        clearStashedOAuthParams();
        clearAuthBackup();

        console.info('[wa-oauth] Exchange succeeded', {
          requiresSelection: Boolean(result.requiresSelection),
          phoneNumber: result.phoneNumber,
        });

        if (result.requiresSelection && result.phones?.length && result.pendingToken) {
          setPhones(result.phones);
          setPendingToken(result.pendingToken);
          setSelectedKey(`${result.phones[0].wabaId}:${result.phones[0].phoneNumberId}`);
          setStatus('select');
          setMessage('Choose which WhatsApp number to connect.');
          return;
        }

        setPhoneNumber(result.phoneNumber || '');
        setStatus('success');
        setMessage('WhatsApp connected successfully!');
        void refreshNumbers();
        if (
          finishInPopup({
            status: 'success',
            phoneNumber: result.phoneNumber || '',
            message: 'WhatsApp connected successfully!',
          })
        ) {
          return;
        }
        window.setTimeout(() => navigate('/settings?tab=whatsapp', { replace: true }), 1500);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const normalized = logError(err, {
          source: 'auth',
          action: 'WhatsApp OAuth completeConnect failed',
          component: 'WhatsappCallbackPage',
        });
        const msg = normalized.message || 'Failed to complete WhatsApp connection.';

        // First mount may have already connected; treat duplicate code as success.
        if (isCodeAlreadyUsed(msg)) {
          console.info('[wa-oauth] Code already used — treating as success if connected');
          clearStashedOAuthParams();
          clearAuthBackup();
          void refreshNumbers();
          setStatus('success');
          setMessage('WhatsApp connected successfully!');
          if (finishInPopup({ status: 'success', message: 'WhatsApp connected successfully!' })) {
            return;
          }
          window.setTimeout(() => navigate('/settings?tab=whatsapp', { replace: true }), 1500);
          return;
        }

        if (finishInPopup({ status: 'error', message: msg })) return;
        setStatus('error');
        setMessage(msg);
      });

    return () => {
      alive = false;
    };
  }, [searchParams, navigate, user, authLoading, refreshNumbers]);

  const handleSelectConnect = async () => {
    const selected = phones.find((p) => `${p.wabaId}:${p.phoneNumberId}` === selectedKey);
    if (!selected || !pendingToken) return;

    setStatus('connecting');
    setMessage(`Connecting +${selected.phoneNumber}...`);

    try {
      const { data } = await whatsappApi.selectConnect(
        pendingToken,
        selected.phoneNumberId,
        selected.wabaId
      );
      clearStashedOAuthParams();
      clearAuthBackup();
      setPhoneNumber(data.data.phoneNumber || selected.phoneNumber);
      setStatus('success');
      setMessage('WhatsApp connected successfully!');
      void refreshNumbers();
      if (
        finishInPopup({
          status: 'success',
          phoneNumber: data.data.phoneNumber || selected.phoneNumber,
          message: 'WhatsApp connected successfully!',
        })
      ) {
        return;
      }
      setTimeout(() => navigate('/settings?tab=whatsapp', { replace: true }), 2500);
    } catch (err: unknown) {
      const normalized = logError(err, {
        source: 'auth',
        action: 'WhatsApp selectConnect failed',
        component: 'WhatsappCallbackPage',
      });
      const msg = normalizeError(err).message || 'Failed to connect selected number.';
      if (finishInPopup({ status: 'error', message: normalized.message || msg })) return;
      setStatus('error');
      setMessage(normalized.message || msg);
    }
  };

  return (
    <div className="platform-gradient flex min-h-screen items-center justify-center p-4">
      <div className="dashboard-card w-full max-w-md p-8 text-center animate-fade-up">
        {(status === 'loading' || status === 'connecting') && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-whatsapp-600" />
            <h1 className="mt-4 text-xl font-extrabold text-neutral-900">Connecting WhatsApp</h1>
            <p className="mt-2 text-[13px] font-medium text-neutral-600">{message}</p>
          </>
        )}

        {status === 'select' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-600 to-whatsapp-700 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
              <Smartphone className="h-7 w-7" strokeWidth={2.25} />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-neutral-900">Select a number</h1>
            <p className="mt-2 text-[13px] font-medium text-neutral-600">{message}</p>
            <div className="mt-5 space-y-2 text-left">
              {phones.map((phone) => {
                const key = `${phone.wabaId}:${phone.phoneNumberId}`;
                const isSelected = selectedKey === key;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                      isSelected
                        ? 'border-whatsapp-400 bg-emerald-50/90 ring-1 ring-whatsapp-200'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="whatsapp-phone"
                      value={key}
                      checked={isSelected}
                      onChange={() => setSelectedKey(key)}
                      className="h-4 w-4 accent-whatsapp-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-neutral-900">+{phone.phoneNumber}</p>
                      {phone.verifiedName && (
                        <p className="truncate text-[12px] font-semibold text-neutral-600">
                          {phone.verifiedName}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            <AppButton className="mt-6 w-full" onClick={handleSelectConnect} disabled={!selectedKey}>
              Connect selected number
            </AppButton>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-whatsapp-600">
              <CheckCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-emerald-800">{message}</h1>
            {phoneNumber && (
              <p className="mt-2 text-[13px] font-medium text-neutral-600">Number: +{phoneNumber}</p>
            )}
            <p className="mt-4 text-[11px] font-medium text-neutral-500">Redirecting to Settings...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold text-red-800">Connection failed</h1>
            <p className="mt-2 text-[13px] font-medium text-neutral-600">{message}</p>
            <AppButton className="mt-6" onClick={() => navigate('/settings?tab=whatsapp', { replace: true })}>
              Back to Settings
            </AppButton>
          </>
        )}
      </div>
    </div>
  );
}
