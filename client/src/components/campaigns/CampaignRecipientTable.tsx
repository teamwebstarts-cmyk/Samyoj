import { Users } from 'lucide-react';
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
    <ModalPanel title={`People in campaign (${total})`} icon={Users} accent="neutral">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium text-theme-muted">
          Delivery status for each person in this campaign
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
          No one matches this filter
        </div>
      ) : (
        <DataTable
          headers={['Phone', 'Name', 'Status', 'Sent at', 'Retries', 'Error']}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          minTableWidth="min-w-[760px]"
        >
          {recipients.map((recipient, index) => (
            <tr key={recipient.id} className="group">
              <TableSerialCell page={page} pageSize={pageSize} rowIndex={index} />
              <td>
                <span className="font-mono text-[13px] font-semibold text-theme-fg">
                  {recipient.phone}
                </span>
              </td>
              <td>
                <span className="text-[13px] font-medium text-theme-secondary">
                  {recipient.name || '—'}
                </span>
              </td>
              <td>
                <StatusBadge status={recipient.status} />
              </td>
              <td className="whitespace-nowrap tabular-nums text-[12px] font-medium text-theme-secondary">
                {formatSentAt(recipient.sentAt)}
              </td>
              <td className="tabular-nums text-[13px] font-semibold text-theme-secondary">
                {recipient.retryCount ?? 0}
              </td>
              <td className="max-w-[180px]">
                {recipient.errorMessage ? (
                  <span
                    className="block truncate text-[12px] font-medium text-red-600 dark:text-red-400"
                    title={recipient.errorMessage}
                  >
                    {recipient.errorMessage}
                  </span>
                ) : (
                  <span className="text-[13px] text-theme-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </ModalPanel>
  );
}
