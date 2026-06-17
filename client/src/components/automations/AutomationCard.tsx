import { Hash, PauseCircle, PlayCircle, Pencil, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppButton from '../ui/AppButton';
import { WhatsAppMessagePreview } from '../inbox/WhatsAppPreview';
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
}

export default function AutomationCard({
  automation,
  meta,
  onEdit,
  onToggle,
  onDelete,
}: AutomationCardProps) {
  const Icon = meta.icon;
  const config = automation.config as Record<string, string>;
  const message = config.message || '';

  return (
    <article className="dashboard-card overflow-hidden p-0 transition hover:shadow-panel">
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-start gap-3 p-4 text-left active:bg-neutral-50/50 sm:gap-4 sm:p-5"
      >
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12 ${meta.iconBg}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[15px] font-extrabold tracking-tight text-neutral-900 sm:text-base">
              {automation.name}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                automation.enabled
                  ? 'bg-emerald-100 text-emerald-800 ring-emerald-200/70'
                  : 'bg-neutral-100 text-neutral-500 ring-neutral-200/70'
              }`}
            >
              {automation.enabled ? 'On' : 'Off'}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.badge}`}
            >
              {meta.label}
            </span>
            {automation.triggerType === 'KEYWORD' && config.keyword && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100">
                <Hash className="h-3 w-3" />
                {config.keyword}
              </span>
            )}
          </div>

          {message && (
            <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-neutral-200/70">
              <WhatsAppMessagePreview content={message} direction="outbound" variant="compact" />
            </div>
          )}
        </div>
      </button>

      <div className="grid grid-cols-3 gap-2 border-t border-neutral-100/80 bg-neutral-50/40 p-3 sm:p-4">
        <AppButton
          size="sm"
          fullWidth
          variant={automation.enabled ? 'secondary' : 'primary'}
          icon={automation.enabled ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
          onClick={onToggle}
        >
          {automation.enabled ? 'Turn off' : 'Turn on'}
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
