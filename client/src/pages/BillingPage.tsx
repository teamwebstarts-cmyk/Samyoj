import { useCallback, useEffect, useState } from 'react';
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
import BillingHero from '../components/billing/BillingHero';
import BillingPlanCard from '../components/billing/BillingPlanCard';
import BillingFeatureMatrix from '../components/billing/BillingFeatureMatrix';
import MetaCostExplainerCard from '../components/billing/MetaCostExplainerCard';
import BillingSkeleton from '../components/billing/BillingSkeleton';
import BillingUsageWidget from '../components/billing/BillingUsageWidget';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import PageShell from '../components/ui/PageShell';
import SectionCard from '../components/ui/SectionCard';
import SegmentedControl from '../components/ui/SegmentedControl';
import { billingApi, settingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { BillingInfo, BillingPlan, BillingUsage } from '../types';
import { openRazorpayCheckout } from '../utils/razorpay';
import { toastError, toastSuccess } from '../utils/toast';

type BillingTab = 'overview' | 'plans' | 'history';
type CadenceTab = 'monthly' | 'quarterly' | 'yearly';

const tabMeta = {
  overview: { label: 'Overview', shortLabel: 'Overview', icon: LayoutGrid },
  plans: { label: 'Plans', shortLabel: 'Plans', icon: CreditCard },
  history: { label: 'History', shortLabel: 'History', icon: Receipt },
} as const;

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
  const [cadence, setCadence] = useState<CadenceTab>('monthly');
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
        {loading || !info ? (
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
        ) : (
          <>
            <BillingHero info={info} usage={usage} />

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
              <div className="space-y-6">
                <BillingCurrentPlanHero info={info} onUnlockGrowth={() => setTab('plans')} />
                {usage && <BillingUsageWidget usage={usage} dailyBudgetInr={dailyBudgetInr} />}
                <MetaCostExplainerCard />
              </div>
            )}

            {tab === 'plans' && (
              <div className="space-y-8">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-theme-muted">
                    Choose billing frequency
                  </span>
                  <SegmentedControl
                    value={cadence}
                    onChange={(v) => setCadence(v as CadenceTab)}
                    options={[
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'quarterly', label: 'Quarterly · Save 5%' },
                      { value: 'yearly', label: 'Yearly · Save 20%' },
                    ]}
                    ariaLabel="Billing cadence"
                  />
                </div>

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
                        cadence={cadence}
                      />
                    </div>
                  ))}
                </div>

                <BillingFeatureMatrix currentPlan={info.plan} />

                <MetaCostExplainerCard />
              </div>
            )}

            {tab === 'history' && (
              <SectionCard
                title="Billing history & invoices"
                subtitle="Official GST receipts and payment transactions"
              >
                {!info.recentPayments || info.recentPayments.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No payments yet"
                    description="Your payment history and downloadable GST invoices will show up here after you upgrade to a paid plan."
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
                      const basePaise = Math.round(payment.amountPaise / 1.18);
                      const gstPaise = payment.amountPaise - basePaise;
                      return (
                        <div
                          key={`${payment.planId}-${payment.paidAt ?? i}`}
                          className="dashboard-card flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                              <Receipt className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-theme-fg">{planName} Plan</p>
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                  GST Paid
                                </span>
                              </div>
                              <p className="text-[12px] text-theme-muted">
                                {formatPaidAt(payment.paidAt)} · SAC 998315
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-1 sm:items-end">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                                {formatAmount(payment.amountPaise)}
                              </span>
                              <span className="text-[11px] font-medium text-theme-muted">incl. 18% GST</span>
                            </div>
                            <p className="text-[11px] text-theme-muted">
                              Base: {formatAmount(basePaise)} · GST: {formatAmount(gstPaise)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
