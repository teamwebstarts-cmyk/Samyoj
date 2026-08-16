import { useEffect, useState } from 'react';
import { platformRequest } from '../api';

type Audit = {
  rows: Array<{
    id: string;
    action: string;
    companyName: string | null;
    operatorEmail: string;
    reason: string | null;
    createdAt: string;
  }>;
};

export function AuditPage() {
  const [data, setData] = useState<Audit | null>(null);
  useEffect(() => {
    void platformRequest<Audit>('/audit').then(setData);
  }, []);
  if (!data) return <p>Loading audit…</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
      <div className="overflow-hidden rounded-2xl border border-dust bg-white">
        {data.rows.map((row) => (
          <div key={row.id} className="border-b border-dust px-4 py-3 last:border-0">
            <p className="font-semibold">{row.action}</p>
            <p className="text-xs text-ink/50">
              {row.operatorEmail} · {row.companyName || 'platform'} · {row.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
