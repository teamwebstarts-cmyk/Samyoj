import { MessageSquarePlus } from 'lucide-react';
import EmptyStateHeroImage from '../ui/EmptyStateHeroImage';

interface ChatPlaceholderProps {
  onNewChat?: () => void;
}

/** Right pane when no chat is open — hero illustration + onboarding copy. */
export default function ChatPlaceholder({ onNewChat }: ChatPlaceholderProps) {
  return (
    <div
      className="inbox-placeholder-bg relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Your inbox is ready"
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-white/50 backdrop-blur-md dark:bg-[#0b141a]/40 dark:backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_42%,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.28)_48%,transparent_82%)] dark:bg-[radial-gradient(ellipse_90%_80%_at_50%_42%,rgba(255,255,255,0.1)_0%,transparent_72%)]"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
        <div className="inbox-placeholder-enter flex h-full min-h-0 w-full max-w-[42rem] flex-col items-center justify-center mx-auto">
          <div className="flex min-h-0 w-full max-w-[38rem] flex-[1.15] items-center justify-center">
            <EmptyStateHeroImage id="inbox-empty-hero" width={1280} height={853} />
          </div>

          <div className="flex w-full shrink-0 flex-col items-center text-center">
            <h2
              className="inbox-placeholder-card text-[18px] font-bold leading-tight tracking-tight text-[#1e293b] dark:text-white sm:text-[21px]"
              style={{ animationDelay: '60ms' }}
            >
              Your inbox is ready!
            </h2>

            <p
              className="inbox-placeholder-card mt-1.5 max-w-[17.5rem] text-[11.5px] font-medium leading-snug text-slate-500 dark:text-slate-400 sm:mt-2 sm:max-w-[19rem] sm:text-[12.5px]"
              style={{ animationDelay: '120ms' }}
            >
              All your conversations, AI replies and automations in one smart place.
            </p>

            <div
              className="inbox-placeholder-card relative my-3 w-full max-w-[11rem] sm:my-3.5"
              style={{ animationDelay: '180ms' }}
              aria-hidden
            >
              <div className="h-px w-full bg-slate-200/90 dark:bg-slate-700/80" />
              <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-whatsapp-500 shadow-[0_0_0_3px_rgba(255,255,255,0.95)] dark:shadow-[0_0_0_3px_rgba(15,23,42,0.95)]" />
            </div>

            <p
              className="inbox-placeholder-card text-[11.5px] font-medium text-slate-400 dark:text-slate-500 sm:text-[12px]"
              style={{ animationDelay: '240ms' }}
            >
              Select a conversation to begin replying
            </p>

            {onNewChat ? (
              <button
                type="button"
                onClick={onNewChat}
                className="inbox-placeholder-card mt-3 inline-flex items-center gap-2 rounded-full border border-whatsapp-500/35 bg-white px-4 py-2 text-[12.5px] font-semibold text-whatsapp-600 shadow-[0_2px_10px_rgba(37,211,102,0.08)] transition hover:border-whatsapp-500/55 hover:bg-whatsapp-50/80 dark:border-whatsapp-500/30 dark:bg-neutral-900 dark:text-whatsapp-400 dark:hover:bg-whatsapp-950/30 sm:mt-3.5 sm:py-2.5 sm:text-[13px]"
                style={{ animationDelay: '300ms' }}
              >
                <MessageSquarePlus className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                + New chat
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
