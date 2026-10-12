import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';
import { platformRequest } from '../api';
import {
  EmptyState,
  FilterPills,
  Notice,
  PageHeader,
  PageLoading,
  SectionCard,
  clickableRowProps,
} from '../components/ui';
import { formatCount, formatWhen } from '../lib/format';

type Errors = {
  days: number;
  codes: Array<{ code: number; title: string; count: number; sampleTitle: string | null }>;
  recent: Array<{
    organizationId: string;
    companyName: string;
    code: number;
    title: string;
    count: number;
    sampleTitle: string | null;
    lastAt: string;
  }>;
};

const ERROR_DESCRIPTIONS: Record<number, { category: string; description: string; advice: string }> = {
  131030: { category: 'Rate Limit', description: 'Meta throughput threshold reached.', advice: 'Throttle bulk campaign concurrency.' },
  131047: { category: 'Service Window', description: 'Re-engagement 24hr window closed.', advice: 'Send an approved Utility/Marketing template to reopen.' },
  131051: { category: 'Unsupported Format', description: 'Media file type or payload unsupported.', advice: 'Verify MIME type and file size limits.' },
  132000: { category: 'Template Structure', description: 'Template parameters count mismatch.', advice: 'Ensure all body variables (e.g. {{1}}, {{2}}) have matching values.' },
  132001: { category: 'Template Missing', description: 'Template does not exist in this language/locale.', advice: 'Check Meta Template sync status in Settings.' },
  133010: { category: 'Phone Not Registered', description: 'The business number is not registered for Cloud API.', advice: 'Register the number in WhatsApp Manager with the 6-digit PIN.' },
  130429: { category: 'Cloud API Rate Limit', description: 'Cloud API calls exceeded per-second cap.', advice: 'Exponential backoff will retry automatically.' },
};

export function ErrorsPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Errors | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    platformRequest<Errors>(`/errors?days=${days}`)
      .then((payload) => {
        setData(payload);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [days]);

  if (error) {
    return (
      <Notice tone="error">
        Could not load Meta errors. {error} Refresh, or try switching the timeframe window.
      </Notice>
    );
  }
  if (!data) return <PageLoading label="Loading Meta error telemetry…" />;

  const totalIncidents = data.codes.reduce((acc, c) => acc + c.count, 0);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Meta WhatsApp Error Telemetry"
        purpose="Official Meta Cloud API status codes aggregated across all connected numbers. No customer phone numbers or message bodies are retained."
        eyebrow={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-800">
            <AlertOctagon className="h-3 w-3 text-rose-600" />
            API Incident Tracker
          </span>
        }
        action={
          <FilterPills
            label="Window"
            value={days}
            onChange={setDays}
            options={[
              { value: 7, label: 'Past 7 days' },
              { value: 30, label: 'Past 30 days' },
            ]}
          />
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="dashboard-card p-4 bg-gradient-to-br from-white to-slate-50">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Failed Sends</p>
          <p className="mt-2 text-2xl font-bold font-mono text-rose-950">{formatCount(totalIncidents)}</p>
          <p className="mt-1 text-xs text-slate-500">In the last {days} days</p>
        </div>

        <div className="dashboard-card p-4 bg-gradient-to-br from-white to-slate-50">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Unique Meta Codes</p>
          <p className="mt-2 text-2xl font-bold font-mono text-slate-900">{data.codes.length}</p>
          <p className="mt-1 text-xs text-slate-500">Categorized error signatures</p>
        </div>

        <div className="dashboard-card p-4 bg-gradient-to-br from-white to-slate-50">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Affected Organizations</p>
          <p className="mt-2 text-2xl font-bold font-mono text-slate-900">{data.recent.length}</p>
          <p className="mt-1 text-xs text-slate-500">Requiring potential outreach</p>
        </div>
      </div>

      {data.codes.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All delivery pipelines clear"
          description="Zero Meta WhatsApp Cloud API errors recorded across all workspaces in this timeframe."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.codes.map((row) => {
            const metaInfo = ERROR_DESCRIPTIONS[row.code];
            return (
              <div key={row.code} className="dashboard-card p-5 bg-white space-y-3 relative overflow-hidden">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-lg font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                      Code {row.code}
                    </span>
                    <p className="mt-2 text-sm font-semibold text-slate-800 leading-snug">{row.title}</p>
                  </div>
                  <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 font-mono text-xs font-bold text-rose-800">
                    {formatCount(row.count)}
                  </span>
                </div>

                {metaInfo && (
                  <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs space-y-1">
                    <p className="font-semibold text-slate-700">{metaInfo.category}: <span className="font-normal text-slate-600">{metaInfo.description}</span></p>
                    <p className="text-emerald-700 font-medium">Fix: {metaInfo.advice}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Org Incidents Table */}
      <SectionCard title="Recent Impacted Organizations" purpose="Drill directly into the affected organization's error diagnostics tab.">
        {data.recent.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-400">No organizational hits in this timeframe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Error Code</th>
                  <th>Incident Description</th>
                  <th>Count</th>
                  <th>Last Occurred</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((row, index) => (
                  <tr
                    key={`${row.organizationId}-${row.code}-${index}`}
                    {...clickableRowProps(() => navigate(`/accounts/${row.organizationId}?tab=errors`))}
                  >
                    <td>
                      <p className="font-bold text-slate-900">{row.companyName}</p>
                    </td>
                    <td className="font-mono text-xs font-bold text-rose-700">{row.code}</td>
                    <td className="text-xs text-slate-600">{row.sampleTitle || row.title}</td>
                    <td className="font-mono text-xs font-semibold text-slate-900">{formatCount(row.count)}</td>
                    <td className="text-xs text-slate-500">{formatWhen(row.lastAt)}</td>
                    <td className="text-right">
                      <span className="text-xs font-semibold text-emerald-700">Triage →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
