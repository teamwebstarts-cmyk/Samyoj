import SearchInput from '../ui/SearchInput';
import AppButton from '../ui/AppButton';
import AppSelect from '../ui/AppSelect';
import { BookOpen, Layers, Plus, RefreshCw } from 'lucide-react';
import { CATEGORY_OPTIONS, LANGUAGE_OPTIONS } from '../../utils/templateUtils';

const ALL_STATUSES = '__all__';
const ALL_CATEGORIES = '__all__';
const ALL_LANGUAGES = '__all__';

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
  languageFilter: string;
  onLanguageFilterChange: (value: string) => void;
  groupView: boolean;
  onToggleGroupView: () => void;
  onRefresh: () => void;
  onOpenLibrary: () => void;
  onCreate: () => void;
}

/**
 * Templates toolbar — phone: stacked grid; tablet: wrapped rows; xl+: single row like desktop mock.
 */
export default function TemplatesPageToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  languageFilter,
  onLanguageFilterChange,
  groupView,
  onToggleGroupView,
  onRefresh,
  onOpenLibrary,
  onCreate,
}: TemplatesPageToolbarProps) {
  return (
    <div className="border-b border-theme-border px-3 py-3 sm:px-4 sm:py-3.5 lg:px-5">
      <div className="flex min-w-0 flex-col gap-2.5 xl:flex-row xl:items-center xl:gap-3 2xl:gap-4">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search templates..."
          className="w-full min-w-0 xl:max-w-[min(100%,20rem)] xl:flex-none 2xl:max-w-md"
          compact
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between xl:justify-end xl:gap-2">
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 md:flex md:flex-wrap md:items-center lg:gap-2">
            <AppSelect
              className="min-w-0 w-full md:w-[128px]"
              value={statusFilter}
              placeholder="All statuses"
              isSearchable={false}
              options={statusFilterOptions}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            />
            <AppSelect
              className="min-w-0 w-full md:w-[128px]"
              value={categoryFilter}
              placeholder="All categories"
              isSearchable={false}
              options={[{ value: ALL_CATEGORIES, label: 'All categories' }, ...CATEGORY_OPTIONS]}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
            />
            <AppSelect
              className="min-w-0 w-full md:w-[132px]"
              value={languageFilter}
              placeholder="All languages"
              isSearchable
              options={[{ value: ALL_LANGUAGES, label: 'All languages' }, ...LANGUAGE_OPTIONS]}
              onChange={(e) => onLanguageFilterChange(e.target.value)}
            />
            <AppButton
              className="col-span-2 w-full sm:col-span-1 md:w-auto"
              variant={groupView ? 'primary' : 'secondary'}
              size="sm"
              icon={<Layers size={14} />}
              onClick={onToggleGroupView}
            >
              Group
            </AppButton>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] md:overflow-visible [&::-webkit-scrollbar]:hidden">
            <AppButton
              className="shrink-0"
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={onRefresh}
            >
              Refresh
            </AppButton>
            <AppButton
              className="shrink-0"
              variant="secondary"
              size="sm"
              icon={<BookOpen size={16} />}
              onClick={onOpenLibrary}
            >
              Library
            </AppButton>
            <AppButton className="shrink-0" size="sm" icon={<Plus size={16} />} onClick={onCreate}>
              New template
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ALL_STATUSES, ALL_CATEGORIES, ALL_LANGUAGES };
