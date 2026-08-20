import AppSelect, { type AppSelectOption } from '../ui/AppSelect';

export type StatusFilter = '' | 'active' | 'paused' | 'default';

const STATUS_OPTIONS: AppSelectOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Live' },
  { value: 'paused', label: 'Paused' },
  { value: 'default', label: 'Default' },
];

interface AiBotStatusFilterProps {
  value: string;
  onChange: (value: StatusFilter) => void;
  className?: string;
}

/** Dropdown status filter for AI bots toolbar. */
export default function AiBotStatusFilter({
  value,
  onChange,
  className = 'w-full sm:w-[136px]',
}: AiBotStatusFilterProps) {
  return (
    <AppSelect
      className={className}
      value={value}
      placeholder="All statuses"
      isSearchable={false}
      options={STATUS_OPTIONS}
      onChange={(e) => onChange(e.target.value as StatusFilter)}
      ariaLabel="Filter bots by status"
    />
  );
}
