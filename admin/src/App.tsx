import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from './components/Shell';
import { Notice } from './components/ui/index';
import { OperatorProvider, useOperator } from './context/OperatorContext';
import { canAccessPath } from './lib/routes';
import { AccountDetailPage } from './pages/AccountDetailPage';
import { AccountsPage } from './pages/AccountsPage';
import { AuditPage } from './pages/AuditPage';
import { ErrorsPage } from './pages/ErrorsPage';
import { LoginPage } from './pages/LoginPage';
import { OperatorsPage } from './pages/OperatorsPage';
import { OutreachPage } from './pages/OutreachPage';
import { OverviewPage } from './pages/OverviewPage';

function Protected() {
  const { operator, ready } = useOperator();
  if (!ready) return <div className="p-8 text-sm text-ink/60">Loading…</div>;
  if (!operator) return <Navigate to="/login" replace />;
  return <Shell />;
}

function RoleGate() {
  const { operator } = useOperator();
  const location = useLocation();
  if (!operator) return null;
  if (!canAccessPath(operator.role, location.pathname)) {
    return <Notice>You do not have access to this screen.</Notice>;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <OperatorProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Protected />}>
          <Route element={<RoleGate />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/errors" element={<ErrorsPage />} />
            <Route path="/outreach" element={<OutreachPage />} />
            <Route path="/operators" element={<OperatorsPage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OperatorProvider>
  );
}
