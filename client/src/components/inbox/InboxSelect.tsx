import { useId, useMemo, type ChangeEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import Select, {
  components,
  type ControlProps,
  type DropdownIndicatorProps,
  type FormatOptionLabelMeta,
  type GroupBase,
  type StylesConfig,
} from 'react-select';
import { getAvatarGradient, getInitials } from './inboxUtils';

export interface InboxSelectOption {
  value: string;
  label: string;
  description?: string;
  dotColor?: string;
  avatarKey?: string;
  accent?: 'mine' | 'muted';
}

type InboxSelectVariant = 'filter' | 'assign';

interface InboxSelectProps {
  variant?: InboxSelectVariant;
  icon?: LucideIcon;
  value?: string;
  options: InboxSelectOption[];
  placeholder?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  isSearchable?: boolean;
  className?: string;
  ariaLabel?: string;
}

function OptionDot({ color }: { color: string }) {
  return (
    <span
      className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
      style={{ backgroundColor: color }}
    />
  );
}

function OptionAvatar({
  label,
  avatarKey,
  unassigned,
  compact = false,
}: {
  label: string;
  avatarKey?: string;
  unassigned?: boolean;
  compact?: boolean;
}) {
  const sizeClass = compact ? 'h-7 w-7 text-[9px] rounded-lg' : 'h-8 w-8 text-[10px] rounded-xl';

  if (unassigned) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center border border-dashed border-neutral-300/90 bg-neutral-50/90 ${sizeClass}`}
      >
        <span className={`font-bold text-neutral-400 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>—</span>
      </span>
    );
  }

  const key = avatarKey || label;
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white shadow-[0_2px_8px_rgba(15,23,42,0.12)] ${sizeClass} ${getAvatarGradient(key)}`}
    >
      {getInitials(label, avatarKey)}
    </span>
  );
}

function formatOptionLabel(
  option: InboxSelectOption,
  meta: FormatOptionLabelMeta<InboxSelectOption>
) {
  const inMenu = meta.context === 'menu';

  if (option.dotColor) {
    return (
      <div className="flex items-center gap-2.5">
        <OptionDot color={option.dotColor} />
        <span className="text-[13px] font-semibold text-neutral-800">{option.label}</span>
      </div>
    );
  }

  if (option.avatarKey || (option.value === '' && option.description)) {
    return (
      <div className={`flex items-center gap-2.5 ${inMenu ? 'py-0.5' : ''}`}>
        <OptionAvatar
          label={option.label}
          avatarKey={option.avatarKey}
          unassigned={!option.value}
          compact={!inMenu}
        />
        <div className="min-w-0">
          <p
            className={`truncate ${inMenu ? 'text-[13px] font-semibold text-neutral-900' : 'text-[13px] font-semibold text-neutral-800'}`}
          >
            {option.label}
          </p>
          {inMenu && option.description && (
            <p className="truncate text-[11px] font-medium text-neutral-500">{option.description}</p>
          )}
        </div>
        {option.accent === 'mine' && inMenu && (
          <span className="ml-auto shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
            You
          </span>
        )}
      </div>
    );
  }

  return <span className="text-[13px] font-semibold text-neutral-800">{option.label}</span>;
}

function createStyles(
  variant: InboxSelectVariant,
  hasSelection: boolean
): StylesConfig<InboxSelectOption, false, GroupBase<InboxSelectOption>> {
  const isAssign = variant === 'assign';
  const controlHeight = isAssign ? 40 : 38;

  return {
    control: (base, state) => ({
      ...base,
      minHeight: controlHeight,
      height: isAssign ? controlHeight : base.height,
      borderRadius: 12,
      borderColor: state.isFocused
        ? '#128C7E'
        : isAssign && hasSelection
          ? 'rgba(167, 243, 208, 0.95)'
          : 'rgba(229, 231, 235, 0.95)',
      backgroundColor: isAssign && hasSelection ? 'rgba(236, 253, 245, 0.72)' : '#ffffff',
      boxShadow: state.isFocused
        ? '0 0 0 3px rgba(37, 211, 102, 0.14), 0 4px 14px rgba(15, 23, 42, 0.06)'
        : isAssign && hasSelection
          ? '0 2px 10px rgba(37, 211, 102, 0.08)'
          : '0 1px 2px rgba(15, 23, 42, 0.04)',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      transition: 'border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
      '&:hover': {
        borderColor: state.isFocused ? '#128C7E' : isAssign && hasSelection ? '#6ee7b7' : '#d1d5db',
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: isAssign ? '0 8px 0 4px' : '0 10px 0 12px',
    }),
    placeholder: (base) => ({
      ...base,
      color: '#9ca3af',
      fontSize: 13,
      fontWeight: 500,
    }),
    singleValue: (base) => ({
      ...base,
      color: '#171717',
      margin: 0,
    }),
    input: (base) => ({
      ...base,
      color: '#171717',
      fontSize: 13,
      margin: 0,
      padding: 0,
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? '#128C7E' : '#94a3b8',
      paddingRight: isAssign ? 10 : 8,
      paddingLeft: 4,
      transition: 'transform 160ms ease, color 160ms ease',
      transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : undefined,
      '&:hover': { color: '#128C7E' },
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    menu: (base) => ({
      ...base,
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(229, 231, 235, 0.95)',
      boxShadow:
        '0 18px 40px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
      marginTop: 8,
      marginBottom: 8,
    }),
    menuList: (base) => ({
      ...base,
      padding: 6,
      maxHeight: 280,
    }),
    option: (base, state) => ({
      ...base,
      borderRadius: 10,
      padding: '8px 10px',
      backgroundColor: state.isSelected
        ? 'rgba(209, 250, 229, 0.95)'
        : state.isFocused
          ? 'rgba(240, 253, 244, 0.95)'
          : 'transparent',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      '&:active': {
        backgroundColor: 'rgba(167, 243, 208, 0.85)',
      },
    }),
    noOptionsMessage: (base) => ({
      ...base,
      fontSize: 13,
      fontWeight: 500,
      color: '#6b7280',
    }),
  };
}

export default function InboxSelect({
  variant = 'filter',
  icon: Icon,
  value = '',
  options,
  placeholder = 'Select...',
  onChange,
  disabled,
  loading,
  isSearchable,
  className = '',
  ariaLabel,
}: InboxSelectProps) {
  const autoId = useId();
  const selected = options.find((option) => option.value === value) ?? null;
  const searchable = isSearchable ?? options.length > 6;
  const hasSelection = Boolean(value);
  const styles = useMemo(() => createStyles(variant, hasSelection), [variant, hasSelection]);

  const emitChange = (nextValue: string) => {
    onChange?.({
      target: { value: nextValue },
    } as ChangeEvent<HTMLSelectElement>);
  };

  const Control = useMemo(() => {
    return function InboxControl(props: ControlProps<InboxSelectOption, false>) {
      const showIcon = variant === 'filter' && Icon;
      return (
        <components.Control {...props}>
          {showIcon && (
            <span className="pointer-events-none ml-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-500 ring-1 ring-neutral-200/70">
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
          )}
          {props.children}
        </components.Control>
      );
    };
  }, [Icon, variant]);

  const DropdownIndicator = useMemo(() => {
    return function InboxDropdownIndicator(
      props: DropdownIndicatorProps<InboxSelectOption, false>
    ) {
      if (loading) {
        return (
          <div className="flex items-center pr-2.5">
            <Loader2 className="h-4 w-4 animate-spin text-whatsapp-600" />
          </div>
        );
      }
      return <components.DropdownIndicator {...props} />;
    };
  }, [loading]);

  return (
    <div className={className}>
      <Select<InboxSelectOption, false>
        inputId={autoId}
        instanceId={autoId}
        aria-label={ariaLabel}
        options={options}
        value={selected}
        onChange={(option) => emitChange(option?.value ?? '')}
        placeholder={placeholder}
        isDisabled={disabled || loading}
        isSearchable={searchable}
        isClearable={false}
        styles={styles}
        formatOptionLabel={formatOptionLabel}
        components={{ Control, DropdownIndicator }}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
        classNamePrefix="inbox-select"
        noOptionsMessage={() => 'No options found'}
      />
    </div>
  );
}
