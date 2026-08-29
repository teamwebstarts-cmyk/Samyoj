import {
  CheckCheck,
  Eye,
  Megaphone,
  Send,
} from 'lucide-react';
import UniversalTemplateTable from '../tables/UniversalTemplateTable';
import type { ReportsCampaignsData } from '../../../types';

interface ReportsCampaignsTabProps {
  data: ReportsCampaignsData;
  onExportCsv: () => void;
}

export default function ReportsCampaignsTab({
  data,
  onExportCsv,
}: ReportsCampaignsTabProps) {
  const { summary, universalTemplates, campaigns } = data;

  const kpis = [
    {
      title: 'Campaigns Dispatched',
      value: summary.totalCampaigns.toLocaleString(),
      sub: `${summary.totalRecipients.toLocaleString()} total target contacts`,
      icon: Megaphone,
      bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    },
    {
      title: 'Broadcast Messages Sent',
      value: summary.totalSent.toLocaleString(),
      sub: `${summary.totalDelivered.toLocaleString()} delivered`,
      icon: Send,
      bg: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
    },
    {
      title: 'Overall Delivery Rate',
      value: `${summary.overallDeliveryRate}%`,
      sub: `${summary.totalFailed.toLocaleString()} failed dispatches`,
      icon: CheckCheck,
      bg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    },
    {
      title: 'Overall Read Rate',
      value: `${summary.overallReadRate}%`,
      sub: `${summary.totalRead.toLocaleString()} read by recipients`,
      icon: Eye,
      bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Broadcast Summary Strip */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              className="dashboard-card relative flex flex-col justify-between p-4 transition hover:border-whatsapp-500/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                  {kpi.title}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="mt-3">
                <p className="text-2xl font-black tabular-nums tracking-tight text-theme-fg">
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-theme-muted truncate">
                  {kpi.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Universal Template Matrix */}
      <UniversalTemplateTable templates={universalTemplates} onExportCsv={onExportCsv} />

      {/* Recent Campaign Performance Table */}
      {campaigns.length > 0 && (
        <div className="dashboard-card overflow-hidden">
          <div className="border-b border-theme-border bg-theme-subtle/50 px-5 py-4">
            <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
              Recent Broadcast Campaigns
            </h3>
            <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
              Direct dispatch performance for recent marketing broadcasts
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-theme-border text-[10px] font-bold uppercase tracking-[0.08em] text-theme-muted">
                  <th className="px-5 py-3">Campaign Name</th>
                  <th className="px-5 py-3">Template</th>
                  <th className="px-5 py-3">Recipients</th>
                  <th className="px-5 py-3">Sent</th>
                  <th className="px-5 py-3">Delivered</th>
                  <th className="px-5 py-3">Read</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-theme-border/60 transition-colors hover:bg-theme-subtle/40"
                  >
                    <td className="px-5 py-3.5 font-bold text-theme-fg">{c.name}</td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-theme-secondary">
                      {c.templateName}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-theme-muted">
                      {c.totalContacts.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-semibold tabular-nums text-theme-fg">
                      {c.sentCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-emerald-700 dark:text-emerald-300">
                      {c.deliveredCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-sky-700 dark:text-sky-300">
                      {c.readCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
