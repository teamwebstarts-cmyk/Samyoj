import { AlertCircle, Users } from 'lucide-react';
import DataTable, { TableSerialCell } from '../ui/DataTable';
import StatusBadge from '../ui/StatusBadge';
import type { CampaignRecipient } from '../../types';
import { getRecipientStatusLabel } from './campaignUi';
import { formatRecipientError } from '../../utils/plainLanguage';

interface CampaignRecipientTableProps {
  recipients: CampaignRecipient[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  /** Compact mode hides filters and extra columns — for failed-only views */
  compact?: boolean;
  title?: string;
}

function formatSentAt(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CampaignRecipientTable({
  recipients,
  total,
  page,
  pageSize,
  onPageChange,
  statusFilter = '',
  compact = false,
  title,
}: CampaignRecipientTableProps) {
  const heading = title || (compact ? `Failed deliveries (${total})` : `Recipients (${total})`);

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <h3 className="text-[13px] font-extrabold text-slate-900 dark:text-white">{heading}</h3>
        </div>
      </div>

      {recipients.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] font-medium text-slate-500 dark:text-slate-400">
          {statusFilter === 'FAILED' ? 'No failed deliveries.' : 'No recipients to show.'}
        </p>
      ) : (
        <>
          <div className="space-y-2 p-3 lg:hidden">
            {recipients.map((recipient) => (
              <article
                key={recipient.id}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px] font-semibold text-slate-900 dark:text-white">
                      {recipient.phone}
                    </p>
                    {recipient.name && (
                      <p className="mt-0.5 truncate text-[12px] text-slate-500">{recipient.name}</p>
                    )}
                  </div>
                  <StatusBadge
                    status={recipient.status}
                    label={getRecipientStatusLabel(recipient.status)}
                    className="normal-case tracking-normal"
                  />
                </div>
                {recipient.errorMessage && (
                  <p className="mt-2 flex gap-1.5 text-[11px] font-medium leading-snug text-red-600 dark:text-red-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {formatRecipientError(recipient.errorMessage)}
                  </p>
                )}
              </article>
            ))}
          </div>
          <div className="hidden lg:block">
            <DataTable
              headers={compact ? ['Contact', 'Status'] : ['Contact', 'Status', 'Note']}
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
              minTableWidth="min-w-[320px]"
            >
              {recipients.map((recipient, index) => (
                <tr key={recipient.id} className="group">
                  <TableSerialCell page={page} pageSize={pageSize} rowIndex={index} />
                  <td>
                    <p className="font-mono text-[12px] font-semibold text-slate-900 dark:text-white">
                      {recipient.phone}
                    </p>
                    {recipient.name && (
                      <p className="mt-0.5 text-[11px] text-slate-500">{recipient.name}</p>
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      status={recipient.status}
                      label={getRecipientStatusLabel(recipient.status)}
                      className="normal-case tracking-normal"
                    />
                  </td>
                  {!compact && (
                    <td className="max-w-[200px]">
                      {recipient.errorMessage ? (
                        <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
                          {formatRecipientError(recipient.errorMessage)}
                        </span>
                      ) : recipient.sentAt ? (
                        <span className="text-[11px] text-slate-500">{formatSentAt(recipient.sentAt)}</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </DataTable>
          </div>
        </>
      )}
    </section>
  );
}
