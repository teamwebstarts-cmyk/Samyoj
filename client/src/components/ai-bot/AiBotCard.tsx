import {
  BookOpen,
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
import { AiBotStatusCell } from './AiBotListCells';
import { botChip, getAiBotAvatar } from './aiBotVisuals';

interface AiBotCardProps {
  bot: AiBot;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

export default function AiBotCard({ bot, onEdit, onToggle, onDelete }: AiBotCardProps) {
  const faqCount = bot._count?.knowledgeItems ?? 0;
  const triggers = bot.triggerKeywords;
  const instructionPreview = bot.instructions.trim();
  const avatar = getAiBotAvatar(bot.id, bot.enabled);
  const AvatarIcon = avatar.Icon;

  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <div className="relative shrink-0">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${avatar.className}`}>
            <AvatarIcon className="h-4 w-4" strokeWidth={2.25} />
          </div>
          {bot.enabled && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-neutral-950" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h3 className="truncate text-[13px] font-bold text-theme-fg">{bot.name}</h3>
              {bot.isDefault && (
                <span className={`${botChip.base} ${botChip.default}`}>
                  <Star className="h-2.5 w-2.5" />
                  Default
                </span>
              )}
              {bot.businessHoursOnly && (
                <span className={`${botChip.base} ${botChip.hours}`}>
                  <Clock className="h-2.5 w-2.5" />
                  Hours
                </span>
              )}
            </div>
            <AiBotStatusCell enabled={bot.enabled} />
          </div>

          {instructionPreview && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-theme-muted">
              {instructionPreview}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {triggers.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                {triggers.slice(0, 3).map((kw) => (
                  <span
                    key={kw}
                    className={`${botChip.base} normal-case tracking-normal ${botChip.keyword}`}
                  >
                    <Hash className="h-3 w-3 opacity-70" />
                    {kw}
                  </span>
                ))}
                {triggers.length > 3 && (
                  <span className="text-[10px] font-bold text-theme-muted">
                    +{triggers.length - 3}
                  </span>
                )}
              </div>
            ) : bot.isDefault ? (
              <span className="text-[11px] font-semibold text-theme-secondary">All messages</span>
            ) : null}

            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-theme-secondary">
              <BookOpen className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              {faqCount > 0
                ? `${faqCount.toLocaleString()} ${faqCount === 1 ? 'FAQ' : 'FAQs'}`
                : 'No FAQs'}
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
