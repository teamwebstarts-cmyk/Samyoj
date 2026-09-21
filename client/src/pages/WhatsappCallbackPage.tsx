import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Loader2, Smartphone } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { whatsappApi, type WhatsappPhoneOption, type WhatsappConnectResult } from '../services/api';
import { clearAuthBackup, restoreAuthBackupIfNeeded } from '../utils/authStorage';
import { getErrorMessage, logError } from '../utils/errors';
import {
  defaultPhoneSelectionKey,
  isWhatsAppOAuthCodeConsumed,
  phoneOptionKey,
} from '../utils/whatsappConnectSelect';
import { completeOAuthPopupFlow, isOAuthPopupContext } from '../utils/whatsappOAuth';

type PageStatus = 'loading' | 'select' | 'connecting' | 'success' | 'error';

const CODE_KEY = 'wa_oauth_code';
const STATE_KEY = 'wa_oauth_state';
const PHONES_KEY = 'wa_oauth_phones';
const PENDING_KEY = 'wa_oauth_pending';
const SELECTED_KEY = 'wa_oauth_selected';

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

function persistPhoneSelection(
  phones: WhatsappPhoneOption[],
  pendingToken: string,
  selectedKey: string
) {
  sessionStorage.setItem(PHONES_KEY, JSON.stringify(phones));
  sessionStorage.setItem(PENDING_KEY, pendingToken);
  if (selectedKey) sessionStorage.setItem(SELECTED_KEY, selectedKey);
}

function readStashedPhoneSelection(): {
  phones: WhatsappPhoneOption[];
  pendingToken: string;
  selectedKey: string;
} | null {
  const pendingToken = sessionStorage.getItem(PENDING_KEY);
  const rawPhones = sessionStorage.getItem(PHONES_KEY);
  if (!pendingToken || !rawPhones) return null;
  try {
    const phones = JSON.parse(rawPhones) as WhatsappPhoneOption[];
    if (!Array.isArray(phones) || phones.length === 0) return null;
    return {
      phones,
      pendingToken,
      selectedKey: sessionStorage.getItem(SELECTED_KEY) || '',
    };
  } catch {
    return null;
  }
}

function clearStashedOAuthParams() {
  sessionStorage.removeItem(CODE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(PHONES_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  sessionStorage.removeItem(SELECTED_KEY);
}

function finishOAuthFlow(payload: {
  status: 'success' | 'error' | 'cancel';
  phoneNumber?: string;
  message?: string;
}): boolean {
  return completeOAuthPopupFlow(payload);
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
      window.setTimeout(() => inflightExchanges.delete(code), 5_000);
    });

  inflightExchanges.set(code, promise);
  return promise;
}

