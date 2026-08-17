import { Sparkles } from 'lucide-react';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import {
  CAMPAIGN_PARAM_SOURCE_OPTIONS,
  buildInboxParamSourceOptions,
  campaignParamMappedHint,
  campaignParamSelectValue,
  inboxParamMappedHint,
  inboxParamSelectValue,
  valueForCampaignParamSource,
  valueForInboxParamSource,
  type CampaignParamSource,
  type ContactParamPreview,
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
  /** When set, show contact-aware suggestions (Inbox composer). */
  contact?: ContactParamPreview;
  labelClassName?: string;
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
  contact,
  labelClassName,
}: TemplateParamFieldProps) {
  const inboxMode = Boolean(contact);
  const source = inboxMode ? inboxParamSelectValue(value) : campaignParamSelectValue(value);
  const options = inboxMode
    ? buildInboxParamSourceOptions(contact)
    : CAMPAIGN_PARAM_SOURCE_OPTIONS;
  const mappedHint = inboxMode
    ? inboxParamMappedHint(source, contact)
    : campaignParamMappedHint(source as CampaignParamSource);

  const handleSourceChange = (nextSource: string) => {
    const nextValue = inboxMode
      ? valueForInboxParamSource(nextSource, value)
      : valueForCampaignParamSource(nextSource as CampaignParamSource, value);
    onChange(nextValue);
    if (!inboxMode) {
      onSourceChange?.(nextSource as CampaignParamSource);
    }
  };

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <AppSelect
        id={id ? `${id}-source` : undefined}
        label={label}
        required={required}
        size={compact ? 'compact' : 'default'}
        value={source}
        options={options}
        isSearchable={inboxMode && options.length > 4}
        labelClassName={labelClassName}
        onChange={(event) => handleSourceChange(event.target.value)}
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
          labelClassName={
            labelClassName ||
            (compact ? 'text-[11px] font-bold text-slate-600 dark:text-slate-300' : undefined)
          }
          className={compact ? '!h-9 rounded-lg text-[12px]' : undefined}
          aria-label={`${label} — custom value`}
        />
      )}
    </div>
  );
}
