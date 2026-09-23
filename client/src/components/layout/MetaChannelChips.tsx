import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Facebook, Instagram } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { facebookApi, instagramApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import { getErrorMessage } from '../../utils/errors';

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

export default function MetaChannelChips({
  className = '',
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { orgRole } = useAuth();
  const location = useLocation();
  const canConnect = orgRole === 'OWNER' || orgRole === 'ADMIN';
  const [facebook, setFacebook] = useState<MetaChip | null>(null);
  const [instagram, setInstagram] = useState<MetaChip | null>(null);
  const [busy, setBusy] = useState<'fb' | 'ig' | null>(null);

  const refreshMeta = () => {
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
  };

  useEffect(() => {
    refreshMeta();
  }, []);

  const startFacebookConnect = async () => {
    if (!canConnect) return;
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
      setInstagram({
        connected: true,
        label: saved.username ? `@${saved.username}` : 'Instagram',
      });
      toastSuccess('Instagram connected');
    } catch (err) {
      const message = getErrorMessage(err) || 'Could not connect Instagram';
      if (/facebook page first/i.test(message)) {
        toastError('Connect a Facebook Page first');
        await startFacebookConnect();
        return;
      }
      toastError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`grid grid-cols-2 gap-1.5 ${className}`.trim()}>
      {facebook?.connected ? (
        <Link
          to="/facebook/inbox"
          onClick={onNavigate}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 ring-1 ring-[#1877F2]/20 hover:bg-white dark:bg-[#1877F2]/10"
          title={facebook.label}
        >
          <Facebook className="h-3.5 w-3.5 shrink-0 text-[#1877F2]" strokeWidth={2.25} />
          <span className="truncate text-[10.5px] font-bold text-theme-fg">{facebook.label}</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void startFacebookConnect()}
          disabled={!canConnect || busy === 'fb'}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 text-left ring-1 ring-[#1877F2]/20 hover:bg-white disabled:opacity-50 dark:bg-[#1877F2]/10"
          title={canConnect ? 'Connect Facebook Page' : 'Ask an admin to connect'}
        >
          <Facebook className="h-3.5 w-3.5 shrink-0 text-[#1877F2]" strokeWidth={2.25} />
          <span className="truncate text-[10.5px] font-bold text-theme-fg">
            {busy === 'fb' ? 'Connecting…' : facebook?.label || 'Connect Page'}
          </span>
        </button>
      )}
      {instagram?.connected ? (
        <Link
          to="/instagram/inbox"
          onClick={onNavigate}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 ring-1 ring-[#E4405F]/20 hover:bg-white dark:bg-[#E4405F]/10"
          title={instagram.label}
        >
          <Instagram className="h-3.5 w-3.5 shrink-0 text-[#E4405F]" strokeWidth={2.25} />
          <span className="truncate text-[10.5px] font-bold text-theme-fg">{instagram.label}</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => void startInstagramConnect()}
          disabled={!canConnect || busy === 'ig'}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 text-left ring-1 ring-[#E4405F]/20 hover:bg-white disabled:opacity-50 dark:bg-[#E4405F]/10"
          title={canConnect ? 'Connect Instagram' : 'Ask an admin to connect'}
        >
          <Instagram className="h-3.5 w-3.5 shrink-0 text-[#E4405F]" strokeWidth={2.25} />
          <span className="truncate text-[10.5px] font-bold text-theme-fg">
            {busy === 'ig' ? 'Connecting…' : instagram?.label || 'Connect IG'}
          </span>
        </button>
      )}
    </div>
  );
}
