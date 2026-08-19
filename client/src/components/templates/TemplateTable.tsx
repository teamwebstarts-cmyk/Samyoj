import {
  ChevronDown,
  ChevronRight,
  FileText,
  Globe,
  Layers,
} from 'lucide-react';
import DataTable, { TableSerialCell } from '../ui/DataTable';
import type { MessageTemplate } from '../../types';
import {
  getTemplatePreviewSnippet,
  getTemplateRejectedReason,
} from '../../utils/templateUtils';
import {
  CategoryInlinePill,
  getCategoryMeta,
  getLanguageLabel,
} from './templateUi';
import TemplateRowActions from './TemplateRowActions';
import TemplateStatusCell from './TemplateStatusCell';

export type TemplateTableRow =
  | { type: 'group'; name: string; variants: MessageTemplate[]; primary: MessageTemplate }
  | { type: 'variant'; template: MessageTemplate }
  | { type: 'single'; template: MessageTemplate };

interface TemplateTableProps {
  rows: TemplateTableRow[];
  page: number;
  pageSize: number;
  total: number;
  expandedGroups: Set<string>;
  onToggleGroup: (name: string) => void;
  onPageChange: (page: number) => void;
  onView: (template: MessageTemplate) => void;
  onDuplicate: (template: MessageTemplate) => void;
}

function TemplateNameCell({
  template,
  indented,
  onView,
}: {
  template: MessageTemplate;
  indented?: boolean;
  onView: () => void;
}) {
  const category = getCategoryMeta(template.category);
  const CategoryIcon = category?.icon ?? FileText;
  const snippet = getTemplatePreviewSnippet(template, 88);

  return (
    <button
      type="button"
      onClick={onView}
      className={`group/cell flex w-full items-start gap-3 py-0.5 text-left ${indented ? 'pl-3' : ''}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${category?.iconBg ?? 'bg-gradient-to-br from-rose-500 to-pink-600'}`}
      >
        <CategoryIcon className="h-[18px] w-[18px]" strokeWidth={2.1} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate font-mono text-[13px] font-bold text-neutral-900 group-hover/cell:text-whatsapp-700 dark:text-neutral-100 dark:group-hover/cell:text-whatsapp-400">
            {template.name}
          </span>
          <CategoryInlinePill category={template.category} />
        </div>
        {snippet ? (
          <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-neutral-500 dark:text-neutral-400">
            {snippet}
          </p>
        ) : (
          <p className="mt-1 text-[12px] text-neutral-400">No preview text</p>
        )}
      </div>
    </button>
  );
}

export default function TemplateTable({
  rows,
  page,
  pageSize,
  total,
  expandedGroups,
  onToggleGroup,
  onPageChange,
  onView,
  onDuplicate,
}: TemplateTableProps) {
  let templateRowIndex = 0;

  return (
    <DataTable
      embedded
      serialHeader="S.N.O."
      className="templates-data-table"
      headers={['Template', 'Status', 'Category', 'Language', 'Actions']}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      paginationVariant="numbered"
      paginationItemLabel="templates"
      minTableWidth="min-w-[780px]"
      tableClassName="text-sm"
    >
      {rows.map((row) => {
        if (row.type === 'group') {
          const expanded = expandedGroups.has(row.name);
          const approvedCount = row.variants.filter((v) => v.status === 'APPROVED').length;

          return (
            <tr key={`group-${row.name}`} className="bg-neutral-50/80 dark:bg-neutral-900/40">
              <td colSpan={6} className="!px-4 !py-2.5 sm:!px-5">
                <button
                  type="button"
                  onClick={() => onToggleGroup(row.name)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-white/60 dark:hover:bg-neutral-800/60"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-600 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-extrabold text-neutral-900 dark:text-neutral-100">
                      {row.name}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 ring-1 ring-rose-200/70 dark:bg-rose-950/50 dark:text-rose-300">
                      <Layers className="h-3 w-3" />
                      {row.variants.length} languages
                    </span>
                    {approvedCount > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {approvedCount} approved
                      </span>
                    )}
                  </div>
                </button>
              </td>
            </tr>
          );
        }

        const template = row.template;
        const serialIndex = templateRowIndex++;
        const rejectedReason = getTemplateRejectedReason(template.rejected_reason);
        const category = getCategoryMeta(template.category);
        const CategoryIcon = category?.icon ?? FileText;

        return (
          <tr
            key={template.id || `${template.name}-${template.language}-${serialIndex}`}
            className={row.type === 'variant' ? 'bg-neutral-50/40 dark:bg-neutral-900/20' : ''}
          >
            <TableSerialCell page={page} pageSize={pageSize} rowIndex={serialIndex} />

            <td className="min-w-[200px] max-w-[340px] !py-3.5 sm:!py-4">
              <TemplateNameCell
                template={template}
                indented={row.type === 'variant'}
                onView={() => onView(template)}
              />
            </td>

            <td className="whitespace-nowrap !py-3.5 sm:!py-4">
              <TemplateStatusCell
                status={template.status}
                qualityScore={template.quality_score?.score}
                rejectedReason={rejectedReason}
              />
            </td>

            <td className="whitespace-nowrap !py-3.5 sm:!py-4">
              {category ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${category.badge}`}
                >
                  <CategoryIcon className="h-3 w-3 shrink-0" />
                  {category.label}
                </span>
              ) : (
                <span className="text-[13px] text-theme-muted">—</span>
              )}
            </td>

            <td className="whitespace-nowrap !py-3.5 sm:!py-4">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-neutral-600 dark:text-neutral-300">
                <Globe className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                {getLanguageLabel(template.language)}
              </span>
            </td>

            <td className="!py-3.5 sm:!py-4">
              <div className="flex min-w-[9.5rem] justify-end">
                <TemplateRowActions
                  onView={() => onView(template)}
                  onDuplicate={() => onDuplicate(template)}
                />
              </div>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
