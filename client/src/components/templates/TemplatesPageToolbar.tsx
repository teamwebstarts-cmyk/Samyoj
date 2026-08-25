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
  canCreate?: boolean;
}

/** Search + both filters: same width and 44px height on md+. */
const filterControlClass =
  'w-full min-w-0 shrink-0 md:w-[12rem] md:max-w-[12rem]';
const filterSelectClass =
  `${filterControlClass} [&_.app-select__control]:!h-11 [&_.app-select__control]:!min-h-11 [&_.app-select__control]:!w-full [&_.app-select__single-value]:!max-w-none`;
const filterInputClass = '!h-11 !min-h-11';
const toolbarActionBtnClass = 'shrink-0 !h-11 !min-h-11';

/**
 * Toolbar: [search][status][category] ——— [library][new]
 * Mobile: stacked full-width controls; md+ one aligned filter row.
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
  canCreate = true,
}: TemplatesPageToolbarProps) {
  return (
    <div className="border-b border-theme-border px-2.5 py-2 sm:px-4 sm:py-3.5 lg:px-5">
      <div className="flex min-w-0 flex-col gap-2 sm:gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-2 lg:flex-nowrap">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search templates..."
            className={filterControlClass}
            inputClassName={filterInputClass}
          />

          <AppSelect
            className={filterSelectClass}
            value={statusFilter}
            placeholder="All statuses"
            ariaLabel="Filter by status"
            isSearchable={false}
            options={statusFilterOptions}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          />

          <AppSelect
            className={filterSelectClass}
            value={categoryFilter}
            placeholder="All categories"
            ariaLabel="Filter by category"
            isSearchable={false}
            options={[{ value: ALL_CATEGORIES, label: 'All categories' }, ...CATEGORY_OPTIONS]}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <AppButton
            className={`${toolbarActionBtnClass} max-sm:!px-2.5`}
            variant="secondary"
            size="sm"
            icon={<BookOpen size={16} />}
            onClick={onOpenLibrary}
            aria-label="Open template library"
          >
            <span className="hidden sm:inline">Library</span>
          </AppButton>
          <AppButton
            className={`${toolbarActionBtnClass} max-sm:ml-auto`}
            size="sm"
            icon={<Plus size={16} />}
            onClick={onCreate}
            disabled={!canCreate}
          >
            New template
          </AppButton>
        </div>
      </div>
    </div>
  );
}

export { ALL_STATUSES, ALL_CATEGORIES };
