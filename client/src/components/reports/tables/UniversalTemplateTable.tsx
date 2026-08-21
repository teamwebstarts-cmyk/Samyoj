import { useState, useMemo } from 'react';
import { Download, FileText } from 'lucide-react';
import SearchInput from '../../ui/SearchInput';
import AppButton from '../../ui/AppButton';
import EmptyState from '../../ui/EmptyState';
import type { UniversalTemplateMetric } from '../../../types';

interface UniversalTemplateTableProps {
  templates: UniversalTemplateMetric[];
  onExportCsv?: () => void;
}

const CATEGORY_BADGES: Record<string, string> = {
  MARKETING: 'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/40',
  UTILITY: 'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/40',
  AUTHENTICATION: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/40',
  SERVICE: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/40',
};

const QUALITY_BADGES: Record<string, { label: string; style: string }> = {
  HIGH: { label: 'High Quality', style: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300' },
  MEDIUM: { label: 'Medium', style: 'bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300' },
  LOW: { label: 'Needs Attention', style: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300' },
};

export type TemplateSortField =
  | 'sent'
  | 'totalDispatches'
  | 'delivered'
  | 'read'
  | 'deliveryRate'
  | 'readRate'
  | 'clickThroughRate'
  | 'templateName';

export default function UniversalTemplateTable({
  templates,
  onExportCsv,
}: UniversalTemplateTableProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortField, setSortField] = useState<TemplateSortField>('sent');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    let list = templates.filter((t) => {
      const matchSearch = t.templateName.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'ALL' || t.category === categoryFilter;
      return matchSearch && matchCat;
    });

    list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });

    return list;
  }, [templates, search, categoryFilter, sortField, sortDir]);

  const handleSort = (field: TemplateSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="dashboard-card overflow-hidden animate-fade-up">
      <div className="flex flex-col gap-3 border-b border-theme-border bg-theme-subtle/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
            Template Intelligence & Success Rates
          </h3>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            Delivery, open, and engagement rates across all campaigns & inbox dispatches
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search template..."
              compact
            />
          </div>
          {onExportCsv && (
            <AppButton size="sm" variant="secondary" icon={<Download size={13} />} onClick={onExportCsv}>
              CSV
            </AppButton>
          )}
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 border-b border-theme-border/60 bg-theme-surface px-5 py-2">
        {['ALL', 'MARKETING', 'UTILITY', 'AUTHENTICATION'].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
              categoryFilter === cat
                ? 'bg-whatsapp-600 text-white shadow-sm'
                : 'text-theme-muted hover:bg-theme-subtle hover:text-theme-fg'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={FileText}
            compact
            title="No templates match your criteria"
            description="Clear the search or send a broadcast campaign to start tracking template engagement metrics."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-theme-border text-[10px] font-bold uppercase tracking-[0.08em] text-theme-muted">
                <th
                  className="cursor-pointer px-5 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('templateName')}
                >
                  Template {sortField === 'templateName' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-5 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('totalDispatches')}
                >
                  Dispatches {sortField === 'totalDispatches' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-5 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('sent')}
                >
                  Sent {sortField === 'sent' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-5 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('delivered')}
                >
                  Delivered {sortField === 'delivered' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-5 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('read')}
                >
                  Read {sortField === 'read' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-5 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('deliveryRate')}
                >
                  Delivery % {sortField === 'deliveryRate' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-5 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('readRate')}
                >
                  Read % {sortField === 'readRate' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="cursor-pointer px-5 py-3 hover:text-theme-fg"
                  onClick={() => handleSort('clickThroughRate')}
                >
                  Est. CTR {sortField === 'clickThroughRate' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="px-5 py-3 text-right">Meta Quality</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const catBadge = CATEGORY_BADGES[t.category] || CATEGORY_BADGES.MARKETING;
                const quality = QUALITY_BADGES[t.qualityScore] || QUALITY_BADGES.HIGH;

                return (
                  <tr
                    key={t.templateName}
                    className="border-t border-theme-border/60 transition-colors hover:bg-theme-subtle/40"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                          <FileText className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold font-mono text-[12.5px] text-theme-fg">
                            {t.templateName}
                          </p>
                          <span className={`inline-flex rounded-md px-1.5 py-0.2 text-[9px] font-extrabold ring-1 ${catBadge}`}>
                            {t.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-theme-secondary">
                      {t.totalDispatches.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-bold tabular-nums text-theme-fg">
                      {t.sent.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-theme-secondary">
                      {t.delivered.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-theme-secondary">
                      {t.read.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {t.deliveryRate}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-lg bg-sky-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                        {t.readRate}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                      {t.clickThroughRate}%
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-extrabold ring-1 ${quality.style}`}>
                        {quality.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
