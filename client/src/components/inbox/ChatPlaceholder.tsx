import {
  Filter,
  Keyboard,
  MessageSquarePlus,
  PanelRight,
  Plus,
  Search,
  type LucideIcon,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import InboxEmptyIcon from './InboxEmptyIcon';

export interface ChatPlaceholderProps {
  onNewChat?: () => void;
  onFocusSearch?: () => void;
  onOpenShortcuts?: () => void;
  /** Only true when Inbox Socket.IO is actually connected. */
  liveConnected?: boolean;
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-neutral-200/90 bg-neutral-50 px-1 font-mono text-[10px] font-bold tracking-wide text-theme-fg dark:border-white/10 dark:bg-neutral-800/80">
      {children}
    </kbd>
  );
}

interface TipCardProps {
  icon: LucideIcon;
  title: string;
  hint: string;
  keys?: string[];
  onClick?: () => void;
}

function TipCard({ icon: Icon, title, hint, keys, onClick }: TipCardProps) {
  const className = [
    'flex w-full flex-col gap-2 rounded-xl border border-neutral-100/90 bg-neutral-50/60 p-3 text-left transition',
    'dark:border-white/10 dark:bg-neutral-900/40',
    onClick
      ? 'cursor-pointer hover:border-emerald-200/80 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp-500/40 dark:hover:border-emerald-500/30 dark:hover:bg-neutral-900/70'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[#25D366] dark:bg-emerald-950/50 dark:text-whatsapp-400">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        {keys && keys.length > 0 ? (
          <span className="flex items-center gap-1 pt-0.5">
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        ) : null}
      </div>
      <div>
        <p className="text-[13px] font-bold tracking-tight text-theme-fg">{title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-theme-secondary">{hint}</p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }

  return <div className={className}>{body}</div>;
}

export default function ChatPlaceholder({
  onNewChat,
  onFocusSearch,
  onOpenShortcuts,
  liveConnected = false,
}: ChatPlaceholderProps) {
  return (
    <div
      className="inbox-placeholder-bg flex h-full min-h-0 flex-1 flex-col"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="w-full max-w-3xl">
          <section
            aria-labelledby="inbox-placeholder-heading"
            className="overflow-hidden rounded-2xl border border-neutral-100/90 bg-white dark:border-white/10 dark:bg-neutral-950/60 sm:rounded-3xl"
          >
            <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
              <div className="flex flex-col justify-center border-b border-neutral-100/90 px-6 py-7 sm:px-7 lg:border-b-0 lg:border-r lg:border-neutral-100/90 dark:border-white/10">
                <InboxEmptyIcon icon={MessageSquarePlus} size="md" />

                <h2
                  id="inbox-placeholder-heading"
                  className="mt-4 text-[1.25rem] font-bold tracking-tight text-theme-fg sm:mt-5 sm:text-[1.35rem]"
                >
                  Select a conversation
                </h2>
                <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-theme-secondary sm:text-[14px]">
                  Open a chat from the list to reply, or start a new conversation with a customer.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  {onNewChat ? (
                    <AppButton
                      size="md"
                      onClick={onNewChat}
                      icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
                      data-testid="inbox-placeholder-new-chat"
                    >
                      New chat
                    </AppButton>
                  ) : null}
                  {onFocusSearch ? (
                    <AppButton
                      size="md"
                      variant="secondary"
                      onClick={onFocusSearch}
                      icon={<Search className="h-4 w-4" strokeWidth={2.25} />}
                      data-testid="inbox-placeholder-focus-search"
                    >
                      Search
                      <span className="ml-1.5 hidden sm:inline-flex">
                        <Kbd>R</Kbd>
                      </span>
                    </AppButton>
                  ) : null}
                </div>

                {liveConnected ? (
                  <p className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-950/45 dark:text-emerald-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-400 opacity-50 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
                    </span>
                    Live updates connected
                  </p>
                ) : (
                  <p className="mt-5 text-[12px] font-medium text-theme-muted">
                    Pick a chat on the left to get started
                  </p>
                )}
              </div>

              <div className="px-5 py-6 sm:px-6 lg:px-7 lg:py-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-theme-muted">
                  Agent tips
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <TipCard
                    icon={Search}
                    title="Find chats fast"
                    hint="Focus the conversation search in the list."
                    keys={['R']}
                    onClick={onFocusSearch}
                  />
                  <TipCard
                    icon={PanelRight}
                    title="Details panel"
                    hint="After opening a chat, toggle contact, notes & labels."
                    keys={['D']}
                  />
                  <TipCard
                    icon={Filter}
                    title="Filter the list"
                    hint="Unread, status chips, and agent filters sit above the chat list."
                  />
                  <TipCard
                    icon={Keyboard}
                    title="All shortcuts"
                    hint="Open the full keyboard cheat sheet anytime."
                    keys={['?']}
                    onClick={onOpenShortcuts}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
