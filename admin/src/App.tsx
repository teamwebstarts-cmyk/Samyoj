import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ApiError, platformRequest } from './api';
import { Shell } from './components/Shell';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { AccountsPage } from './pages/AccountsPage';
import { AuditPage } from './pages/AuditPage';
import { ErrorsPage } from './pages/ErrorsPage';
import { LoginPage } from './pages/LoginPage';
import { OperatorsPage } from './pages/OperatorsPage';
import { OutreachPage } from './pages/OutreachPage';
import { OverviewPage } from './pages/OverviewPage';
import type { Operator } from './types';

function Protected({ operator }: { operator: Operator | null }) {
  if (!operator) return <Navigate to="/login" replace />;
  return <Shell operator={operator} />;
}

export default function App() {
  const [operator, setOperator] = useState<Operator | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    platformRequest<{ operator: Operator }>('/auth/me')
      .then((data) => setOperator(data.operator))
      .catch((error) => {
        if (!(error instanceof ApiError && error.status === 401)) {
          setOperator(null);
        }
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <div className="p-8 text-sm text-ink/60">Loading…</div>;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected operator={operator} />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route path="/errors" element={<ErrorsPage />} />
        <Route path="/outreach" element={<OutreachPage />} />
        <Route path="/operators" element={<OperatorsPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
