import AppSelect from '../ui/AppSelect';
import { leadStageOptions } from './leadUi';

interface LeadStageSelectProps {
  value: string;
  onChange: (stage: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function LeadStageSelect({
  value,
  onChange,
  disabled,
  className = 'w-full min-w-[9rem]',
}: LeadStageSelectProps) {
  return (
    <AppSelect
      className={className}
      value={value}
      options={leadStageOptions}
      onChange={(e) => onChange(e.target.value)}
      isSearchable={false}
      size="compact"
      ariaLabel="Lead stage"
      disabled={disabled}
    />
  );
}
