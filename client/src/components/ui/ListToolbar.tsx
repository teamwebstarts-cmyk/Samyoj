import type { ReactNode } from 'react';
import SearchInput from './SearchInput';

interface ListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  actions,
  className = '',
}: ListToolbarProps) {
  return (
    <div className={`dashboard-card p-4 ${className}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full lg:max-w-sm"
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          {filters && (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {filters}
            </div>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}
