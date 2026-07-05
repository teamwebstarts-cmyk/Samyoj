import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  LayoutGrid,
  Receipt,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import AppAlert from '../components/ui/AppAlert';
import AppButton from '../components/ui/AppButton';
import BillingCurrentPlanHero from '../components/billing/BillingCurrentPlanHero';
import BillingPlanCard from '../components/billing/BillingPlanCard';
import BillingSkeleton from '../components/billing/BillingSkeleton';
import BillingUsageWidget from '../components/billing/BillingUsageWidget';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SectionCard from '../components/ui/SectionCard';
import SegmentedControl from '../components/ui/SegmentedControl';
import { billingApi, settingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { BillingInfo, BillingPlan, BillingUsage } from '../types';
import { openRazorpayCheckout } from '../utils/razorpay';
import { toastError, toastSuccess } from '../utils/toast';

type BillingTab = 'overview' | 'plans' | 'history';

const tabMeta = {
  overview: { label: 'Overview', shortLabel: 'Overview', icon: LayoutGrid },
  plans: { label: 'Plans', shortLabel: 'Plans', icon: CreditCard },
  history: { label: 'History', shortLabel: 'History', icon: Receipt },
} as const;

const heroCopy: Record<BillingTab, { title: string; description: string }> = {
  overview: {
    title: 'Billing overview',
    description: 'Your current plan, seat usage, and WhatsApp conversation costs.',
  },
  plans: {
    title: 'Choose a plan',
    description: 'Scale seats and features as your team grows. Pay securely with Razorpay.',
  },
  history: {
    title: 'Payment history',
    description: 'Recent successful plan payments and transactions.',
  },
};

function formatAmount(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatPaidAt(value: string | null) {
  if (!value) return 'Pending confirmation';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function BillingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<BillingTab>('overview');
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [dailyBudgetInr, setDailyBudgetInr] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadFailed(false);
    setLoading(true);
    Promise.all([billingApi.get(), billingApi.usage(), settingsApi.get()])
      .then(([billingRes, usageRes, settingsRes]) => {
        setInfo(billingRes.data.data);
        setUsage(usageRes.data.data);
        const campaign = settingsRes.data.data?.campaigns as { dailyBudgetInr?: number } | undefined;
        setDailyBudgetInr(campaign?.dailyBudgetInr);
      })
      .catch(() => {
        setLoadFailed(true);
        toastError('Failed to load billing');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFreePlan = async (plan: BillingPlan) => {
    if (!info?.canManageBilling || plan.id === info.plan) return;
    setUpgrading(plan.id);
    try {
      await billingApi.updatePlan(plan.id);
      toastSuccess(`Plan updated to ${plan.name}`);
      load();
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to update plan'
      );
    } finally {
      setUpgrading(null);
    }
  };

  const handlePaidPlan = async (plan: BillingPlan) => {
    if (!info?.canManageBilling || !info.razorpayKeyId) return;
    setUpgrading(plan.id);
    try {
      const { data } = await billingApi.createOrder(plan.id);
      const order = data.data;

      await openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'WhatsApp Platform',
        description: `${order.planName} plan — monthly`,
        prefillEmail: user?.email,
        onSuccess: async (response) => {
          try {
            await billingApi.verifyPayment({
              ...response,
              planId: plan.id as 'growth' | 'business',
            });
            toastSuccess('Payment successful! Plan upgraded.');
            load();
          } catch {
            toastError('Payment verification failed — contact support');
          } finally {
            setUpgrading(null);
          }
        },
        onDismiss: () => setUpgrading(null),
      });
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to start checkout'
      );
      setUpgrading(null);
    }
  };

  const handleUpgrade = (plan: BillingPlan) => {
    if (!info?.canManageBilling || plan.id === info.plan) return;
    if (plan.id === 'enterprise') {
      toastError('Contact sales for Enterprise');
      return;
    }
    if (plan.pricePaise > 0) {
      void handlePaidPlan(plan);
    } else {
      void handleFreePlan(plan);
    }
  };

  const heroStats = useMemo(() => {
    if (!info) return [];
    return [
      {
        label: 'Seats',
        value: `${info.seatsUsed}/${info.seatLimit}`,
        tone: 'text-emerald-700 dark:text-emerald-300',
      },
      {
        label: 'Usage est.',
        value: usage ? `₹${usage.totalCostInr.toLocaleString('en-IN')}` : '—',
        tone: 'text-sky-700 dark:text-sky-300',
      },
      {
        label: 'Payments',
        value: info.recentPayments?.length ?? 0,
        tone: 'text-violet-700 dark:text-violet-300',
      },
    ];
  }, [info, usage]);

  const copy = heroCopy[tab];

  return (
    <PageShell>
      <PageHeader
        actions={
          <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
            Refresh
          </AppButton>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Billing"
          badgeIcon={CreditCard}
          title={copy.title}
          description={copy.description}
          accent="emerald"
          stats={loading || !info ? [] : heroStats}
        />

        {loading ? (
          <BillingSkeleton />
        ) : loadFailed ? (
          <EmptyState
            icon={ShieldAlert}
            variant="error"
            title="Could not load billing"
            description="Something went wrong while loading your billing info. Please try again."
            action={
              <AppButton variant="secondary" onClick={load}>
                Try again
              </AppButton>
            }
          />
        ) : info ? (
          <>
            <SegmentedControl
              value={tab}
              onChange={(v) => setTab(v as BillingTab)}
              options={[
                { value: 'overview', ...tabMeta.overview },
                { value: 'plans', ...tabMeta.plans },
                { value: 'history', ...tabMeta.history },
              ]}
              ariaLabel="Billing sections"
            />

            {!info.canManageBilling && (
              <AppAlert variant="info">
                Only organization admins can change plans. Contact your admin to upgrade.
              </AppAlert>
            )}

            {!info.razorpayConfigured && tab === 'plans' && (
              <AppAlert variant="info">
                Paid checkout is unavailable — Razorpay is not configured on the server.
              </AppAlert>
            )}

            {tab === 'overview' && (
              <div className="space-y-5">
                <BillingCurrentPlanHero info={info} />
                {usage && <BillingUsageWidget usage={usage} dailyBudgetInr={dailyBudgetInr} />}
              </div>
            )}

            {tab === 'plans' && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {info.plans.map((plan, index) => (
                  <div key={plan.id} style={{ animationDelay: `${index * 60}ms` }}>
                    <BillingPlanCard
                      plan={plan}
                      isCurrent={plan.id === info.plan}
                      canManage={info.canManageBilling}
                      razorpayConfigured={info.razorpayConfigured}
                      loading={upgrading === plan.id}
                      onSelect={() => handleUpgrade(plan)}
                    />
                  </div>
                ))}
              </div>
            )}

            {tab === 'history' && (
              <SectionCard title="Recent payments" subtitle="Successful plan transactions">
                {!info.recentPayments || info.recentPayments.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No payments yet"
                    description="Your payment history will show up here after you upgrade to a paid plan."
                    compact
                    action={
                      <AppButton variant="secondary" onClick={() => setTab('plans')}>
                        View plans
                      </AppButton>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {info.recentPayments.map((payment, i) => {
                      const planName =
                        info.plans.find((p) => p.id === payment.planId)?.name ?? payment.planId;
                      return (
                        <div
                          key={`${payment.planId}-${payment.paidAt ?? i}`}
                          className="dashboard-card flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                              <Receipt className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-theme-fg">{planName} plan</p>
                              <p className="text-[12px] text-theme-muted">
                                {formatPaidAt(payment.paidAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 sm:pl-0">
                            <span className="text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                              {formatAmount(payment.amountPaise)}
                            </span>
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                              Paid
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            )}
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
