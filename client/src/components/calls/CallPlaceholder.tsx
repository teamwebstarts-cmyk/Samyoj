import { FileText, Phone, PhoneCall, Search, AudioLines, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppButton from '../ui/AppButton';
import EmptyStateHeroImage from '../ui/EmptyStateHeroImage';
import InboxEmptyIcon from '../inbox/InboxEmptyIcon';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { whatsappNotConnectedCopy } from '../../utils/whatsappConnectionCopy';

const CALL_FEATURES = [
  {
    icon: AudioLines,
    title: 'Answer calls',
    description: 'AI picks up incoming',
  },
  {
    icon: Phone,
    title: 'Call back',
    description: 'Call from Inbox',
  },
  {
    icon: FileText,
    title: 'Transcript',
    description: 'Review call text',
  },
  {
    icon: Sparkles,
    title: 'Call summary',
    description: 'Post-call recap',
  },
] as const;

interface CallsListEmptyProps {
  filtered?: boolean;
}

/** Left-pane empty — same structure as InboxListEmpty. */
export function CallsListEmpty({ filtered }: CallsListEmptyProps) {
  const { hasConnectedNumber, loading, disconnectedNumbers } = useWhatsAppNumber();
  const whatsappConnected = hasConnectedNumber;
  const disconnectedCopy = whatsappNotConnectedCopy(disconnectedNumbers, {
    task: 'receive and place customer calls',
  });

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
      <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">
        {whatsappConnected ? 'No calls yet' : disconnectedCopy.title}
      </h3>
      <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-theme-secondary">
        {whatsappConnected
          ? 'Answer incoming rings, or call a customer from Inbox when they allow it.'
          : disconnectedCopy.description}
      </p>

      {!loading && (
        <div className="mt-5 w-full max-w-[220px]">
          {!whatsappConnected ? (
            <Link to="/settings?tab=whatsapp">
              <AppButton fullWidth size="sm">
                {disconnectedCopy.cta}
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

/** Right pane when no call is open — hero + AI calling onboarding. */
export function CallsSelectEmpty() {
  return (
    <div
      className="inbox-placeholder-bg relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="AI Calling"
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-white/50 backdrop-blur-md dark:bg-[#0b141a]/40 dark:backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_38%,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.28)_48%,transparent_82%)] dark:bg-[radial-gradient(ellipse_90%_80%_at_50%_38%,rgba(255,255,255,0.1)_0%,transparent_72%)]"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
        <div className="inbox-placeholder-enter mx-auto flex h-full min-h-0 w-full max-w-[42rem] flex-col items-center justify-center">
          <div className="flex min-h-0 w-full max-w-[38rem] flex-[1.1] items-center justify-center">
            <EmptyStateHeroImage id="calls-empty-hero" width={1280} height={720} />
          </div>

          <div className="flex w-full shrink-0 flex-col items-center text-center">
          <h2
            className="inbox-placeholder-card max-w-[20rem] text-[17px] font-bold leading-tight tracking-tight text-[#1e293b] dark:text-white sm:max-w-[24rem] sm:text-[20px]"
            style={{ animationDelay: '60ms' }}
          >
            AI Calling, every conversation handled
          </h2>

          <p
            className="inbox-placeholder-card mt-1.5 max-w-[22rem] text-[11px] font-medium leading-snug text-slate-500 dark:text-slate-400 sm:max-w-[26rem] sm:text-[12px]"
            style={{ animationDelay: '120ms' }}
          >
            Samyoj AI can answer incoming WhatsApp calls, call customers back from Inbox, and
            show transcripts and summaries for AI-handled calls.
          </p>

          <div
            className="inbox-placeholder-card mt-3 w-full max-w-[34rem] sm:mt-3.5"
            style={{ animationDelay: '180ms' }}
          >
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {CALL_FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="flex min-w-0 flex-col items-center rounded-lg border border-slate-200/70 bg-white/90 px-1 py-2 text-center shadow-sm dark:border-slate-700/60 dark:bg-neutral-900/80 sm:rounded-xl sm:px-1.5 sm:py-2.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-whatsapp-500/10 text-whatsapp-600 dark:bg-whatsapp-500/15 dark:text-whatsapp-400 sm:h-7 sm:w-7 sm:rounded-lg">
                      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.15} />
                    </span>
                    <span className="mt-1 block text-[9px] font-bold leading-tight text-slate-800 dark:text-slate-100 sm:mt-1.5 sm:text-[10.5px]">
                      {feature.title}
                    </span>
                    <span className="mt-0.5 block text-[7.5px] font-medium leading-snug text-slate-500 dark:text-slate-400 sm:text-[8.5px]">
                      {feature.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <Link
            to="/ai-bot"
            className="inbox-placeholder-card mt-3 sm:mt-3.5"
            style={{ animationDelay: '240ms' }}
          >
            <span className="inline-flex items-center gap-2 rounded-xl bg-whatsapp-500 px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition hover:bg-whatsapp-600 sm:px-5 sm:py-3 sm:text-[13px]">
              <PhoneCall className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              Setup AI Calling
            </span>
          </Link>

          <p
            className="inbox-placeholder-card mt-2 text-[10.5px] font-medium text-slate-400 dark:text-slate-500 sm:text-[11.5px]"
            style={{ animationDelay: '300ms' }}
          >
            Configure your AI agent and start calling in minutes.
          </p>
          </div>
        </div>
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
