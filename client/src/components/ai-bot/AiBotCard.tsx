import {
  BookOpen,
  Bot,
  Clock,
  Hash,
  PauseCircle,
  Pencil,
  PlayCircle,
  Star,
  Trash2,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import type { AiBot } from '../../types';

interface AiBotCardProps {
  bot: AiBot;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

export default function AiBotCard({ bot, onEdit, onToggle, onDelete }: AiBotCardProps) {
  const faqCount = bot._count?.knowledgeItems ?? 0;
  const triggers =
    bot.triggerKeywords.length > 0
      ? bot.triggerKeywords
      : bot.isDefault
        ? ['All messages']
        : [];
  const instructionPreview = bot.instructions.trim();

  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <div className="relative shrink-0">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              bot.enabled
                ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)]'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
            }`}
          >
            <Bot className="h-4 w-4" strokeWidth={2.25} />
          </div>
          {bot.enabled && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-neutral-950" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[13px] font-bold text-theme-fg">{bot.name}</h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                bot.enabled
                  ? 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20 dark:text-emerald-300'
                  : 'bg-theme-subtle text-theme-muted ring-theme-border'
              }`}
            >
              {bot.enabled ? 'Live' : 'Paused'}
            </span>
          </div>

          {instructionPreview && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-theme-muted">
              {instructionPreview}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {bot.isDefault && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-300">
                <Star className="h-2.5 w-2.5" />
                Default
              </span>
            )}
            {bot.businessHoursOnly && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-300">
                <Clock className="h-2.5 w-2.5" />
                Hours only
              </span>
            )}
            {triggers.slice(0, 2).map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800 ring-1 ring-indigo-200/70 dark:bg-indigo-900/30 dark:text-indigo-300"
              >
                {kw !== 'All messages' && <Hash className="h-3 w-3" />}
                {kw}
              </span>
            ))}
            {triggers.length > 2 && (
              <span className="text-[10px] font-bold text-theme-muted">+{triggers.length - 2}</span>
            )}
            <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-300">
              <BookOpen className="h-3 w-3" />
              {faqCount}
            </span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
        <AppButton
          size="sm"
          className="flex-1"
          variant={bot.enabled ? 'secondary' : 'primary'}
          icon={bot.enabled ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
          onClick={onToggle}
        >
          {bot.enabled ? 'Pause' : 'Activate'}
        </AppButton>
        <AppButton size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={onEdit}>
          Edit
        </AppButton>
        <AppButton size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={onDelete} aria-label="Delete" />
      </div>
    </article>
  );
}
