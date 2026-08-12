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
  /** Desktop: search (half) on the left; filters + actions grouped on the right */
  filtersLeading?: boolean;
  /** Tighter padding, gaps, and filter grid on small screens */
  compactMobile?: boolean;
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
  filtersLeading = false,
  compactMobile = false,
}: ListToolbarProps) {
  const stackGap = compactMobile ? 'gap-2 sm:gap-3' : 'gap-3';
  const rowGap = compactMobile ? 'gap-1.5 sm:gap-2' : 'gap-2';
  const filterWrapClass = compactMobile
    ? `grid grid-cols-2 ${rowGap} sm:flex sm:flex-row sm:flex-wrap sm:items-center`
    : 'flex flex-col gap-2 sm:flex-row sm:items-center';

  let content: ReactNode;

  if (filtersLeading) {
    content = (
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-3 lg:gap-4">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full md:w-1/2 md:max-w-md md:flex-none"
        />
        {(filters || actions) && (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end md:w-auto md:shrink-0">
            {filters}
            {actions}
          </div>
        )}
      </div>
    );
  } else if (stackFilters) {
    content = (
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
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            {filters}
          </div>
        )}
      </div>
    );
  } else {
    content = (
      <div className={`flex flex-col ${stackGap} lg:flex-row lg:items-center lg:justify-between lg:gap-4`}>
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full lg:max-w-sm lg:flex-1"
          compact={compactMobile}
        />

        {(filters || actions) && (
          <div
            className={`flex flex-col ${rowGap} sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:shrink-0`}
          >
            {filters && <div className={filterWrapClass}>{filters}</div>}
            {actions}
          </div>
        )}
      </div>
    );
  }

  if (embedded) {
    const embeddedPad = compactMobile ? 'px-3 py-2 sm:px-4 sm:py-3.5' : 'px-4 py-3.5';
    return <div className={`border-b border-theme-border ${embeddedPad} ${className}`}>{content}</div>;
  }

  return <div className={`dashboard-card p-4 ${className}`}>{content}</div>;
}
