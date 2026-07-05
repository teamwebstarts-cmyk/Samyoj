import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FileText,
  Globe,
  Layers,
} from 'lucide-react';
import DataTable, { TableSerialCell } from '../ui/DataTable';
import { TableIconButton, TableTextButton } from '../ui/TableActions';
import StatusBadge from '../ui/StatusBadge';
import type { MessageTemplate } from '../../types';
import {
  getQualityLabel,
  getTemplatePreviewSnippet,
  getTemplateRejectedReason,
} from '../../utils/templateUtils';
import {
  getCategoryMeta,
  getLanguageLabel,
} from './templateUi';

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

function TemplateRowContent({
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
  const snippet = getTemplatePreviewSnippet(template, 72);

  return (
    <button
      type="button"
      onClick={onView}
      className={`flex w-full items-center gap-3 rounded-xl py-1 text-left transition hover:opacity-90 ${indented ? 'pl-4' : ''}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${category?.iconBg ?? 'bg-gradient-to-br from-rose-500 to-pink-600'}`}
      >
        <CategoryIcon className="h-4 w-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[12px] font-bold text-theme-fg group-hover:text-whatsapp-700 dark:group-hover:text-whatsapp-400">
          {template.name}
        </span>
        {snippet ? (
          <span className="mt-0.5 block truncate text-[11px] font-medium leading-relaxed text-theme-muted">
            {snippet}
          </span>
        ) : (
          <span className="mt-0.5 block text-[11px] text-theme-muted">No preview text</span>
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
      headers={['Template', 'Status', 'Category', 'Language', 'Actions']}
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      minTableWidth="min-w-[920px]"
    >
      {rows.map((row) => {
        if (row.type === 'group') {
          const expanded = expandedGroups.has(row.name);
          const approvedCount = row.variants.filter((v) => v.status === 'APPROVED').length;

          return (
            <tr key={`group-${row.name}`} className="bg-theme-subtle/50">
              <td colSpan={6} className="!px-4 !py-2.5 sm:!px-5">
                <button
                  type="button"
                  onClick={() => onToggleGroup(row.name)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1 text-left transition hover:bg-theme-surface/60"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-theme-surface text-theme-secondary ring-1 ring-theme-border">
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-extrabold text-theme-fg">{row.name}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800 ring-1 ring-rose-200/70 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800/50">
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
        const quality = getQualityLabel(template.quality_score?.score);
        const category = getCategoryMeta(template.category);
        const CategoryIcon = category?.icon ?? FileText;

        return (
          <tr
            key={template.id || `${template.name}-${template.language}-${serialIndex}`}
            className={`group ${row.type === 'variant' ? 'bg-theme-subtle/25' : ''}`}
          >
            <TableSerialCell page={page} pageSize={pageSize} rowIndex={serialIndex} />

            <td className="min-w-[220px]">
              <TemplateRowContent
                template={template}
                indented={row.type === 'variant'}
                onView={() => onView(template)}
              />
            </td>

            <td className="whitespace-nowrap">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  {template.status ? (
                    <StatusBadge status={template.status} />
                  ) : (
                    <span className="text-[13px] text-theme-muted">—</span>
                  )}
                </div>
                {quality && (
                  <span className={`text-[10px] font-semibold ${quality.tone}`}>{quality.label}</span>
                )}
                {rejectedReason && (
                  <p
                    className="max-w-[200px] truncate text-[11px] font-medium text-red-600 dark:text-red-400"
                    title={rejectedReason}
                  >
                    {rejectedReason}
                  </p>
                )}
              </div>
            </td>

            <td className="whitespace-nowrap">
              {category ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${category.badge}`}
                >
                  <CategoryIcon className="h-3 w-3 shrink-0" />
                  {category.label}
                </span>
              ) : (
                <span className="text-[13px] text-theme-muted">—</span>
              )}
            </td>

            <td className="whitespace-nowrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-theme-border bg-theme-subtle/60 px-2.5 py-1 text-[11px] font-bold text-theme-secondary">
                <Globe className="h-3 w-3 shrink-0 text-theme-muted" />
                {getLanguageLabel(template.language)}
              </span>
            </td>

            <td>
              <div className="flex items-center justify-end gap-1.5">
                <TableTextButton onClick={() => onView(template)} icon={Eye}>
                  View
                </TableTextButton>
                <TableIconButton
                  onClick={() => onDuplicate(template)}
                  icon={Copy}
                  label="Duplicate template"
                />
              </div>
            </td>
          </tr>
        );
      })}
    </DataTable>
  );
}
