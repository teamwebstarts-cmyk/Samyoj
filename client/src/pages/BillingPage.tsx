import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  LayoutGrid,
  Receipt,
  ShieldAlert,
} from 'lucide-react';
import AppAlert from '../components/ui/AppAlert';
import AppButton from '../components/ui/AppButton';
import BillingCurrentPlanHero from '../components/billing/BillingCurrentPlanHero';
import BillingCadenceToggle from '../components/billing/BillingCadenceToggle';
import BillingHero from '../components/billing/BillingHero';
import BillingPlanCard from '../components/billing/BillingPlanCard';
import BillingFeatureMatrix from '../components/billing/BillingFeatureMatrix';
import MetaCostExplainerCard from '../components/billing/MetaCostExplainerCard';
import BillingSkeleton from '../components/billing/BillingSkeleton';
import BillingUsageStatsTab from '../components/billing/BillingUsageStatsTab';
import EmptyState from '../components/ui/EmptyState';
import PageShell from '../components/ui/PageShell';
import SectionCard from '../components/ui/SectionCard';
import SegmentedControl from '../components/ui/SegmentedControl';
import { analyticsApi, billingApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { BillingInfo, BillingPlan, BillingUsage, ReportsOverviewFullData } from '../types';
import { openRazorpayCheckout } from '../utils/razorpay';
import { toastError, toastSuccess } from '../utils/toast';

type BillingTab = 'overview' | 'usage' | 'plans' | 'history';
type CadenceTab = 'monthly' | 'quarterly' | 'yearly';

const tabMeta = {
  overview: { label: 'Overview', shortLabel: 'Overview', icon: LayoutGrid },
  usage: { label: 'Usage & Stats', shortLabel: 'Usage', icon: BarChart3 },
  plans: { label: 'Plans & Pricing', shortLabel: 'Plans', icon: CreditCard },
  history: { label: 'Invoices & History', shortLabel: 'History', icon: Receipt },
} as const;

export default function BillingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as BillingTab;
  const initialTab: BillingTab = ['overview', 'usage', 'plans', 'history'].includes(tabParam)
    ? tabParam
    : 'overview';

  const [tab, setTab] = useState<BillingTab>(initialTab);
  const [cadence, setCadence] = useState<CadenceTab>('monthly');
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [overview, setOverview] = useState<ReportsOverviewFullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    if (tabParam && ['overview', 'usage', 'plans', 'history'].includes(tabParam) && tabParam !== tab) {
      setTab(tabParam);
    }
  }, [tabParam, tab]);

  const handleTabChange = (newTab: BillingTab) => {
    setTab(newTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (newTab === 'overview') {
          next.delete('tab');
        } else {
          next.set('tab', newTab);
        }
        return next;
      },
      { replace: true }
    );
  };

  const load = useCallback(() => {
    setLoadFailed(false);
    setLoading(true);
    Promise.all([
      billingApi.get(),
      billingApi.usage(),
      analyticsApi.overview({ days: '30' }).catch(() => null),
    ])
      .then(([billingRes, usageRes, overviewRes]) => {
        setInfo(billingRes.data.data);
        setUsage(usageRes.data.data);
        if (overviewRes?.data?.data) {
          setOverview(overviewRes.data.data);
        }
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
      const res = await billingApi.createOrder(plan.id, cadence);
      const { orderId, amount, currency, keyId } = res.data.data;
      openRazorpayCheckout({
        keyId,
        amount,
        currency,
        orderId,
        name: 'Samyoj Platform',
        description: `Upgrade to ${plan.name} — ${cadence} billing`,
        prefillEmail: user?.email,
        onSuccess: async (response) => {
          try {
            await billingApi.verifyPayment(response);
            toastSuccess(`Welcome to ${plan.name}!`);
            load();
          } catch {
            toastError('Payment verification failed. Please contact support.');
          } finally {
            setUpgrading(null);
          }
        },
        onDismiss: () => setUpgrading(null),
      });
    } catch (err: unknown) {
      setUpgrading(null);
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to initiate upgrade'
      );
    }
  };

  const handleUpgrade = (plan: BillingPlan) => {
    if (plan.pricePaise === 0) {
      handleFreePlan(plan);
    } else {
      handlePaidPlan(plan);
    }
  };

  const handleExportCsv = async () => {
    try {
      const response = await analyticsApi.exportCsv({ type: 'overview', days: '30' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `samyoj-usage-summary-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toastError('Failed to export CSV');
    }
  };

  return (
    <PageShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-theme-fg sm:text-2xl">
              Billing & Usage
            </h1>
            <p className="text-xs font-medium text-theme-secondary">
              Manage your subscription, track resource quotas, and review usage charges
            </p>
          </div>
        </div>

        {loading ? (
          <BillingSkeleton />
        ) : loadFailed || !info ? (
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
            {/* Stationary Top Tab Bar */}
            <SegmentedControl
              embedded
              value={tab}
              onChange={(v) => handleTabChange(v as BillingTab)}
              options={[
                { value: 'overview', ...tabMeta.overview },
                { value: 'usage', ...tabMeta.usage },
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

            {/* TAB 1: OVERVIEW */}
            {tab === 'overview' && (
              <div className="space-y-6">
                <BillingHero info={info} usage={usage} />
                <BillingCurrentPlanHero info={info} onUnlockGrowth={() => handleTabChange('plans')} />
                <MetaCostExplainerCard />
              </div>
            )}

            {/* TAB 2: USAGE & STATS */}
            {tab === 'usage' && (
              <BillingUsageStatsTab
                info={info}
                usage={usage}
                overview={overview}
                onUpgradeClick={() => handleTabChange('plans')}
                onExportCsv={handleExportCsv}
              />
            )}

            {/* TAB 3: PLANS & PRICING */}
            {tab === 'plans' && (
              <div className="space-y-8">
                <div className="flex flex-col items-center gap-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-theme-muted">
                    Choose billing frequency
                  </span>
                  <BillingCadenceToggle
                    value={cadence}
                    onChange={(v) => setCadence(v as CadenceTab)}
                    options={[
                      { value: 'monthly', label: 'Monthly' },
                      { value: 'quarterly', label: 'Quarterly', savings: 'Save 5%' },
                      { value: 'yearly', label: 'Yearly', savings: 'Save 20%' },
                    ]}
                  />
                  <p className="text-center text-[11px] text-theme-muted">
                    Longer commitments provide additional savings on base plan pricing.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-5">
                  {info.plans.map((plan) => (
                    <BillingPlanCard
                      key={plan.id}
                      plan={plan}
                      isCurrent={plan.id === info.plan}
                      canManage={info.canManageBilling}
                      razorpayConfigured={info.razorpayConfigured}
                      loading={upgrading === plan.id}
                      onSelect={() => handleUpgrade(plan)}
                      cadence={cadence}
                    />
                  ))}
                </div>

                <BillingFeatureMatrix currentPlan={info.plan} />

                <MetaCostExplainerCard />
              </div>
            )}

            {/* TAB 4: INVOICES & HISTORY */}
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
                      <AppButton variant="secondary" onClick={() => handleTabChange('plans')}>
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
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <Receipt className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-bold text-theme-fg">{planName}</p>
                              <p className="text-[11px] text-theme-muted">
                                Paid on {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'N/A'} · Base: ₹{(basePaise / 100).toLocaleString('en-IN')} + GST (18%): ₹{(gstPaise / 100).toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black tabular-nums text-theme-fg">
                              ₹{(payment.amountPaise / 100).toLocaleString('en-IN')}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
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
        )}
      </div>
    </PageShell>
  );
}
