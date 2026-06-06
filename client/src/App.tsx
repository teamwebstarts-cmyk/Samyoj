import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import AutomationsPage from './pages/AutomationsPage';
import AiBotPage from './pages/AiBotPage';
import CampaignsPage from './pages/CampaignsPage';
import ContactsPage from './pages/ContactsPage';
import TeamPage from './pages/TeamPage';
import SettingsPage from './pages/SettingsPage';
import WhatsappCallbackPage from './pages/WhatsappCallbackPage';
import CallsPage from './pages/CallsPage';
import TemplatesPage from './pages/TemplatesPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/settings/whatsapp/callback" element={<WhatsappCallbackPage />} />
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/calls" element={<CallsPage />} />
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/ai-bot" element={<AiBotPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}
