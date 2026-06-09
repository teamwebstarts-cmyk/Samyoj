import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import AutomationsPage from './pages/AutomationsPage';
import FlowBuilderPage from './pages/FlowBuilderPage';
import AiBotPage from './pages/AiBotPage';
import CampaignsPage from './pages/CampaignsPage';
import ContactsPage from './pages/ContactsPage';
import TeamPage from './pages/TeamPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import SettingsPage from './pages/SettingsPage';
import WhatsappCallbackPage from './pages/WhatsappCallbackPage';
import CallsPage from './pages/CallsPage';
import TemplatesPage from './pages/TemplatesPage';
import ReportsPage from './pages/ReportsPage';
import BillingPage from './pages/BillingPage';
import { AppToaster } from './utils/toast';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <AuthProvider>
        <AppToaster />
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/settings/whatsapp/callback" element={<WhatsappCallbackPage />} />
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/calls" element={<CallsPage />} />
              <Route path="/calls/:callId" element={<CallsPage />} />
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/automations/flows/:id" element={<FlowBuilderPage />} />
              <Route path="/ai-bot" element={<AiBotPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
