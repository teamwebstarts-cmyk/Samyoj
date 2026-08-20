import SearchInput from '../ui/SearchInput';
import AppButton from '../ui/AppButton';
import AppSelect from '../ui/AppSelect';
import { BookOpen, Plus } from 'lucide-react';
import { CATEGORY_OPTIONS } from '../../utils/templateUtils';

const ALL_STATUSES = '__all__';
const ALL_CATEGORIES = '__all__';

const statusFilterOptions = [
  { value: ALL_STATUSES, label: 'All statuses' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'DISABLED', label: 'Disabled' },
];

interface TemplatesPageToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  onOpenLibrary: () => void;
  onCreate: () => void;
}

/** Fixed width on sm+ — never w-full in a horizontal flex row (causes 544px overlap). */
const filterSelectClass =
  'w-full min-w-0 shrink-0 sm:w-[10.25rem] sm:max-w-[10.25rem] [&_.app-select__control]:!w-full [&_.app-select__single-value]:!max-w-none';

const mobileIconBtn =
  'shrink-0 max-sm:!h-9 max-sm:!min-h-9 max-sm:!px-2.5';

/**
 * Toolbar: [search][status][category] ——— [library][new]
 * Mobile: search row → filter row → actions row.
 */
export default function TemplatesPageToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  onOpenLibrary,
  onCreate,
}: TemplatesPageToolbarProps) {
  return (
    <div className="border-b border-theme-border px-2.5 py-2 sm:px-4 sm:py-3.5 lg:px-5">
      <div className="flex min-w-0 flex-col gap-2 sm:gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
        {/* Search + filters */}
        <div className="flex min-w-0 flex-col gap-2 sm:gap-2.5 md:flex-row md:flex-wrap md:items-center lg:flex-nowrap lg:gap-2">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search templates..."
            className="w-full shrink-0 md:w-[11rem] md:max-w-[11rem]"
            compact
          />

          <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:gap-2 md:flex md:flex-none md:flex-row md:items-center md:gap-2">
            <AppSelect
              className={filterSelectClass}
              size="compact"
              value={statusFilter}
              placeholder="Status"
              ariaLabel="Filter by status"
              isSearchable={false}
              options={statusFilterOptions}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            />
            <AppSelect
              className={`${filterSelectClass} sm:w-[11.5rem] sm:max-w-[11.5rem]`}
              size="compact"
              value={categoryFilter}
              placeholder="Category"
              ariaLabel="Filter by category"
              isSearchable={false}
              options={[{ value: ALL_CATEGORIES, label: 'All categories' }, ...CATEGORY_OPTIONS]}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
            />
          </div>
        </div>

        {/* Actions — icon-only secondary on phone; labels from sm */}
        <div className="flex shrink-0 items-center gap-1.5 sm:flex-wrap sm:gap-2">
          <AppButton
            className={mobileIconBtn}
            variant="secondary"
            size="sm"
            icon={<BookOpen size={16} />}
            onClick={onOpenLibrary}
            aria-label="Open template library"
          >
            <span className="hidden sm:inline">Library</span>
          </AppButton>
          <AppButton
            className="shrink-0 max-sm:ml-auto max-sm:!h-9 max-sm:!min-h-9"
            size="sm"
            icon={<Plus size={16} />}
            onClick={onCreate}
          >
            New template
          </AppButton>
        </div>
      </div>
    </div>
  );
}

export { ALL_STATUSES, ALL_CATEGORIES };
