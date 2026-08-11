import { AlertCircle, Clock3, RotateCw, Users } from 'lucide-react';
import AppSelect from '../ui/AppSelect';
import DataTable, { TableSerialCell } from '../ui/DataTable';
import { ModalPanel } from '../ui/modalUi';
import StatusBadge from '../ui/StatusBadge';
import type { CampaignRecipient } from '../../types';

interface CampaignRecipientTableProps {
  recipients: CampaignRecipient[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'READ', label: 'Read' },
  { value: 'FAILED', label: 'Failed' },
];

function formatSentAt(iso?: string) {
  if (!iso) return '—';
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
  statusFilter,
  onStatusFilterChange,
}: CampaignRecipientTableProps) {
  return (
    <ModalPanel title={`Campaign recipients (${total})`} icon={Users} accent="neutral">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium text-theme-muted">
          Delivery status for each recipient
        </p>
        <AppSelect
          className="w-40 shrink-0"
          value={statusFilter}
          placeholder="All statuses"
          isSearchable={false}
          options={statusOptions}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        />
      </div>

      {recipients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-theme-border bg-theme-subtle/40 px-4 py-12 text-center text-[13px] font-medium text-theme-muted">
          No recipients match this filter. Try another status or choose All statuses.
        </div>
      ) : (
        <>
        <div className="space-y-2 lg:hidden">
          {recipients.map((recipient) => (
            <article key={recipient.id} className="rounded-xl border border-theme-border bg-theme-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[13px] font-semibold text-theme-fg">{recipient.phone}</p>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-theme-secondary">{recipient.name || 'Unnamed contact'}</p>
                </div>
                <StatusBadge status={recipient.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-theme-muted">
                <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatSentAt(recipient.sentAt)}</span>
                <span className="inline-flex items-center gap-1"><RotateCw className="h-3 w-3" />{recipient.retryCount ?? 0} retries</span>
              </div>
              {recipient.errorMessage && (
                <p className="mt-2 flex gap-1.5 text-[11px] font-medium leading-relaxed text-red-600 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{recipient.errorMessage}
                </p>
              )}
            </article>
          ))}
          <div className="pt-1">
            <p className="mb-2 text-center text-[11px] text-theme-muted">{total.toLocaleString()} recipients</p>
            <div className="flex justify-center">
              <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="min-h-11 rounded-lg border border-theme-border px-3 py-2 text-[11px] font-bold disabled:opacity-40">Previous</button>
              <span className="px-3 py-2 text-[11px] font-semibold text-theme-muted">Page {page}</span>
              <button type="button" disabled={page * pageSize >= total} onClick={() => onPageChange(page + 1)} className="min-h-11 rounded-lg border border-theme-border px-3 py-2 text-[11px] font-bold disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
        <div className="hidden lg:block">
          <DataTable
            headers={['Recipient', 'Status', 'Delivery details']}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            minTableWidth="min-w-[480px]"
          >
            {recipients.map((recipient, index) => (
              <tr key={recipient.id} className="group">
                <TableSerialCell page={page} pageSize={pageSize} rowIndex={index} />
                <td>
                  <p className="font-mono text-[12px] font-semibold text-theme-fg">{recipient.phone}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-theme-secondary">{recipient.name || 'Unnamed contact'}</p>
                </td>
                <td><StatusBadge status={recipient.status} /></td>
                <td className="max-w-[210px]">
                  <p className="text-[11px] font-medium text-theme-secondary">{formatSentAt(recipient.sentAt)} · {recipient.retryCount ?? 0} retries</p>
                  {recipient.errorMessage ? (
                    <span className="mt-0.5 block break-words text-[11px] font-medium text-red-600 dark:text-red-400">{recipient.errorMessage}</span>
                  ) : <span className="text-[11px] text-theme-muted">No error reported</span>}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
        </>
      )}
    </ModalPanel>
  );
}
