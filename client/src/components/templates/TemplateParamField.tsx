import { Sparkles } from 'lucide-react';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import {
  CAMPAIGN_PARAM_SOURCE_OPTIONS,
  campaignParamMappedHint,
  campaignParamSelectValue,
  valueForCampaignParamSource,
  type CampaignParamSource,
} from '../../utils/templateForm';

interface TemplateParamFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSourceChange?: (source: CampaignParamSource) => void;
  placeholder?: string;
  required?: boolean;
  compact?: boolean;
}

export default function TemplateParamField({
  id,
  label,
  value,
  onChange,
  onSourceChange,
  placeholder = 'Enter a value',
  required,
  compact,
}: TemplateParamFieldProps) {
  const source = campaignParamSelectValue(value);
  const mappedHint = campaignParamMappedHint(source);

  const handleSourceChange = (nextSource: CampaignParamSource) => {
    onChange(valueForCampaignParamSource(nextSource, value));
    onSourceChange?.(nextSource);
  };

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <AppSelect
        id={id ? `${id}-source` : undefined}
        label={label}
        required={required}
        size={compact ? 'compact' : 'default'}
        value={source}
        options={CAMPAIGN_PARAM_SOURCE_OPTIONS}
        isSearchable={false}
        onChange={(event) => handleSourceChange(event.target.value as CampaignParamSource)}
      />
      {mappedHint ? (
        <p className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          {mappedHint}
        </p>
      ) : (
        <AppInput
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          labelClassName={compact ? 'text-[11px] font-bold text-slate-600 dark:text-slate-300' : undefined}
          className={compact ? '!h-9 rounded-lg text-[12px]' : undefined}
        />
      )}
    </div>
  );
}
