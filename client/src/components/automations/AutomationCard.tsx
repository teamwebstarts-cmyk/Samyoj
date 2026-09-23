import { Hash, PauseCircle, PlayCircle, Pencil, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppButton from '../ui/AppButton';
import type { Automation } from '../../types';

interface TriggerVisual {
  label: string;
  icon: LucideIcon;
  iconBg: string;
  badge: string;
}

interface AutomationCardProps {
  automation: Automation;
  meta: TriggerVisual;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  canManage?: boolean;
}

export default function AutomationCard({
  automation,
  meta,
  onEdit,
  onToggle,
  onDelete,
  canManage = true,
}: AutomationCardProps) {
  const Icon = meta.icon;
  const config = automation.config as Record<string, string>;
  const isBusinessHours = automation.triggerType === 'BUSINESS_HOURS';
  const duringMessage = config.duringHoursMessage || config.message || '';
  const awayMessage = config.awayMessage || '';
  const message = isBusinessHours ? duringMessage : config.message || '';
  const preview = isBusinessHours && awayMessage
    ? `${message} · After hours: ${awayMessage}`
    : message;

  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button
        type="button"
        onClick={onEdit}
        disabled={!canManage}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}>
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[13px] font-bold text-theme-fg">{automation.name}</h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                automation.enabled
                  ? 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20 dark:text-emerald-300'
                  : 'bg-theme-subtle text-theme-muted ring-theme-border'
              }`}
            >
              {automation.enabled ? 'On' : 'Off'}
            </span>
          </div>

          {preview && (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-theme-muted">{preview}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.badge}`}
            >
              {meta.label}
            </span>
            {automation.triggerType === 'KEYWORD' && config.keyword && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300">
                <Hash className="h-3 w-3" />
                {config.keyword}
              </span>
            )}
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                config.platform === 'IG'
                  ? 'bg-[#E4405F]/10 text-[#C13584] ring-[#E4405F]/20'
                  : 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20'
              }`}
            >
              {config.platform === 'IG' ? 'Instagram' : 'WhatsApp'}
            </span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
        <AppButton
          size="sm"
          className="flex-1"
          variant={automation.enabled ? 'secondary' : 'primary'}
          icon={automation.enabled ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
          onClick={onToggle}
          disabled={!canManage}
        >
          {automation.enabled ? 'Turn off' : 'Turn on'}
        </AppButton>
        <AppButton size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={onEdit} disabled={!canManage}>
          Edit
        </AppButton>
        <AppButton size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={onDelete} aria-label="Delete" disabled={!canManage} />
      </div>
    </article>
  );
}
