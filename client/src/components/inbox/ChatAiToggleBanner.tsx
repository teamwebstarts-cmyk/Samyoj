import { MessageSquare } from 'lucide-react';
import type { AiBot } from '../../types';
import ChatAiPicker from './ChatAiPicker';

interface ChatAiToggleBannerProps {
  enabled: boolean;
  saving?: boolean;
  canToggle?: boolean;
  onChange: (enabled: boolean) => void;
  defaultChatBotId?: string | null;
  chatBots?: AiBot[];
  botsLoading?: boolean;
  botAssigning?: boolean;
  onSelectBot?: (botId: string) => void;
}

export default function ChatAiToggleBanner({
  enabled,
  saving = false,
  canToggle = true,
  onChange,
  defaultChatBotId = null,
  chatBots = [],
  botsLoading = false,
  botAssigning = false,
  onSelectBot,
}: ChatAiToggleBannerProps) {
  const tone = enabled
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-[#64748b] dark:text-slate-400';
  const statusLabel = enabled ? 'On' : 'Off';
  const autoLabel = enabled ? 'AI replies' : 'Human replies';

  const toggleSwitch = (
    <span
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${
        enabled ? 'bg-[#10b981]' : 'bg-neutral-300 dark:bg-neutral-600'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
          enabled ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </span>
  );

  return (
    <section className="rounded-xl border border-[#e8eef5] bg-white px-3 py-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] dark:border-slate-800 dark:bg-slate-950 sm:rounded-[18px] sm:px-5 sm:py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#e8faf2] text-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-300 sm:h-9 sm:w-9 sm:rounded-[12px]">
            <MessageSquare className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-extrabold leading-tight text-[#0f172a] dark:text-white sm:text-[13px]">
              AI chat
            </p>
            <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#94a3b8] dark:text-slate-400 sm:text-[12px]">
              <span className={`tabular-nums ${tone}`}>{statusLabel}</span>
              <span className="mx-1 text-[#cbd5e1]">•</span>
              <span>{autoLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
          <ChatAiPicker
            orgMode
            enabled={enabled}
            saving={saving}
            defaultChatBotId={defaultChatBotId}
            chatBots={chatBots}
            botsLoading={botsLoading}
            botAssigning={botAssigning}
            onSelectBot={onSelectBot}
            onChange={onChange}
          />
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? 'Turn off AI chat' : 'Turn on AI chat'}
            disabled={saving || !canToggle}
            title={
              canToggle
                ? enabled
                  ? 'On — AI replies to new chat messages. Turn off to have your team reply.'
                  : 'Off — turn on so AI can reply to chat messages on this number.'
                : 'Only an owner or admin can change this'
            }
            onClick={() => onChange(!enabled)}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#e4e9f2] bg-[#f5f7fb] px-3 text-[11px] font-bold text-[#334155] transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30 sm:min-h-10 sm:px-3.5 sm:text-[12px]"
          >
            {toggleSwitch}
            <span className="hidden sm:inline">{enabled ? 'Turn off' : 'Turn on'}</span>
            <span className={`tabular-nums sm:hidden ${tone}`}>{statusLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
