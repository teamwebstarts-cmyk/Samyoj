import AppSelect from '../ui/AppSelect';

export const campaignStatusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface CampaignStatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const filterSelectClass =
  'w-full min-w-0 shrink-0 sm:w-[10.25rem] sm:max-w-[10.25rem] [&_.app-select__control]:!w-full [&_.app-select__single-value]:!max-w-none';

export default function CampaignStatusFilter({ value, onChange }: CampaignStatusFilterProps) {
  return (
    <AppSelect
      className={filterSelectClass}
      size="compact"
      value={value}
      placeholder="All statuses"
      ariaLabel="Filter by campaign status"
      isSearchable={false}
      options={campaignStatusFilterOptions}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
