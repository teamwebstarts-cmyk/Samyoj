import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Facebook, Loader2 } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import { useAuth } from '../contexts/AuthContext';
import { facebookApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';

type PageStatus = 'loading' | 'select' | 'success' | 'error';

const CODE_KEY = 'fb_page_oauth_code';
const STATE_KEY = 'fb_page_oauth_state';

type PageOption = { id: string; name: string };

const inflight = new Map<string, Promise<Record<string, unknown>>>();

function exchangeOnce(code: string, state: string) {
  const existing = inflight.get(code);
  if (existing) return existing;
  const promise = facebookApi
    .completeConnect(code, state)
    .then(({ data }) => data.data as Record<string, unknown>)
    .finally(() => {
      window.setTimeout(() => inflight.delete(code), 5_000);
    });
  inflight.set(code, promise);
  return promise;
}

export default function FacebookCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<PageStatus>('loading');
  const [message, setMessage] = useState('Connecting your Facebook Page...');
  const [pages, setPages] = useState<PageOption[]>([]);
  const [pendingToken, setPendingToken] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selecting, setSelecting] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStatus('error');
      setMessage('Sign in, then connect Facebook Page again from Settings.');
      return;
    }
    if (ran.current) return;
    ran.current = true;

    const code = searchParams.get('code') || sessionStorage.getItem(CODE_KEY);
    const state = searchParams.get('state') || sessionStorage.getItem(STATE_KEY);
    if (searchParams.get('code')) sessionStorage.setItem(CODE_KEY, searchParams.get('code')!);
    if (searchParams.get('state')) sessionStorage.setItem(STATE_KEY, searchParams.get('state')!);

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing Facebook authorization. Start again from Settings → Facebook Page.');
      return;
    }

    void exchangeOnce(code, state)
      .then(async (result) => {
        if (result.requiresSelection && Array.isArray(result.pages) && typeof result.pendingToken === 'string') {
          setPages(result.pages as PageOption[]);
          setPendingToken(result.pendingToken);
          setSelectedId((result.pages as PageOption[])[0]?.id || '');
          setStatus('select');
          setMessage('Choose which Page to connect.');
          return;
        }
        sessionStorage.removeItem(CODE_KEY);
        sessionStorage.removeItem(STATE_KEY);
        setStatus('success');
        setMessage(
          typeof result.pageName === 'string'
            ? `Connected ${result.pageName}`
            : 'Facebook Page connected'
        );
        window.setTimeout(() => navigate('/settings?tab=facebook', { replace: true }), 1200);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(getErrorMessage(err) || 'Could not connect Facebook Page');
      });
  }, [authLoading, user, searchParams, navigate]);

  const confirmSelect = async () => {
    if (!pendingToken || !selectedId) return;
    setSelecting(true);
    try {
      const { data } = await facebookApi.selectConnect(pendingToken, selectedId);
      sessionStorage.removeItem(CODE_KEY);
      sessionStorage.removeItem(STATE_KEY);
      setStatus('success');
      setMessage(
        typeof data.data.pageName === 'string'
          ? `Connected ${data.data.pageName}`
          : 'Facebook Page connected'
      );
      window.setTimeout(() => navigate('/settings?tab=facebook', { replace: true }), 1200);
    } catch (err) {
      setStatus('error');
      setMessage(getErrorMessage(err) || 'Could not connect selected Page');
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-theme-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1877F2] text-white">
          {status === 'loading' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : status === 'error' ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <Facebook className="h-5 w-5" />
          )}
        </div>
        <p className="mt-4 text-[15px] font-semibold text-theme-fg">{message}</p>
        {status === 'select' ? (
          <div className="mt-4 space-y-2 text-left">
            {pages.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-theme-border px-3 py-2 text-[13px]"
              >
                <input
                  type="radio"
                  name="page"
                  checked={selectedId === p.id}
                  onChange={() => setSelectedId(p.id)}
                />
                <span className="font-medium text-theme-fg">{p.name}</span>
              </label>
            ))}
            <AppButton className="mt-3 w-full" loading={selecting} onClick={() => void confirmSelect()}>
              Connect Page
            </AppButton>
          </div>
        ) : null}
        {status === 'error' ? (
          <AppButton
            className="mt-4"
            variant="secondary"
            onClick={() => navigate('/settings?tab=facebook', { replace: true })}
          >
            Back to Settings
          </AppButton>
        ) : null}
      </div>
    </div>
  );
}