export default function WhatsappCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { numbers, refreshNumbers } = useWhatsAppNumber();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [message, setMessage] = useState('Connecting your WhatsApp number...');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phones, setPhones] = useState<WhatsappPhoneOption[]>([]);
  const [pendingToken, setPendingToken] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const userPickedRef = useRef(false);
  const statusRef = useRef<PageStatus>(status);
  statusRef.current = status;

  const codeFromUrl = searchParams.get('code');
  const stateFromUrl = searchParams.get('state');
  const oauthError = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const connectedPhoneNumberIds = numbers.map((number) => number.phoneNumberId);

  const applySelection = (
    nextPhones: WhatsappPhoneOption[],
    nextPending: string,
    preferredKey: string
  ) => {
    const valid =
      preferredKey && nextPhones.some((phone) => phoneOptionKey(phone) === preferredKey)
        ? preferredKey
        : defaultPhoneSelectionKey(nextPhones, connectedPhoneNumberIds);
    setPhones(nextPhones);
    setPendingToken(nextPending);
    setSelectedKey(valid);
    persistPhoneSelection(nextPhones, nextPending, valid);
    setStatus('select');
    setMessage('Choose which WhatsApp number to connect.');
  };

  useEffect(() => {
    if (status !== 'select' || userPickedRef.current || phones.length === 0) return;
    const next = defaultPhoneSelectionKey(phones, connectedPhoneNumberIds);
    if (next && next !== selectedKey) {
      setSelectedKey(next);
      persistPhoneSelection(phones, pendingToken, next);
    }
    // Only shift the default when workspace numbers first arrive — not on every radio click.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connected ids are the trigger
  }, [connectedPhoneNumberIds.join('|')]);

  useEffect(() => {
    restoreAuthBackupIfNeeded();
    stashOAuthParams(codeFromUrl, stateFromUrl);

    if (oauthError) {
      clearStashedOAuthParams();
      clearAuthBackup();
      const msg = errorDescription || oauthError || 'Sign-in was cancelled.';
      logError(msg, {
        source: 'auth',
        action: 'WhatsApp OAuth cancelled/rejected by Meta',
        component: 'WhatsappCallbackPage',
      });
      if (finishOAuthFlow({ status: 'error', message: msg })) {
        setStatus('error');
        setMessage(msg);
        return;
      }
      setStatus('error');
      setMessage(msg);
      return;
    }

    if (authLoading) return;

    if (!user) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      console.info('[wa-oauth] Not signed in — redirecting to login with returnTo');
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
      return;
    }

    const phase = statusRef.current;
    if (phase === 'connecting' || phase === 'success') {
      return;
    }

    const stashedSelection = readStashedPhoneSelection();
    if (stashedSelection) {
      if (phase !== 'select') {
        applySelection(
          stashedSelection.phones,
          stashedSelection.pendingToken,
          stashedSelection.selectedKey
        );
      }
      return;
    }

    const stashed = readStashedOAuthParams();
    const code = codeFromUrl || stashed.code;
    const state = stateFromUrl || stashed.state;

    if (!code || !state) {
      if (!isOAuthPopupContext()) {
        navigate('/', { replace: true });
        return;
      }
      const msg = 'WhatsApp connection was cancelled. Your dashboard session is still active.';
      logError(msg, {
        source: 'auth',
        action: 'WhatsApp OAuth missing code/state',
        component: 'WhatsappCallbackPage',
      });
      if (finishOAuthFlow({ status: 'cancel', message: msg })) {
        setStatus('error');
        setMessage('Connection cancelled. Close this window to return to Samyoj.');
        return;
      }
      setStatus('error');
      setMessage('Something went wrong. Please try connecting again from Settings.');
      return;
    }

    let alive = true;

    exchangeCodeOnce(code, state)
      .then((result) => {
        if (!alive) return;

        console.info('[wa-oauth] Exchange succeeded', {
          requiresSelection: Boolean(result.requiresSelection),
          phoneNumber: result.phoneNumber,
        });

        if (result.requiresSelection && result.phones?.length && result.pendingToken) {
          sessionStorage.removeItem(CODE_KEY);
          sessionStorage.removeItem(STATE_KEY);
          applySelection(
            result.phones,
            result.pendingToken,
            defaultPhoneSelectionKey(result.phones, connectedPhoneNumberIds)
          );
          return;
        }

        clearStashedOAuthParams();
        clearAuthBackup();
        setPhoneNumber(result.phoneNumber || '');
        setStatus('success');
        setMessage('WhatsApp connected successfully!');
        void refreshNumbers();
        if (
          finishOAuthFlow({
            status: 'success',
            phoneNumber: result.phoneNumber || '',
            message: 'WhatsApp connected successfully!',
          })
        ) {
          setStatus('success');
          setMessage('WhatsApp connected. This window should close — if not, close it to return to Samyoj.');
          return;
        }
        navigate('/', { replace: true });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        logError(err, {
          source: 'auth',
          action: 'WhatsApp OAuth completeConnect failed',
          component: 'WhatsappCallbackPage',
        });
        const msg = getErrorMessage(err, 'Failed to complete WhatsApp connection.');
        const pending = readStashedPhoneSelection();

        if (isWhatsAppOAuthCodeConsumed(msg) && pending) {
          applySelection(pending.phones, pending.pendingToken, pending.selectedKey);
          return;
        }

        if (isWhatsAppOAuthCodeConsumed(msg)) {
          const reuseMsg =
            'This Facebook login was already used. Close this window and click Connect WhatsApp again, then pick the number you want.';
          setStatus('error');
          setMessage(reuseMsg);
          if (finishOAuthFlow({ status: 'error', message: reuseMsg })) return;
          return;
        }

        if (finishOAuthFlow({ status: 'error', message: msg })) {
          setStatus('error');
          setMessage(msg);
          return;
        }
        setStatus('error');
        setMessage(msg);
      });

    return () => {
      alive = false;
    };
  }, [
    authLoading,
    user?.id,
    navigate,
    refreshNumbers,
    codeFromUrl,
    stateFromUrl,
    oauthError,
    errorDescription,
  ]);

  const handleSelectConnect = async () => {
    const selected = phones.find((p) => phoneOptionKey(p) === selectedKey);
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
        finishOAuthFlow({
          status: 'success',
          phoneNumber: data.data.phoneNumber || selected.phoneNumber,
          message: 'WhatsApp connected successfully!',
        })
      ) {
        setStatus('success');
        setMessage('WhatsApp connected. This window should close — if not, close it to return to Samyoj.');
        return;
      }
      navigate('/', { replace: true });
    } catch (err: unknown) {
      logError(err, {
        source: 'auth',
        action: 'WhatsApp selectConnect failed',
        component: 'WhatsappCallbackPage',
      });
      const msg = getErrorMessage(err, 'Failed to connect selected number.');
      setStatus('select');
      setMessage(msg);
    }
  };

  const connectedIdSet = new Set(connectedPhoneNumberIds);

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
                const key = phoneOptionKey(phone);
                const isSelected = selectedKey === key;
                const alreadyHere = connectedIdSet.has(phone.phoneNumberId);
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
                      onChange={() => {
                        userPickedRef.current = true;
                        setSelectedKey(key);
                        persistPhoneSelection(phones, pendingToken, key);
                      }}
                      className="h-4 w-4 accent-whatsapp-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-neutral-900">+{phone.phoneNumber}</p>
                      {phone.verifiedName && (
                        <p className="truncate text-[12px] font-semibold text-neutral-600">
                          {phone.verifiedName}
                        </p>
                      )}
                      {alreadyHere && (
                        <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">
                          Already on this workspace
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
            <p className="mt-4 text-[11px] font-medium text-neutral-500">
              {isOAuthPopupContext()
                ? 'Close this window to return to Samyoj.'
                : 'Redirecting to Settings...'}
            </p>
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
