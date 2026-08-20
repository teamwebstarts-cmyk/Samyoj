import { Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import ContactAvatar from '../inbox/ContactAvatar';
import StatusBadge from '../ui/StatusBadge';
import LeadStageSelect from './LeadStageSelect';
import { leadStageLabel, stageLabels } from './leadUi';

export interface LeadItem {
  id: string;
  title: string;
  stage: string;
  source?: string | null;
  updatedAt: string;
  contact?: { id: string; name?: string | null; phone: string } | null;
  assignedAgent?: { id: string; name: string } | null;
  notes?: string | null;
}

const PIPELINE_STEPS = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON'];

function stageProgressIndex(stage: string) {
  if (stage === 'LOST') return -1;
  return PIPELINE_STEPS.indexOf(stage);
}

interface LeadCardProps {
  lead: LeadItem;
  onStageChange: (lead: LeadItem, stage: string) => void;
  onEdit: () => void;
  formatDate: (value: string) => string;
  updating?: boolean;
}

export default function LeadCard({ lead, onStageChange, formatDate, updating, onEdit }: LeadCardProps) {
  const contactLabel = lead.contact?.name || lead.contact?.phone;
  const progressIndex = stageProgressIndex(lead.stage);

  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <div className="flex items-start gap-3 px-4 py-3.5">
        {lead.contact ? (
          <ContactAvatar name={lead.contact.name || undefined} phone={lead.contact.phone} size="md" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
            <Target className="h-4 w-4" strokeWidth={2.25} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-theme-fg">{lead.title}</p>
          {contactLabel && lead.contact && (
            <Link
              to="/contacts"
              className="mt-0.5 block truncate text-[11px] font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              {contactLabel}
            </Link>
          )}
          <p className="mt-1 text-[11px] text-theme-muted">Updated {formatDate(lead.updatedAt)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={lead.stage} label={leadStageLabel(lead.stage)} />
            <span className="text-[11px] font-medium text-theme-secondary">
              {lead.assignedAgent?.name || 'Unassigned'}
            </span>
          </div>
          {progressIndex >= 0 && (
            <div className="mt-2.5 flex gap-0.5">
              {PIPELINE_STEPS.map((step, i) => (
                <div
                  key={step}
                  className={`h-1 flex-1 rounded-full ${
                    i <= progressIndex ? 'bg-whatsapp-500' : 'bg-theme-subtle'
                  }`}
                  title={stageLabels[step]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5 flex items-center justify-between">
        <LeadStageSelect
          value={lead.stage}
          disabled={updating}
          onChange={(next) => {
            if (next !== lead.stage) onStageChange(lead, next);
          }}
        />
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center rounded-xl p-1.5 text-[11px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg"
          aria-label={`Edit ${lead.title}`}
        >
          Edit
        </button>
      </div>
    </article>
  );
}
