import { FileText } from 'lucide-react';

export interface TemplateMetric {
  templateName: string;
  sent: number;
  delivered: number;
  read: number;
  deliveryRate: string;
  campaigns: number;
}

interface ReportsTemplateTableProps {
  templates: TemplateMetric[];
  periodDays: number;
}

export default function ReportsTemplateTable({
  templates,
  periodDays,
}: ReportsTemplateTableProps) {
  if (templates.length === 0) return null;

  const rows = templates.slice(0, 10);

  return (
    <div className="dashboard-card overflow-hidden animate-fade-up-delay">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-theme-border bg-theme-subtle/50 px-5 py-4">
        <div>
          <h3 className="text-base font-extrabold tracking-tight text-theme-fg">Template success rates</h3>
          <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
            Delivery & read performance by template over the last {periodDays} days
          </p>
        </div>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-800 ring-1 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-800/50">
          {rows.length} templates
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-theme-border text-[10px] font-bold uppercase tracking-[0.08em] text-theme-muted">
              <th className="px-5 py-3">Template</th>
              <th className="px-5 py-3">Campaigns</th>
              <th className="px-5 py-3">Sent</th>
              <th className="px-5 py-3">Delivered</th>
              <th className="px-5 py-3">Read</th>
              <th className="px-5 py-3">Delivery %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((template) => (
              <tr
                key={template.templateName}
                className="border-t border-theme-border transition-colors hover:bg-theme-subtle/40"
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                      <FileText className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </div>
                    <span className="font-semibold text-theme-fg">{template.templateName}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 tabular-nums text-theme-secondary">{template.campaigns}</td>
                <td className="px-5 py-3.5 tabular-nums font-semibold text-theme-fg">
                  {template.sent.toLocaleString()}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-theme-secondary">
                  {template.delivered.toLocaleString()}
                </td>
                <td className="px-5 py-3.5 tabular-nums text-theme-secondary">
                  {template.read.toLocaleString()}
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex min-w-[3rem] items-center justify-center rounded-lg bg-emerald-50 px-2 py-0.5 text-[12px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {template.deliveryRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
