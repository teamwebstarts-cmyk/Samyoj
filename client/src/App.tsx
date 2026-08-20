import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { WhatsAppNumberProvider } from './contexts/WhatsAppNumberContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TypographyProvider } from './contexts/TypographyContext';
import { DensityProvider } from './contexts/DensityContext';
import { CardSpacingProvider } from './contexts/CardSpacingContext';
import { PageGutterProvider } from './contexts/PageGutterContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import AutomationsPage from './pages/AutomationsPage';
import FlowBuilderPage from './pages/FlowBuilderPage';
import MetaFlowBuilder from './pages/MetaFlowBuilder';
import AiBotPage from './pages/AiBotPage';
import CampaignsPage from './pages/CampaignsPage';
import CampaignWizardPage from './pages/CampaignWizardPage';
import ContactsPage from './pages/ContactsPage';
import TeamPage from './pages/TeamPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import SettingsPage from './pages/SettingsPage';
import WhatsappCallbackPage from './pages/WhatsappCallbackPage';
import CallsPage from './pages/CallsPage';
import TemplatesPage from './pages/TemplatesPage';
import TemplateWizardPage from './pages/TemplateWizardPage';
import TemplateLibraryPage from './pages/TemplateLibraryPage';
import ReportsPage from './pages/ReportsPage';
import BillingPage from './pages/BillingPage';
import ContentStudioPage from './pages/ContentStudioPage';
import CommercePage from './pages/CommercePage';
import TicketsPage from './pages/TicketsPage';
import OnboardingGate from './components/OnboardingGate';
import { AppToaster } from './utils/toast';

const ComponentShowcase = import.meta.env.DEV
  ? lazy(() => import('./pages/dev/ComponentShowcase'))
  : null;

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TypographyProvider>
        <DensityProvider>
        <CardSpacingProvider>
        <PageGutterProvider>
        <AuthProvider>
          <WhatsAppNumberProvider>
            <AppToaster />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/invite/:token" element={<AcceptInvitePage />} />
                {/* Outside ProtectedRoute so Meta's ?code=&state= can be read/stashed
                    even before auth hydrates. Page itself requires a signed-in user. */}
                <Route path="/settings/whatsapp/callback" element={<WhatsappCallbackPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={<Navigate to="/" replace />} />
                  <Route element={<OnboardingGate />}>
                    <Route element={<Layout />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/inbox" element={<InboxPage />} />
                      <Route path="/calls" element={<CallsPage />} />
                      <Route path="/calls/:callId" element={<CallsPage />} />
                      <Route path="/automations" element={<AutomationsPage />} />
                      <Route path="/automations/flows/:id" element={<FlowBuilderPage />} />
                      <Route path="/automations/meta-flows/:id" element={<MetaFlowBuilder />} />
                      <Route path="/ai-bot" element={<AiBotPage />} />
                      <Route path="/campaigns" element={<CampaignsPage />} />
                      <Route path="/campaigns/new" element={<CampaignWizardPage />} />
                      <Route path="/campaigns/:id/edit" element={<CampaignWizardPage />} />
                      <Route path="/templates" element={<TemplatesPage />} />
                      <Route path="/templates/library" element={<TemplateLibraryPage />} />
                      <Route path="/templates/new" element={<TemplateWizardPage />} />
                      <Route path="/templates/:name/resubmit" element={<TemplateWizardPage />} />
                      <Route path="/content-studio" element={<ContentStudioPage />} />
                      <Route path="/commerce" element={<CommercePage />} />
                      <Route path="/tickets" element={<TicketsPage />} />
                      <Route path="/contacts" element={<ContactsPage />} />
                      <Route path="/team" element={<TeamPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/billing" element={<BillingPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      {import.meta.env.DEV && ComponentShowcase && (
                        <Route
                          path="/dev/components"
                          element={
                            <Suspense fallback={null}>
                              <ComponentShowcase />
                            </Suspense>
                          }
                        />
                      )}
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </WhatsAppNumberProvider>
        </AuthProvider>
        </PageGutterProvider>
        </CardSpacingProvider>
        </DensityProvider>
        </TypographyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
