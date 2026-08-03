import { useState } from 'react';
import { BarChart3, Bell, Download, LifeBuoy, UserPlus, type LucideIcon } from 'lucide-react';
import SnoozePopover from '../SnoozePopover';

interface QuickActionsProps {
  onAssignAgent: () => void;
  onCreateCampaign: () => void;
  onCreateTicket: () => void;
  onExport: () => void;
  snoozedUntil?: string | null;
  onSnooze: (untilIso: string, label: string) => void;
  onUnsnooze: () => void;
}

function ActionRow({
  icon: Icon,
  label,
  iconClassName,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  iconClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-theme-subtle"
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${iconClassName}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.1} />
      </span>
      <span className="text-[13px] font-semibold text-theme-fg">{label}</span>
    </button>
  );
}

export default function QuickActions({
  onAssignAgent,
  onCreateCampaign,
  onCreateTicket,
  onExport,
  snoozedUntil,
  onSnooze,
  onUnsnooze,
}: QuickActionsProps) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const isSnoozed = Boolean(snoozedUntil && new Date(snoozedUntil).getTime() > Date.now());

  return (
    <div className="space-y-0.5">
      <ActionRow
        icon={UserPlus}
        label="Assign Agent"
        iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
        onClick={onAssignAgent}
      />
      <ActionRow
        icon={BarChart3}
        label="Create Campaign"
        iconClassName="bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
        onClick={onCreateCampaign}
      />
      <ActionRow
        icon={LifeBuoy}
        label="Create Ticket"
        iconClassName="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
        onClick={onCreateTicket}
      />
      <ActionRow
        icon={Download}
        label="Export Chat"
        iconClassName="bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
        onClick={onExport}
      />
      <div className="relative">
        <ActionRow
          icon={Bell}
          label={isSnoozed ? 'Snoozed — manage' : 'Snooze Chat'}
          iconClassName="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
          onClick={() => setSnoozeOpen((v) => !v)}
        />
        {snoozeOpen && (
          <SnoozePopover
            snoozedUntil={snoozedUntil}
            onSnooze={onSnooze}
            onUnsnooze={onUnsnooze}
            onClose={() => setSnoozeOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
