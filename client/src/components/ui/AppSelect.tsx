import {
  Children,
  isValidElement,
  useId,
  useMemo,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import Select from 'react-select';
import { useTheme } from '../../contexts/ThemeContext';
import { createSelectStyles, type SelectOption, type SelectSize } from '../../utils/selectStyles';
import FieldInfoTip from './FieldInfoTip';

export interface AppSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface AppSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'size'> {
  label?: string;
  hint?: string;
  labelInfo?: string;
  error?: string;
  options?: AppSelectOption[];
  placeholder?: string;
  isSearchable?: boolean;
  size?: SelectSize;
  ariaLabel?: string;
  labelClassName?: string;
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

export default function AppSelect({
  label,
  hint,
  labelInfo,
  error,
  className = '',
  id,
  children,
  options: optionsProp,
  placeholder = 'Select an option',
  isSearchable,
  size = 'default',
  ariaLabel,
  labelClassName,
  value = '',
  onChange,
  disabled,
  required,
}: AppSelectProps) {
  const { resolved } = useTheme();
  const autoId = useId();
  const selectId = id || autoId;

  const options = useMemo(
    () => optionsProp ?? optionsFromChildren(children),
    [optionsProp, children],
  );

  const selected = options.find((option) => option.value === value) ?? null;
  const searchable = isSearchable ?? options.length > 6;
  const styles = useMemo(
    () => createSelectStyles(resolved === 'dark', size),
    [resolved, size],
  );

  const emitChange = (nextValue: string) => {
    onChange?.({
      target: { value: nextValue },
    } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <div className={`relative ${label || hint || labelInfo || error ? 'space-y-1.5' : ''} ${className}`}>
      {(label || hint || labelInfo) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label
              htmlFor={selectId}
              className={`inline-flex items-center gap-1.5 ${labelClassName || 'text-[13px] font-semibold text-theme-secondary'}`}
            >
              <span>
                {label}
                {required && <span className="text-red-500"> *</span>}
              </span>
              {labelInfo ? <FieldInfoTip text={labelInfo} /> : null}
            </label>
          )}
          {hint && <span className="text-[11px] font-medium text-theme-muted">{hint}</span>}
        </div>
      )}

      <Select<SelectOption, false>
        inputId={selectId}
        instanceId={selectId}
        aria-label={ariaLabel || label}
        options={options}
        value={selected}
        onChange={(option) => emitChange(option?.value ?? '')}
        placeholder={placeholder}
        isDisabled={disabled}
        isSearchable={searchable}
        isClearable={false}
        styles={styles}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        menuPlacement="auto"
        menuShouldScrollIntoView
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

      {error && <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
