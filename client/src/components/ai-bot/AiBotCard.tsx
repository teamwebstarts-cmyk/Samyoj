import {
  ArrowRight,
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
  const instructionPreview = bot.instructions.trim().slice(0, 140);

  return (
    <article className="dashboard-card group relative overflow-hidden p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-panel">
      {bot.enabled && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-400 via-violet-500 to-purple-600" />
      )}

      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl transition-opacity duration-300 ${
          bot.enabled ? 'bg-violet-400/20 opacity-70 group-hover:opacity-100' : 'bg-neutral-400/10 opacity-40'
        }`}
      />

      <button
        type="button"
        onClick={onEdit}
        className="relative flex w-full items-start gap-3 p-4 text-left transition active:bg-theme-subtle/50 sm:gap-4 sm:p-5"
      >
        <div className="relative shrink-0">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl sm:h-[52px] sm:w-[52px] ${
              bot.enabled
                ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_8px_20px_rgba(99,102,241,0.35)]'
                : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border'
            }`}
          >
            <Bot className="h-5 w-5" strokeWidth={2.25} />
          </div>
          {bot.enabled && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-theme-surface ring-2 ring-theme-surface">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[15px] font-extrabold tracking-tight text-theme-fg sm:text-base">
                {bot.name}
              </h3>
              {instructionPreview && (
                <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-relaxed text-theme-secondary">
                  {instructionPreview}
                  {bot.instructions.length > 140 ? '…' : ''}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                bot.enabled
                  ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700/50'
                  : 'bg-theme-subtle text-theme-muted ring-theme-border'
              }`}
            >
              {bot.enabled ? 'Live' : 'Paused'}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {bot.isDefault && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700/40">
                <Star className="h-2.5 w-2.5" />
                Default
              </span>
            )}
            {bot.businessHoursOnly && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-700/40">
                <Clock className="h-2.5 w-2.5" />
                Hours only
              </span>
            )}
            {triggers.slice(0, 2).map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-800 ring-1 ring-indigo-200/70 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-700/40"
              >
                {kw !== 'All messages' && <Hash className="h-3 w-3" />}
                {kw}
              </span>
            ))}
            {triggers.length > 2 && (
              <span className="text-[10px] font-bold text-theme-muted">+{triggers.length - 2}</span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-700/40">
              <BookOpen className="h-3 w-3" />
              {faqCount} item{faqCount === 1 ? '' : 's'}
            </span>
          </div>

          <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 opacity-0 transition group-hover:opacity-100 dark:text-violet-400">
            Edit bot
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>

      <div className="grid grid-cols-3 gap-2 border-t border-theme-border bg-theme-subtle/40 p-3 sm:p-4">
        <AppButton
          size="sm"
          fullWidth
          variant={bot.enabled ? 'secondary' : 'primary'}
          icon={bot.enabled ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
          onClick={onToggle}
        >
          {bot.enabled ? 'Pause' : 'Activate'}
        </AppButton>
        <AppButton size="sm" fullWidth variant="secondary" icon={<Pencil size={14} />} onClick={onEdit}>
          Edit
        </AppButton>
        <AppButton size="sm" fullWidth variant="danger" icon={<Trash2 size={14} />} onClick={onDelete}>
          Delete
        </AppButton>
      </div>
    </article>
  );
}
