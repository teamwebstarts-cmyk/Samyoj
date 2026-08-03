import { ArrowLeft, Bot, MessageSquare, Search, Users } from 'lucide-react';
import InboxEmptyIcon from './InboxEmptyIcon';

const features = [
  { icon: Search, label: 'Search', hint: 'Press R to find chats' },
  { icon: Bot, label: 'AI bot', hint: 'Auto-replies enabled' },
  { icon: Users, label: 'Team', hint: 'Assign & collaborate' },
];

export default function ChatPlaceholder() {
  return (
    <div className="inbox-placeholder-bg flex h-full min-h-0 flex-1 flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-[380px] text-center">
        <div className="flex justify-center">
          <InboxEmptyIcon icon={MessageSquare} size="md" />
        </div>

        <h2 className="mt-6 text-xl font-bold tracking-tight text-theme-fg">
          Select a conversation
        </h2>
        <p className="mx-auto mt-2 max-w-[300px] text-[14px] leading-relaxed text-theme-secondary">
          Choose a chat from the list to read messages and reply to your customers.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-2">
          {features.map(({ icon: Icon, label, hint }) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-xl border border-white/70 bg-white/80 px-2 py-3 shadow-sm backdrop-blur-sm dark:border-neutral-700/60 dark:bg-neutral-900/75"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-whatsapp-600 dark:bg-emerald-950/50 dark:text-whatsapp-400">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="mt-2 text-[11px] font-bold text-theme-fg">{label}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-theme-muted">{hint}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-[12px] font-semibold text-emerald-700 shadow-sm backdrop-blur-sm dark:border-emerald-500/20 dark:bg-neutral-900/80 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live updates enabled
        </p>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] font-medium text-theme-muted md:hidden">
          <ArrowLeft className="h-3.5 w-3.5" />
          Tap a chat to get started
        </p>
      </div>
    </div>
  );
}
