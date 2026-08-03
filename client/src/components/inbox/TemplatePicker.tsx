import { useId, useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Select, {
  components,
  type DropdownIndicatorProps,
  type FormatOptionLabelMeta,
  type GroupBase,
  type OptionProps,
  type SingleValueProps,
  type StylesConfig,
} from 'react-select';
import { useTheme } from '../../contexts/ThemeContext';
import type { MessageTemplate } from '../../types';

export interface TemplatePickerOption {
  value: string;
  label: string;
  language: string;
}

interface TemplatePickerProps {
  templates: MessageTemplate[];
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

function formatLanguageCode(code: string): string {
  const normalized = code.replace(/_/g, '-');
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'language' }).of(normalized.split('-')[0] ?? normalized);
    const region = normalized.includes('-') ? normalized.split('-')[1]?.toUpperCase() : '';
    return region && display ? `${display} · ${region}` : display ?? code;
  } catch {
    return code;
  }
}

function formatOptionLabel(
  option: TemplatePickerOption,
  meta: FormatOptionLabelMeta<TemplatePickerOption>,
) {
  const inMenu = meta.context === 'menu';
  const langLabel = formatLanguageCode(option.language);

  if (!inMenu) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-theme-fg">{option.label}</span>
        <span className="shrink-0 rounded-md bg-theme-subtle px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-theme-muted ring-1 ring-theme-border/80">
          {option.language}
        </span>
      </span>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5 py-0.5">
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-[13px] font-semibold text-theme-fg">{option.label}</p>
        <p className="truncate text-[11px] font-medium text-theme-muted">{langLabel}</p>
      </div>
    </div>
  );
}

