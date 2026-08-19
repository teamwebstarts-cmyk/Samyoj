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
  /** Search + filters + actions on one row from `md` up; stack below `md`. */
  inlineDesktop?: boolean;
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
  inlineDesktop = false,
  filtersLeading = false,
  compactMobile = false,
}: ListToolbarProps) {
  const stackGap = compactMobile ? 'gap-2 sm:gap-3' : 'gap-3';
  const rowGap = compactMobile ? 'gap-1.5 sm:gap-2' : 'gap-2';
  const filterWrapClass = compactMobile
    ? `grid grid-cols-2 ${rowGap} sm:flex sm:flex-row sm:flex-wrap sm:items-center`
    : 'flex flex-col gap-2 sm:flex-row sm:items-center';

  let content: ReactNode;

  if (inlineDesktop) {
    content = (
      <div className="flex flex-col gap-2 md:flex-row md:flex-nowrap md:items-center md:justify-between md:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center md:gap-3">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="w-full min-w-0 md:max-w-xs md:flex-1"
            compact={compactMobile}
          />
          {filters ? (
            <div className="flex w-full min-w-0 items-stretch md:w-auto md:items-center md:overflow-visible">
              {filters}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 max-md:w-full md:justify-end">{actions}</div>
        ) : null}
      </div>
    );
  } else if (filtersLeading) {
    content = (
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full lg:max-w-sm lg:flex-none"
          compact={compactMobile}
        />
        {(filters || actions) && (
          <div className="flex min-w-0 w-full flex-wrap items-center gap-2 lg:flex-1 lg:justify-end">
            {filters && (
              <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div>
            )}
            {actions && (
              <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full">{actions}</div>
            )}
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

  return <div className={`dashboard-card p-[var(--card-pad)] ${className}`}>{content}</div>;
}
