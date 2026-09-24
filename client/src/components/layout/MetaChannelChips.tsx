import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Facebook, Instagram } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { facebookApi, instagramApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';
import { facebookLoginHttpsBlockedReason } from '../../utils/facebookLoginHttps';
type MetaChip = {
  connected: boolean;
  label: string;
};

export function safeFbConnectReturn(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/settings?tab=facebook';
  }
  return raw;
}

export function useMetaChannelConnect() {
  const { orgRole } = useAuth();
  const location = useLocation();
  const canConnect = orgRole === 'OWNER' || orgRole === 'ADMIN';
  const [busy, setBusy] = useState<'fb' | 'ig' | null>(null);

  const startFacebookConnect = async () => {
    if (!canConnect) return;
    const blocked = facebookLoginHttpsBlockedReason(
      window.location,
      typeof import.meta.env.VITE_CODESPACE_HTTPS_ORIGIN === 'string'
        ? import.meta.env.VITE_CODESPACE_HTTPS_ORIGIN
        : '',
      'Facebook Page',
    );
    if (blocked) {
      toastError(blocked);
      return;
    }
    setBusy('fb');
    try {
      sessionStorage.setItem('fb_connect_return', `${location.pathname}${location.search}`);
      const redirectUri = `${window.location.origin}/settings/facebook/callback`;
      const { data } = await facebookApi.connectUrl(redirectUri);
      const launch = data.data as { url?: string };
      if (!launch?.url) throw new Error('Connect URL missing');
      window.location.assign(launch.url);
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not start Facebook Page connect');
      setBusy(null);
    }
  };

  const startInstagramConnect = async () => {
    if (!canConnect) return;
    setBusy('ig');
    try {
      const { data } = await instagramApi.connect();
      const saved = data.data;
      toastSuccess('Instagram connected');
      setBusy(null);
      return saved;
    } catch (err) {
      const message = getErrorMessage(err) || 'Could not connect Instagram';
      setBusy(null);
      if (/facebook page first/i.test(message)) {
        toastError('Connect a Facebook Page first');
        await startFacebookConnect();
        return null;
      }
      toastError(message);
      return null;
    }
  };

  return { canConnect, busy, startFacebookConnect, startInstagramConnect };
}

/** Shared Facebook/Instagram connection state (one fetch, reused by chips + dashboard strip). */
export function useMetaChannelStatus() {
  const [facebook, setFacebook] = useState<MetaChip | null>(null);
  const [instagram, setInstagram] = useState<MetaChip | null>(null);

  useEffect(() => {
    void facebookApi
      .page()
      .then((res) => {
        const page = res.data.data.page;
        setFacebook(
          page ? { connected: true, label: page.name } : { connected: false, label: 'Connect Page' }
        );
      })
      .catch(() => setFacebook({ connected: false, label: 'Connect Page' }));
    void instagramApi
      .account()
      .then((res) => {
        const account = res.data.data.account;
        setInstagram(
          account
            ? { connected: true, label: account.username ? `@${account.username}` : 'Instagram' }
            : { connected: false, label: 'Connect IG' }
        );
      })
      .catch(() => setInstagram({ connected: false, label: 'Connect IG' }));
  }, []);

  const markInstagramConnected = (username: string) => {
    setInstagram({ connected: true, label: username ? `@${username}` : 'Instagram' });
  };

  return { facebook, instagram, markInstagramConnected };
}

export default function MetaChannelChips({
  className = '',
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { canConnect, busy, startFacebookConnect, startInstagramConnect } = useMetaChannelConnect();
  const { facebook, instagram, markInstagramConnected } = useMetaChannelStatus();

  const connectInstagram = async () => {
    const saved = await startInstagramConnect();
    if (!saved || typeof saved !== 'object') return;
    const username = 'username' in saved && typeof saved.username === 'string' ? saved.username : '';
    markInstagramConnected(username);
  };

  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white/70 p-1.5 shadow-sm dark:border-white/10 dark:bg-white/5 ${className}`.trim()}
    >
      {facebook?.connected ? (
        <Link
          to="/facebook/inbox"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[#1877F2]/5"
          title={facebook.label}
        >
          <Facebook className="h-3.5 w-3.5 shrink-0 text-[#1877F2]" strokeWidth={2.25} />
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-theme-fg">Facebook</span>
          <span className="shrink-0 text-[10px] font-semibold text-emerald-600">Connected</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void startFacebookConnect()}
          disabled={!canConnect || busy === 'fb'}
          className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[#1877F2]/5 disabled:opacity-50"
          title={canConnect ? 'Connect Facebook Page' : 'Ask an admin to connect'}
        >
          <Facebook className="h-3.5 w-3.5 shrink-0 text-[#1877F2]" strokeWidth={2.25} />
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-theme-fg">Facebook</span>
          <span className="shrink-0 text-[10px] font-semibold text-theme-muted">
            {busy === 'fb' ? 'Connecting…' : 'Not connected'}
          </span>
        </button>
      )}
      {instagram?.connected ? (
        <Link
          to="/instagram/inbox"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2 rounded-lg border-t border-slate-100 px-2.5 py-2 text-left hover:bg-[#E4405F]/5 dark:border-white/10"
          title={instagram.label}
        >
          <Instagram className="h-3.5 w-3.5 shrink-0 text-[#E4405F]" strokeWidth={2.25} />
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-theme-fg">Instagram</span>
          <span className="shrink-0 text-[10px] font-semibold text-emerald-600">Connected</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void connectInstagram()}
          disabled={!canConnect || busy === 'ig'}
          className="flex w-full min-w-0 items-center gap-2 rounded-lg border-t border-slate-100 px-2.5 py-2 text-left hover:bg-[#E4405F]/5 disabled:opacity-50 dark:border-white/10"
          title={canConnect ? 'Connect Instagram' : 'Ask an admin to connect'}
        >
          <Instagram className="h-3.5 w-3.5 shrink-0 text-[#E4405F]" strokeWidth={2.25} />
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-theme-fg">Instagram</span>
          <span className="shrink-0 text-[10px] font-semibold text-theme-muted">
            {busy === 'ig' ? 'Connecting…' : 'Not connected'}
          </span>
        </button>
      )}
    </div>
  );
}
