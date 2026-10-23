import { ShieldOff } from 'lucide-react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { EmptyState, PageLoading } from './components/ui/index';
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
import { BillingConfigPage } from './pages/BillingConfigPage';
import { TemplateCatalogPage } from './pages/TemplateCatalogPage';
import { TemplateEditorPage } from './pages/TemplateEditorPage';
import { Shell } from './components/Shell';

function Protected() {
  const { operator, ready } = useOperator();
  if (!ready) return <PageLoading label="Checking session…" />;
  if (!operator) return <Navigate to="/login" replace />;
  return <Shell />;
}

function RoleGate() {
  const { operator } = useOperator();
  const location = useLocation();
  if (!operator) return null;
  if (!canAccessPath(operator.role, location.pathname)) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="You do not have access to this screen"
        description="ANALYST is read-only. Outreach is SUPPORT and above. Operators and sessions are SUPER_ADMIN only."
      />
    );
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
            <Route path="/billing" element={<BillingConfigPage />} />
            <Route path="/library" element={<TemplateCatalogPage />} />
            <Route path="/library/new" element={<TemplateEditorPage key="new" />} />
            <Route path="/library/:id/edit" element={<TemplateEditorPage key="edit" />} />
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
