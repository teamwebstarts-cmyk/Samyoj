import SearchInput from '../ui/SearchInput';
import AppSelect from '../ui/AppSelect';

interface CallFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  handler: string;
  onHandlerChange: (value: string) => void;
  totalOnPage?: number;
  liveCount?: number;
}

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'CONNECTED', label: 'Live' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'MISSED', label: 'Missed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'TERMINATED', label: 'Ended' },
];

const handlerOptions = [
  { value: '', label: 'All handlers' },
  { value: 'AI', label: 'AI' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'UNANSWERED', label: 'Unanswered' },
];

export default function CallFiltersBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  handler,
  onHandlerChange,
  totalOnPage = 0,
  liveCount = 0,
}: CallFiltersBarProps) {
  return (
    <div className="inbox-list-header shrink-0 px-4 pb-4 pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[15px] font-bold tracking-tight text-theme-fg">Call history</p>
          <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
            {totalOnPage === 0 ? 'No calls yet' : `${totalOnPage} on this page`}
          </p>
        </div>
        {liveCount > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-whatsapp-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            {liveCount} live
          </span>
        )}
      </div>

      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search phone or name..."
      />

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <AppSelect
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          options={statusOptions}
          placeholder="All statuses"
        />
        <AppSelect
          value={handler}
          onChange={(e) => onHandlerChange(e.target.value)}
          options={handlerOptions}
          placeholder="All handlers"
        />
      </div>
    </div>
  );
}
