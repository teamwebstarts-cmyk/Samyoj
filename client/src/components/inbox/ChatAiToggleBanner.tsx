import { MessageSquare } from 'lucide-react';
import type { AiBot } from '../../types';
import ChatAiPicker from './ChatAiPicker';
import InfoTip from '../ui/InfoTip';

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
  /** False when the org has zero AI agents — the card is disabled until one is created. */
  hasBots?: boolean;
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
  hasBots = true,
}: ChatAiToggleBannerProps) {
  const tone = enabled
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-[#64748b] dark:text-slate-400';
  const statusLabel = enabled ? 'On' : 'Off';
  const autoLabel = enabled ? 'AI replies' : 'Human replies';
  const infoText = enabled
    ? 'AI chat is on for every conversation on this number — all chats reply with your global bot (unless handed off to a human).'
    : 'AI chat is off org-wide — turn on per chat from the bot menu, or enable global AI here. Personal picks are remembered when you toggle global.';

  const noBots = !hasBots;

  return (
    <section
      className={`rounded-xl border px-3 py-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] sm:rounded-[18px] sm:px-5 sm:py-3.5 ${
        noBots
          ? 'border-dashed border-[#e2e8f0] bg-[#f8fafc] opacity-70 dark:border-slate-700 dark:bg-slate-900/50'
          : 'border-[#e8eef5] bg-white dark:border-slate-800 dark:bg-slate-950'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] sm:h-9 sm:w-9 sm:rounded-[12px] ${
              noBots
                ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                : 'bg-[#e8faf2] text-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-300'
            }`}
          >
            <MessageSquare className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] font-extrabold leading-tight text-[#0f172a] dark:text-white sm:text-[13px]">
                AI chat
              </p>
              {!noBots && <InfoTip content={infoText} />}
            </div>
            {noBots ? (
              <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#94a3b8] dark:text-slate-400 sm:text-[12px]">
                Create a new agent to enable AI chat.
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#94a3b8] dark:text-slate-400 sm:text-[12px]">
                <span className={`tabular-num ${tone}`}>{statusLabel}</span>
                <span className="mx-1 text-[#cbd5e1]">•</span>
                <span>{autoLabel}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
          <ChatAiPicker
            orgMode
            enabled={enabled}
            saving={saving}
            disabled={!canToggle || noBots}
            showTrainLink
            defaultChatBotId={defaultChatBotId}
            chatBots={chatBots}
            botsLoading={botsLoading}
            botAssigning={botAssigning}
            onSelectBot={onSelectBot}
            onChange={onChange}
          />
        </div>
      </div>
    </section>
  );
}
