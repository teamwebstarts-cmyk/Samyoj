import {
  BookOpen,
  Pause,
  Pencil,
  Play,
  Star,
  Trash2,
} from 'lucide-react';
import type { AiBot } from '../../types';
import { AiBotStatusCell } from './AiBotListCells';
import { botChip, getAiBotAvatar } from './aiBotVisuals';

interface AiBotCardProps {
  bot: AiBot;
  answersCalls?: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onToggleAllChats?: () => void;
  onToggleAllCalls?: () => void;
}

export function AllChatsSwitch({
  applied,
  onClick,
  noun = 'chats',
}: {
  applied: boolean;
  onClick: () => void;
  noun?: 'chats' | 'calls';
}) {
  const onLabel = noun === 'calls' ? 'All calls' : 'All chats';
  const aria = noun === 'calls'
    ? applied
      ? 'Stop this bot answering all calls'
      : 'Let this bot answer all calls'
    : applied
      ? 'Remove this bot from all chats'
      : 'Apply this bot to all chats';
  const title =
    noun === 'calls'
      ? applied
        ? 'On — this bot answers all calls. Off sends the call to a person, or misses if nobody is free.'
        : 'Off — turn on so this bot answers all calls'
      : applied
        ? 'On for all chats — turn off to remove'
        : 'Off — turn on to apply to all chats';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={applied}
      aria-label={aria}
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold transition sm:px-2.5 ${
        applied
          ? 'border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-300'
          : 'border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
      }`}
    >
      <span className="hidden lg:inline">{onLabel}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${
          applied ? 'bg-sky-500' : 'bg-neutral-300 dark:bg-neutral-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            applied ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

/** Compact mobile/tablet bot row — fits more bots on screen. */
export default function AiBotCard({
  bot,
  answersCalls = false,
  onEdit,
  onToggle,
  onDelete,
  onToggleAllChats,
  onToggleAllCalls,
}: AiBotCardProps) {
  const faqCount = bot._count?.knowledgeItems ?? 0;
  const isChat = (bot.channel ?? 'CHAT') === 'CHAT';
  const avatar = getAiBotAvatar(bot.id, bot.enabled);
  const AvatarIcon = avatar.Icon;

  return (
    <article className="bg-white transition-colors active:bg-neutral-50 dark:bg-neutral-950 dark:active:bg-neutral-900/60">
      <div className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <button
          type="button"
          onClick={onEdit}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
        >
          <div className="relative shrink-0">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${avatar.className}`}
            >
              <AvatarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.25} />
            </div>
            {bot.enabled && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-neutral-950" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="min-w-0 truncate text-[13px] font-bold text-theme-fg">{bot.name}</h3>
              {bot.isDefault && isChat && (
                <span className={`${botChip.base} shrink-0 ${botChip.default}`}>
                  <Star className="h-2.5 w-2.5" />
                  Default
                </span>
              )}
              {answersCalls && !isChat && (
                <span className={`${botChip.base} shrink-0 ${botChip.default}`}>Answers calls</span>
              )}
              <span className="ml-auto shrink-0 pl-1">
                <AiBotStatusCell enabled={bot.enabled} />
              </span>
            </div>

            <div className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden">
              <span className="truncate text-[11px] font-medium text-theme-muted">
                {isChat
                  ? bot.isDefault
                    ? 'Replies in chats without a personal pick'
                    : 'Chat bot'
                  : answersCalls
                    ? 'Answers the phone'
                    : 'Calling bot'}
              </span>

              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums text-theme-secondary">
                <BookOpen className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                {faqCount}
              </span>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={onToggle}
            aria-label={bot.enabled ? 'Pause bot' : 'Activate bot'}
            title={bot.enabled ? 'Pause' : 'Activate'}
            className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition sm:px-2.5 ${
              bot.enabled
                ? 'border-emerald-200/80 bg-emerald-50 text-whatsapp-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border-theme-border bg-theme-surface text-theme-fg hover:bg-theme-subtle'
            }`}
          >
            {bot.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{bot.enabled ? 'Pause' : 'On'}</span>
          </button>
          {isChat && onToggleAllChats && (
            <AllChatsSwitch applied={Boolean(bot.appliedToAll)} onClick={onToggleAllChats} />
          )}
          {!isChat && onToggleAllCalls && (
            <AllChatsSwitch
              noun="calls"
              applied={Boolean(answersCalls)}
              onClick={onToggleAllCalls}
            />
          )}
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit bot"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-theme-border bg-theme-surface text-theme-secondary transition hover:bg-theme-subtle hover:text-theme-fg"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete bot"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50/80 text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
