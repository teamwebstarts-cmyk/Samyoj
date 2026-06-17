import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  MessageSquare,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import ProgressBar from '../components/ui/ProgressBar';
import LoadingState from '../components/ui/LoadingState';
import { onboardingApi } from '../services/api';
import { toastError } from '../utils/toast';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href?: string;
}

interface OnboardingStatus {
  steps: OnboardingStep[];
  progress: number;
  isReady: boolean;
  completedCount: number;
  totalSteps: number;
}

const stepIcons: Record<string, typeof MessageSquare> = {
  connect_whatsapp: MessageSquare,
  send_test_message: Sparkles,
  import_contacts: Users,
  setup_automation: Zap,
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);

  const load = () => {
    onboardingApi
      .status()
      .then((res) => {
        const data = res.data.data as OnboardingStatus;
        setStatus(data);
        const firstIncomplete = data.steps.findIndex((s) => !s.completed);
        setActiveStep(firstIncomplete >= 0 ? firstIncomplete : data.steps.length - 1);
      })
      .catch(() => toastError('Failed to load onboarding status'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCompleteStep = async (stepId: string) => {
    try {
      await onboardingApi.completeStep(stepId);
      load();
    } catch {
      toastError('Failed to mark step complete');
    }
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingState label="Loading onboarding..." className="mx-auto max-w-2xl pt-8" />
      </PageShell>
    );
  }

  if (!status) return null;

  const current = status.steps[activeStep];
  const StepIcon = stepIcons[current?.id] || Circle;

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl pb-10">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-300">
            <Sparkles className="h-3 w-3" />
            Getting started
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-theme-fg sm:text-3xl">
            Welcome — let&apos;s set up your workspace
          </h1>
          <p className="mt-2 text-[14px] font-medium text-theme-secondary">
            Complete these {status.totalSteps} steps to start messaging customers on WhatsApp.
          </p>
        </div>

        <ProgressBar
          value={status.progress}
          label={`${status.completedCount} of ${status.totalSteps} complete`}
          className="mb-6"
        />

        <div className="mb-6 flex justify-center gap-2">
          {status.steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(index)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border text-[12px] font-bold transition-colors ${
                step.completed
                  ? 'border-whatsapp-500 bg-whatsapp-500 text-white'
                  : index === activeStep
                    ? 'border-whatsapp-500 bg-whatsapp-50 text-whatsapp-700 dark:bg-whatsapp-900/30 dark:text-whatsapp-300'
                    : 'border-theme-border bg-theme-surface text-theme-muted'
              }`}
              aria-label={`Step ${index + 1}: ${step.title}`}
            >
              {step.completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </button>
          ))}
        </div>

        {current && (
          <div className="dashboard-card overflow-hidden animate-fade-up">
            <div className="border-b border-theme-border bg-theme-subtle/50 px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]">
                  <StepIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                    Step {activeStep + 1} of {status.totalSteps}
                  </p>
                  <h2 className="mt-1 text-lg font-extrabold text-theme-fg">{current.title}</h2>
                  <p className="mt-1 text-[13px] font-medium text-theme-secondary">
                    {current.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 px-6 py-5">
              {status.steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] ${
                    step.completed
                      ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-900/20'
                      : 'border-theme-border bg-theme-surface'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-whatsapp-600" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-theme-muted" />
                  )}
                  <span className={`font-semibold ${step.completed ? 'text-theme-secondary' : 'text-theme-fg'}`}>
                    {step.title}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-theme-border px-6 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={activeStep === 0}
                onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                className="rounded-xl border border-theme-border px-4 py-2 text-[13px] font-semibold text-theme-secondary transition hover:bg-theme-subtle disabled:opacity-40"
              >
                Previous
              </button>

              <div className="flex gap-2">
                {current.href && (
                  <Link
                    to={current.href}
                    className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold"
                  >
                    Go to step
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                {!current.completed && (
                  <button
                    type="button"
                    onClick={() => handleCompleteStep(current.id)}
                    className="rounded-xl border border-theme-border px-4 py-2 text-[13px] font-semibold text-theme-secondary transition hover:bg-theme-subtle"
                  >
                    Mark complete
                  </button>
                )}
              </div>

              {activeStep < status.steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((s) => s + 1)}
                  className="rounded-xl border border-theme-border px-4 py-2 text-[13px] font-semibold text-theme-secondary transition hover:bg-theme-subtle"
                >
                  Next
                </button>
              ) : status.isReady ? (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold"
                >
                  Finish setup
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
