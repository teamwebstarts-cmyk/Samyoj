import { Phone, PhoneCall, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppButton from '../ui/AppButton';
import InboxEmptyIcon from '../inbox/InboxEmptyIcon';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

interface CallsListEmptyProps {
  filtered?: boolean;
}

/** Left-pane empty — same structure as InboxListEmpty. */
export function CallsListEmpty({ filtered }: CallsListEmptyProps) {
  const { hasConnectedNumber, loading } = useWhatsAppNumber();
  const whatsappConnected = hasConnectedNumber;

  if (filtered) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <InboxEmptyIcon icon={Search} tone="muted" size="md" />
        <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">No calls match</h3>
        <p className="mt-2 max-w-[240px] text-[13px] leading-relaxed text-theme-secondary">
          Try a different search term or clear your filters to see all calls.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <InboxEmptyIcon icon={Phone} size="md" />
      <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">No calls yet</h3>
      <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-theme-secondary">
        {whatsappConnected
          ? 'Answer incoming rings, or call a customer from Inbox when they allow it.'
          : 'Connect WhatsApp to start receiving and placing customer calls.'}
      </p>

      {!loading && (
        <div className="mt-5 w-full max-w-[220px]">
          {!whatsappConnected ? (
            <Link to="/settings?tab=whatsapp">
              <AppButton fullWidth size="sm">
                Connect WhatsApp
              </AppButton>
            </Link>
          ) : (
            <Link to="/inbox">
              <AppButton fullWidth size="sm">
                Open Inbox
              </AppButton>
            </Link>
          )}
        </div>
      )}

      {!loading && whatsappConnected && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-400 opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
          </span>
          Live updates on
        </p>
      )}
    </div>
  );
}

/** Right pane when no call is open — icon only, same as Inbox. */
export function CallsSelectEmpty() {
  return (
    <div
      className="inbox-placeholder-bg flex h-full min-h-0 flex-1 flex-col"
      role="status"
      aria-live="polite"
      aria-label="Select a call"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8">
        <InboxEmptyIcon icon={PhoneCall} size="md" />
      </div>
    </div>
  );
}

interface CallPlaceholderProps {
  variant?: 'empty' | 'select' | 'setup';
}

/** @deprecated Prefer CallsListEmpty / CallsSelectEmpty — kept for compat. */
export default function CallPlaceholder({ variant = 'select' }: CallPlaceholderProps) {
  if (variant === 'empty') return <CallsListEmpty />;
  return <CallsSelectEmpty />;
}
