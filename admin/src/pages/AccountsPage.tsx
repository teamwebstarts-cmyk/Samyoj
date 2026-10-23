import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, ChevronRight } from 'lucide-react';
import { platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import {
  Button,
  EmptyState,
  FlagPills,
  Input,
  Notice,
  PageHeader,
  PageLoading,
  ResponsiveDataView,
  SectionCard,
  StageBadge,
  StatusBadge,
  clickableRowProps,
} from '../components/ui';
import { formatAiCapPercent, formatCount, formatWhen } from '../lib/format';
import { toStackedAccountRecord, type AccountListRow } from '../lib/records';
import { ACTIVATION_STAGES, STAGE_LABELS, type ActivationStage } from '../lib/stages';

export function AccountsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const stage = (params.get('stage') || '') as ActivationStage | '';
  const page = Math.max(1, Number(params.get('page') || 1));
  const [rows, setRows] = useState<AccountListRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const search = new URLSearchParams();
      if (q) search.set('q', q);
      if (stage && ACTIVATION_STAGES.includes(stage)) search.set('stage', stage);
      search.set('page', String(page));
      platformRequest<{ rows: AccountListRow[]; total: number }>(`/orgs?${search.toString()}`)
        .then((data) => {
          setRows(data.rows);
          setTotal(data.total);
          setError('');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [q, stage, page]);

  function setStage(next?: ActivationStage) {
    const copy = new URLSearchParams(params);
    if (next && next !== stage) copy.set('stage', next);
    else copy.delete('stage');
    copy.delete('page');
    setParams(copy);
  }

  const records = (rows ?? []).map(toStackedAccountRecord);
  const pageCount = Math.max(1, Math.ceil(total / 25));
  const purpose = stage
    ? `${STAGE_LABELS[stage]} · ${formatCount(total)} organizations matching`
    : `Managing ${formatCount(total)} total organizations across all lifecycle stages.`;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Organizations & Accounts"
        purpose={purpose}
        action={
          stage ? (
            <Button variant="secondary" size="sm" onClick={() => setStage()}>
              <X className="h-3.5 w-3.5 mr-1" /> Clear stage filter
            </Button>
          ) : undefined
        }
      />

      {/* Stage Rail Selector */}
      <SectionCard title="Lifecycle Filter" purpose="Select an activation station to isolate organizations at that step." padded>
        <LifecycleRail current={stage || undefined} onSelect={setStage} compact />
      </SectionCard>

      {/* Search Bar & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Input
            icon={Search}
            placeholder="Search by company name or owner email…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              const copy = new URLSearchParams(params);
              if (event.target.value) copy.set('q', event.target.value);
              else copy.delete('q');
              copy.delete('page');
              setParams(copy);
            }}
          />
        </div>
        {q && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ('');
              const copy = new URLSearchParams(params);
              copy.delete('q');
              setParams(copy);
            }}
          >
            Clear search
          </Button>
        )}
      </div>

      {error && (
        <Notice tone="error">
          Could not load accounts. {error} Clear filters or refresh the page.
        </Notice>
      )}

      {rows === null && !error ? (
        <PageLoading label="Loading accounts directory…" />
      ) : (
        <ResponsiveDataView
          items={records}
          emptyState={
            <EmptyState
              icon={Search}
              title="No organizations found"
              description="No organizations match your current search query or lifecycle station filter."
              steps={[
                'Click the selected lifecycle station again to clear the filter',
                'Verify the company name or owner email spelling',
              ]}
            />
          }
          renderCard={(row) => (
            <button
              type="button"
              className="dashboard-card w-full p-4 text-left hover:border-indigo-500/40 hover:shadow-md transition-all group"
              onClick={() => navigate(`/accounts/${row.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 group-hover:text-indigo-800 transition-colors">{row.title}</p>
                  <p className="text-xs text-slate-500">{row.subtitle}</p>
                </div>
                <StageBadge stage={row.stage} />
              </div>

              <div className="mt-3">
                <LifecycleRail current={row.stage} compact decorative />
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <StatusBadge status={row.plan} />
                  <span>{row.numbersConnected} numbers</span>
                </div>
                <div className="flex items-center gap-2">
                  <FlagPills flags={row.flags} />
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          )}
          renderTable={() => (
            <div className="dashboard-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Stage</th>
                    <th>Plan</th>
                    <th>Quality</th>
                    <th>AI % of Cap</th>
                    <th>WA Numbers</th>
                    <th>Last Active</th>
                    <th>Health Flags</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(rows ?? []).map((row) => (
                    <tr key={row.id} {...clickableRowProps(() => navigate(`/accounts/${row.id}`))}>
                      <td>
                        <div className="font-bold text-slate-900">{row.companyName}</div>
                        <div className="text-xs text-slate-500">{row.ownerEmail}</div>
                      </td>
                      <td>
                        <StageBadge stage={row.stage} />
                      </td>
                      <td>
                        <StatusBadge status={row.plan} />
                      </td>
                      <td>{row.qualityRating ? <StatusBadge status={row.qualityRating} /> : <span className="text-slate-400">—</span>}</td>
                      <td className="font-mono text-xs font-semibold text-slate-700">
                        {formatAiCapPercent(row.aiTokensMonth, row.monthlyTokenLimit)}
                      </td>
                      <td className="font-mono text-xs">{formatCount(row.numbersConnected)}</td>
                      <td className="text-xs text-slate-600">{formatWhen(row.lastLoginAt)}</td>
                      <td>
                        <FlagPills flags={row.flags} />
                      </td>
                      <td className="text-right">
                        <span className="text-xs font-semibold text-indigo-700">Open →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />
      )}

      {/* Pagination Controls */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200/80 pt-4 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              const copy = new URLSearchParams(params);
              copy.set('page', String(page - 1));
              setParams(copy);
            }}
          >
            Previous
          </Button>
          <span className="font-mono text-xs font-semibold text-slate-600">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => {
              const copy = new URLSearchParams(params);
              copy.set('page', String(page + 1));
              setParams(copy);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
