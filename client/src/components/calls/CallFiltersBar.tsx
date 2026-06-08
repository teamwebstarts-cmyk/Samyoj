import SearchInput from '../ui/SearchInput';
import AppSelect from '../ui/AppSelect';

interface CallFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  handler: string;
  onHandlerChange: (value: string) => void;
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
}: CallFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-white/80 px-4 py-2.5">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search phone or name..."
        className="min-w-[160px] flex-1"
      />
      <AppSelect
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        options={statusOptions}
        className="w-[140px]"
      />
      <AppSelect
        value={handler}
        onChange={(e) => onHandlerChange(e.target.value)}
        options={handlerOptions}
        className="w-[140px]"
      />
    </div>
  );
}
