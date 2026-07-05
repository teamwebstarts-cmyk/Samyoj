import { forwardRef } from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { value, onChange, placeholder = 'Search...', className = '' },
  ref,
) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-muted"
      />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-theme-border bg-theme-surface pl-10 pr-3.5 text-[14px] text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-whatsapp-600 focus:outline-none focus:shadow-input-focus dark:focus:border-whatsapp-500"
      />
    </div>
  );
});

export default SearchInput;
