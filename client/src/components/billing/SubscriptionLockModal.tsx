import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import AppButton from '../ui/AppButton';

const DISMISS_KEY = 'samyoj.subscription-lock.dismissed';

export function SubscriptionLockBanner({ locked }: { locked: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!locked) setDismissed(false);
  }, [locked]);

  if (!locked || dismissed) return null;

  return (
    <div className="flex items-start gap-3 border-b border-rose-200/80 bg-rose-50/95 px-4 py-3 dark:border-rose-800/40 dark:bg-rose-950/30 sm:px-6">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-rose-950 dark:text-rose-100">Your plan period has ended</p>
        <p className="mt-0.5 text-[12px] font-medium text-rose-900/90 dark:text-rose-200/90">
          Purchase a plan to restore sending, campaigns, and AI.{' '}
          <Link to="/billing" className="font-bold underline underline-offset-2">
            View plans
          </Link>
        </p>
      </div>
      <button
        type="button"
        className="rounded-md p-1 text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-900/40"
        aria-label="Dismiss plan notice"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function SubscriptionLockModal({ locked }: { locked: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locked) {
      sessionStorage.removeItem(DISMISS_KEY);
      setOpen(false);
      return;
    }
    if (pathname.startsWith('/billing')) {
      setOpen(false);
      return;
    }
    setOpen(sessionStorage.getItem(DISMISS_KEY) !== '1');
  }, [locked, pathname]);

  if (!open) return null;

  const close = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="subscription-lock-title">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={close} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-rose-200/80 bg-white p-6 shadow-2xl dark:border-rose-900/60 dark:bg-slate-900">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-slate-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Plan expired</p>
        <h2 id="subscription-lock-title" className="mt-2 text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          Your plan period has ended
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-slate-300">
          Purchase a plan to keep sending messages, running campaigns, and using AI. Until you renew, this workspace stays read-only.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <AppButton
            variant="primary"
            className="flex-1"
            onClick={() => {
              close();
              navigate('/billing');
            }}
          >
            View plans
          </AppButton>
          <AppButton variant="secondary" onClick={close}>
            Not now
          </AppButton>
        </div>
      </div>
    </div>
  );
}
