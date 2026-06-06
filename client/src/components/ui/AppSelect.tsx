import {
  Children,
  isValidElement,
  useId,
  useMemo,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import Select, { type GroupBase, type StylesConfig } from 'react-select';

export interface AppSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface AppSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label?: string;
  hint?: string;
  error?: string;
  options?: AppSelectOption[];
  placeholder?: string;
  isSearchable?: boolean;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  value?: string;
}

function optionsFromChildren(children: ReactNode): AppSelectOption[] {
  const options: AppSelectOption[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === 'option') {
      const props = child.props as { value?: string; disabled?: boolean; children?: ReactNode };
      options.push({
        value: String(props.value ?? ''),
        label: String(props.children ?? props.value ?? ''),
        disabled: props.disabled,
      });
    }
  });
  return options;
}

const selectStyles: StylesConfig<AppSelectOption, false, GroupBase<AppSelectOption>> = {
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderRadius: 12,
    borderColor: state.isFocused ? '#128C7E' : 'rgba(229, 231, 235, 0.9)',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(37, 211, 102, 0.15)' : 'none',
    backgroundColor: '#ffffff',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    '&:hover': {
      borderColor: state.isFocused ? '#128C7E' : '#d1d5db',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '0 12px',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9ca3af',
    fontSize: 14,
  }),
  singleValue: (base) => ({
    ...base,
    color: '#171717',
    fontSize: 14,
    fontWeight: 500,
  }),
  input: (base) => ({
    ...base,
    color: '#171717',
    fontSize: 14,
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? '#128C7E' : '#9ca3af',
    paddingRight: 12,
    '&:hover': { color: '#128C7E' },
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999,
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid rgba(229, 231, 235, 0.9)',
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
  }),
  menuList: (base) => ({
    ...base,
    padding: 6,
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: state.isSelected ? 600 : 500,
    color: state.isSelected ? '#065f46' : '#171717',
    backgroundColor: state.isSelected
      ? 'rgba(209, 250, 229, 0.95)'
      : state.isFocused
        ? 'rgba(240, 253, 244, 0.95)'
        : 'transparent',
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    '&:active': {
      backgroundColor: 'rgba(209, 250, 229, 0.85)',
    },
  }),
};

export default function AppSelect({
  label,
  hint,
  error,
  className = '',
  id,
  children,
  options: optionsProp,
  placeholder = 'Select an option',
  isSearchable,
  value = '',
  onChange,
  disabled,
  required,
}: AppSelectProps) {
  const autoId = useId();
  const selectId = id || autoId;

  const options = useMemo(
    () => optionsProp ?? optionsFromChildren(children),
    [optionsProp, children],
  );

  const selected = options.find((option) => option.value === value) ?? null;
  const searchable = isSearchable ?? options.length > 6;

  const emitChange = (nextValue: string) => {
    onChange?.({
      target: { value: nextValue },
    } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <div className={`relative space-y-1.5 ${className}`}>
      {(label || hint) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={selectId} className="text-[13px] font-semibold text-neutral-700">
              {label}
              {required && <span className="text-red-500"> *</span>}
            </label>
          )}
          {hint && <span className="text-[11px] font-medium text-neutral-500">{hint}</span>}
        </div>
      )}

      <Select<AppSelectOption, false>
        inputId={selectId}
        instanceId={selectId}
        options={options}
        value={selected}
        onChange={(option) => emitChange(option?.value ?? '')}
        placeholder={placeholder}
        isDisabled={disabled}
        isSearchable={searchable}
        isClearable={false}
        styles={selectStyles}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        classNamePrefix="app-select"
        noOptionsMessage={() => 'No options found'}
      />

      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          value={value}
          required
          onChange={() => undefined}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}

      {error && <p className="text-[12px] font-medium text-red-600">{error}</p>}
    </div>
  );
}