function TemplateOption(props: OptionProps<TemplatePickerOption, false>) {
  const langLabel = formatLanguageCode(props.data.language);
  return (
    <components.Option {...props}>
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1 overflow-hidden py-0.5">
          <p className="truncate text-[13px] font-semibold text-theme-fg">{props.data.label}</p>
          <p className="truncate text-[11px] font-medium text-theme-muted">{langLabel}</p>
        </div>
        {props.isSelected ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
      </div>
    </components.Option>
  );
}

function TemplateSingleValue(props: SingleValueProps<TemplatePickerOption, false>) {
  return (
    <components.SingleValue {...props}>
      {formatOptionLabel(props.data, { context: 'value', inputValue: '', selectValue: [] })}
    </components.SingleValue>
  );
}

function createStyles(isDark: boolean): StylesConfig<TemplatePickerOption, false, GroupBase<TemplatePickerOption>> {
  const surface = isDark ? '#151d2b' : '#ffffff';
  const border = isDark ? 'rgba(51, 65, 85, 0.65)' : 'rgba(229, 231, 235, 0.95)';

  return {
    container: (base) => ({ ...base, width: '100%', minWidth: 0 }),
    control: (base, state) => ({
      ...base,
      minHeight: 36,
      height: 36,
      minWidth: 0,
      borderRadius: 10,
      borderColor: state.isFocused ? (isDark ? '#64748b' : '#94a3b8') : border,
      backgroundColor: surface,
      boxShadow: state.isFocused
        ? isDark
          ? '0 0 0 3px rgba(148, 163, 184, 0.18), 0 1px 2px rgba(15, 23, 42, 0.04)'
          : '0 0 0 3px rgba(100, 116, 139, 0.14), 0 1px 2px rgba(15, 23, 42, 0.04)'
        : '0 1px 2px rgba(15, 23, 42, 0.03)',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      transition: 'border-color 160ms ease, box-shadow 160ms ease',
      '&:hover': {
        borderColor: state.isFocused
          ? isDark
            ? '#64748b'
            : '#94a3b8'
          : isDark
            ? '#475569'
            : '#d1d5db',
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0 10px',
      flexWrap: 'nowrap',
      overflow: 'hidden',
      minWidth: 0,
    }),
    placeholder: (base) => ({
      ...base,
      color: isDark ? '#64748b' : '#9ca3af',
      fontSize: 13,
      fontWeight: 500,
    }),
    singleValue: (base) => ({
      ...base,
      color: isDark ? '#f1f5f9' : '#171717',
      margin: 0,
      maxWidth: '100%',
      position: 'static',
      transform: 'none',
    }),
    input: (base) => ({
      ...base,
      color: isDark ? '#f1f5f9' : '#171717',
      fontSize: 13,
      margin: 0,
      padding: 0,
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? (isDark ? '#94a3b8' : '#64748b') : '#94a3b8',
      paddingRight: 8,
      paddingLeft: 2,
      flexShrink: 0,
      transition: 'transform 160ms ease, color 160ms ease',
      transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : undefined,
      '&:hover': { color: isDark ? '#94a3b8' : '#64748b' },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${border}`,
      backgroundColor: surface,
      boxShadow: isDark
        ? '0 18px 40px rgba(0, 0, 0, 0.45)'
        : '0 18px 40px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
      marginTop: 6,
      marginBottom: 6,
    }),
    menuList: (base) => ({
      ...base,
      padding: 6,
    }),
    option: (base, state) => ({
      ...base,
      borderRadius: 10,
      padding: '7px 10px',
      color: isDark ? '#f1f5f9' : '#171717',
      backgroundColor: state.isSelected
        ? isDark
          ? 'rgba(6, 78, 59, 0.45)'
          : 'rgba(209, 250, 229, 0.95)'
        : state.isFocused
          ? isDark
            ? 'rgba(6, 78, 59, 0.25)'
            : 'rgba(240, 253, 244, 0.95)'
          : 'transparent',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: isDark ? 'rgba(6, 78, 59, 0.55)' : 'rgba(167, 243, 208, 0.85)',
      },
    }),
    noOptionsMessage: (base) => ({
      ...base,
      fontSize: 13,
      fontWeight: 500,
      color: isDark ? '#64748b' : '#6b7280',
    }),
  };
}

function DropdownIndicator(props: DropdownIndicatorProps<TemplatePickerOption, false>) {
  return (
    <components.DropdownIndicator {...props}>
      <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
    </components.DropdownIndicator>
  );
}

export default function TemplatePicker({
  templates,
  value,
  onChange,
  disabled,
  label = 'Approved template',
  placeholder = 'Search templates…',
}: TemplatePickerProps) {
  const autoId = useId();
  const { resolved } = useTheme();

  const options = useMemo<TemplatePickerOption[]>(
    () =>
      templates.map((t) => ({
        value: t.name,
        label: t.name,
        language: t.language,
      })),
    [templates],
  );

  const selected = options.find((o) => o.value === value) ?? null;
  const searchable = options.length > 4;
  const styles = useMemo(() => createStyles(resolved === 'dark'), [resolved]);

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={autoId} className="text-[11px] font-semibold text-theme-secondary">
          {label}
        </label>
      ) : null}
      <Select<TemplatePickerOption, false>
        inputId={autoId}
        instanceId={autoId}
        aria-label={label}
        options={options}
        value={selected}
        onChange={(option) => onChange(option?.value ?? '')}
        placeholder={placeholder}
        isDisabled={disabled}
        isSearchable={searchable}
        isClearable={false}
        styles={styles}
        formatOptionLabel={formatOptionLabel}
        components={{
          Option: TemplateOption,
          SingleValue: TemplateSingleValue,
          DropdownIndicator,
        }}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        menuPlacement="top"
        maxMenuHeight={280}
        menuShouldScrollIntoView={false}
        classNamePrefix="template-picker"
        classNames={{
          menuList: () => 'inbox-combobox-scroll',
        }}
        noOptionsMessage={() => 'No templates found'}
        filterOption={(candidate, input) => {
          const q = input.trim().toLowerCase();
          if (!q) return true;
          const opt = candidate.data as TemplatePickerOption;
          return (
            opt.label.toLowerCase().includes(q) ||
            opt.language.toLowerCase().includes(q) ||
            formatLanguageCode(opt.language).toLowerCase().includes(q)
          );
        }}
      />
    </div>
  );
}
