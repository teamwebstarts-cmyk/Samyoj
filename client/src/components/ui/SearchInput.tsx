import { forwardRef } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Shorter control on small screens (list toolbars) */
  compact?: boolean;
  /** Extra classes on the input (e.g. force a matching filter-bar height). */
  inputClassName?: string;
  label?: string;
  id?: string;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value,
    onChange,
    placeholder = 'Search...',
    className = '',
    compact = false,
    inputClassName = '',
    label,
    id,
  },
  ref,
) {
  const fieldClass = compact
    ? 'h-9 w-full rounded-lg border border-theme-border bg-theme-surface pl-9 pr-3 text-[13px] text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-slate-400 focus:outline-none focus:shadow-input-focus dark:focus:border-slate-500 sm:h-11 sm:rounded-xl sm:pl-10 sm:pr-3.5 sm:text-[14px]'
    : 'h-11 w-full rounded-xl border border-theme-border bg-theme-surface pl-10 pr-3.5 text-[14px] text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-slate-400 focus:outline-none focus:shadow-input-focus dark:focus:border-slate-500';

  return (
    <div className={`${label ? 'space-y-1.5' : ''} ${className}`}>
      {label ? (
        <label htmlFor={id} className="text-[13px] font-semibold text-theme-secondary">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <Search
          size={16}
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-theme-muted ${
            compact ? 'left-3 h-[15px] w-[15px] sm:left-3.5 sm:h-4 sm:w-4' : 'left-3.5'
          }`}
        />
        <input
          ref={ref}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${fieldClass} ${inputClassName}`}
        />
      </div>
    </div>
  );
});

export default SearchInput;
