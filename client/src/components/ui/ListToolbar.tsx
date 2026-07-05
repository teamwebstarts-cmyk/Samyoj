import type { ReactNode } from 'react';
import SearchInput from './SearchInput';

interface ListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
  embedded?: boolean;
  /** Put filters on a second row below search + actions */
  stackFilters?: boolean;
}

export default function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  actions,
  className = '',
  embedded = false,
  stackFilters = false,
}: ListToolbarProps) {
  const content = stackFilters ? (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full sm:max-w-md sm:flex-1"
        />
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
        )}
      </div>
      {filters && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">{filters}</div>
      )}
    </div>
  ) : (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
        className="w-full lg:max-w-sm lg:flex-1"
      />

      {(filters || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:shrink-0">
          {filters && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {filters}
            </div>
          )}
          {actions}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return <div className={`border-b border-theme-border px-4 py-3.5 ${className}`}>{content}</div>;
  }

  return <div className={`dashboard-card p-4 ${className}`}>{content}</div>;
}
