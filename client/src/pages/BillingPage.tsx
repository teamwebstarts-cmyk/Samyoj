import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  Receipt,
  ShieldAlert,
} from 'lucide-react';
import AppAlert from '../components/ui/AppAlert';
import AppButton from '../components/ui/AppButton';
import BillingHero from '../components/billing/BillingHero';
import BillingCadenceToggle from '../components/billing/BillingCadenceToggle';
import BillingPlanCard from '../components/billing/BillingPlanCard';
import BillingFeatureMatrix from '../components/billing/BillingFeatureMatrix';
import MetaCostExplainerCard from '../components/billing/MetaCostExplainerCard';
import BillingSkeleton from '../components/billing/BillingSkeleton';
import BillingUsageStatsTab from '../components/billing/BillingUsageStatsTab';
import AiAddonGrid from '../components/billing/AiAddonGrid';
import EmptyState from '../components/ui/EmptyState';
import PageShell from '../components/ui/PageShell';
import SectionCard from '../components/ui/SectionCard';
import { analyticsApi, billingApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { AiCreditsResponse, AiTopupSkuClient, BillingInfo, BillingPlan, BillingUsage, ReportsOverviewFullData } from '../types';
import { openRazorpayCheckout, openRazorpaySubscriptionCheckout } from '../utils/razorpay';
import { toastError, toastSuccess } from '../utils/toast';

type BillingTab = 'usage' | 'plans' | 'history';
type CadenceTab = 'monthly' | 'quarterly' | 'yearly';

const tabMeta = {
  usage: { label: 'Usage & Statistics', shortLabel: 'Usage & Stats', icon: BarChart3 },
  plans: { label: 'Plans & Pricing', shortLabel: 'Plans', icon: CreditCard },
  history: { label: 'Invoices & History', shortLabel: 'History', icon: Receipt },
} as const;

export default function BillingPage() {
  const { user, refreshSession } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: BillingTab = rawTab === 'plans' || rawTab === 'history' ? rawTab : 'usage';

  const [cadence, setCadence] = useState<CadenceTab>('monthly');
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [overview, setOverview] = useState<ReportsOverviewFullData | null>(null);
  const [aiCredits, setAiCredits] = useState<AiCreditsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [overviewUnavailable, setOverviewUnavailable] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [purchasingSku, setPurchasingSku] = useState<string | null>(null);
  const [recurringSku, setRecurringSku] = useState<string | null>(null);

  const handleTabChange = useCallback(
    (newTab: BillingTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newTab === 'usage') {
            next.delete('tab');
          } else {
            next.set('tab', newTab);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const scrollToAddons = useCallback(() => {
    handleTabChange('plans');
    window.setTimeout(() => {
      document.getElementById('ai-addons')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [handleTabChange]);

  const reloadAiCredits = useCallback(() => {
    return billingApi
      .aiCredits()
      .then((res) => setAiCredits(res.data.data))
      .catch(() => setAiCredits(null));
  }, []);

  const load = useCallback(() => {
    setLoadFailed(false);
    setLoading(true);
    Promise.all([
      billingApi.get(),
      billingApi.usage(),
      billingApi.aiCredits().catch(() => null),
      analyticsApi.overview({ days: '30' }).catch(() => null),
    ])
      .then(([billingRes, usageRes, aiCreditsRes, overviewRes]) => {
        setInfo(billingRes.data.data);
        setUsage(usageRes.data.data);
        setAiCredits(aiCreditsRes?.data?.data ?? null);
        if (overviewRes?.data?.data) {
          setOverview(overviewRes.data.data);
          setOverviewUnavailable(false);
        } else {
          setOverview(null);
          setOverviewUnavailable(true);
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

  useEffect(() => {
    const cadenceFromServer = info?.cadence;
    if (
      cadenceFromServer &&
      cadenceFromServer !== 'trial' &&
      (cadenceFromServer === 'monthly' || cadenceFromServer === 'quarterly' || cadenceFromServer === 'yearly')
    ) {
      setCadence(cadenceFromServer);
    }
  }, [info?.cadence]);

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
      // If server returned alreadyActive: true, plan was restored with no additional charge!
      if (res.data?.data?.alreadyActive) {
        toastSuccess(res.data.data.message || `Switched to your active ${plan.name} plan!`);
        setUpgrading(null);
        load();
        return;
      }

      const { orderId, amount, currency, keyId } = res.data.data;
      await openRazorpayCheckout({
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
            await refreshSession();
            window.dispatchEvent(new CustomEvent('billing:updated'));
            load();
          } catch {
            toastError('Payment received but verification failed. If money was deducted, contact support with your payment ID.');
          } finally {
            setUpgrading(null);
          }
        },
        onDismiss: () => {
          setUpgrading(null);
          toastError('Payment cancelled. No charge was made.');
        },
        onFailure: () => {
          setUpgrading(null);
          toastError('Payment failed. Please try again or use a different payment method.');
        },
      });
    } catch (err: unknown) {
      setUpgrading(null);
      const apiMessage = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toastError(
        apiMessage ||
          (err instanceof Error && err.message === 'Failed to load Razorpay'
            ? 'Could not open payment checkout. Refresh the page and try again.'
            : err instanceof Error
              ? err.message
              : 'Failed to initiate upgrade')
      );
    }
  };

  const handleUpgrade = (plan: BillingPlan) => {
    if (plan.id === 'enterprise') {
      window.location.href =
        'mailto:hello@samyoj.com?subject=Samyoj%20Enterprise%20plan&body=Hi%20Samyoj%20team%2C%20we%20would%20like%20to%20discuss%20Enterprise.';
      return;
    }
    if (plan.id === info?.activePaidPlan || plan.pricePaise === 0) {
      handleFreePlan(plan);
    } else {
      handlePaidPlan(plan);
    }
  };

  const handlePurchaseAddon = async (sku: AiTopupSkuClient, quantity = 1) => {
    if (!info?.canManageBilling || !info.razorpayKeyId) {
      toastError('Only admins can purchase add-ons.');
      return;
    }
    setPurchasingSku(sku.id);
    try {
      const res = await billingApi.purchaseAiAddon(sku.id, quantity);
      const payload = res.data.data;
      await openRazorpayCheckout({
        keyId: payload.keyId,
        amount: payload.amount,
        currency: payload.currency,
        orderId: payload.orderId,
        name: 'Samyoj AI Add-on',
        description: `${payload.label} — ${sku.units * quantity} ${sku.pool === 'calling' ? 'minutes' : 'credits'}`,
        prefillEmail: user?.email,
        onSuccess: async (response) => {
          try {
            const verifyRes = await billingApi.verifyAiAddon(response);
            toastSuccess(
              verifyRes.data.data.message ||
                `Added ${verifyRes.data.data.creditsGranted?.toLocaleString() ?? ''} ${sku.pool === 'calling' ? 'minutes' : 'credits'}`
            );
            await reloadAiCredits();
          } catch {
            toastError(
              'Payment received but verification failed. Contact support with your payment ID if credits are missing.'
            );
          } finally {
            setPurchasingSku(null);
          }
        },
        onDismiss: () => {
          setPurchasingSku(null);
          toastError('Payment cancelled. No charge was made.');
        },
        onFailure: () => {
          setPurchasingSku(null);
          toastError('Payment failed. Please try again.');
        },
      });
    } catch (err: unknown) {
      setPurchasingSku(null);
      const apiMessage = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toastError(apiMessage || 'Could not start add-on checkout');
    }
  };

  const handleSubscribeRecurring = async (sku: AiTopupSkuClient) => {
    if (!info?.canManageBilling || !info.razorpayKeyId) {
      toastError('Only admins can subscribe to monthly add-ons.');
      return;
    }
    setRecurringSku(sku.id);
    try {
      const res = await billingApi.subscribeAiRecurringAddon(sku.id);
      const payload = res.data.data;
      await openRazorpaySubscriptionCheckout({
        keyId: payload.keyId,
        subscriptionId: payload.subscriptionId,
        name: 'Samyoj AI Monthly Add-on',
        description: `${payload.label} — billed monthly`,
        prefillEmail: user?.email,
        onSuccess: async (response) => {
          try {
            const verifyRes = await billingApi.verifyAiRecurringAddon(response);
            toastSuccess(verifyRes.data.data.message || 'Monthly add-on activated');
            await reloadAiCredits();
          } catch {
            toastError(
              'Payment received but verification failed. Credits will apply when the webhook confirms.'
            );
            await reloadAiCredits();
          } finally {
            setRecurringSku(null);
          }
        },
        onDismiss: () => {
          setRecurringSku(null);
          toastError('Subscription checkout cancelled.');
        },
        onFailure: () => {
          setRecurringSku(null);
          toastError('Subscription payment failed. Please try again.');
        },
      });
    } catch (err: unknown) {
      setRecurringSku(null);
      const apiMessage = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toastError(apiMessage || 'Could not start monthly add-on checkout');
    }
  };

  const handleCancelRecurring = async (skuId: string) => {
    if (!info?.canManageBilling) return;
    setRecurringSku(skuId);
    try {
      const res = await billingApi.cancelAiRecurringAddon(skuId);
      toastSuccess(res.data.data.message || 'Monthly add-on cancelled');
      await reloadAiCredits();
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toastError(apiMessage || 'Could not cancel monthly add-on');
    } finally {
      setRecurringSku(null);
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
            {/* Hero — always visible at top */}
            <BillingHero info={info} usage={usage} />

            {/* Redesigned Instant Single-Click Tab Navigation */}
            <div className="flex rounded-xl border border-theme-border bg-theme-subtle/50 p-1">
              {(['usage', 'plans', 'history'] as const).map((key) => {
                const meta = tabMeta[key];
                const Icon = meta.icon;
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTabChange(key)}
                    className={`group relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-all sm:text-[13px] ${
                      isActive
                        ? 'bg-theme-surface text-theme-fg shadow-sm ring-1 ring-theme-border'
                        : 'text-theme-muted hover:text-theme-fg hover:bg-theme-surface/40'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform ${
                        isActive ? 'text-theme-fg' : 'text-theme-muted group-hover:text-theme-fg'
                      }`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className="hidden sm:inline">{meta.label}</span>
                    <span className="sm:hidden">{meta.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Alerts */}
            {!info.canManageBilling && (
              <AppAlert variant="info">
                Only organization admins can change plans. Contact your admin to upgrade.
              </AppAlert>
            )}

            {!info.razorpayConfigured && activeTab === 'plans' && (
              <AppAlert variant="info">
                Paid checkout is unavailable — Razorpay is not configured on the server.
              </AppAlert>
            )}

            {/* Tab content with min-height stability to avoid jumping */}
            <div className="min-h-[520px] transition-opacity duration-150">
              {activeTab === 'usage' && (
                <>
                  {overviewUnavailable && (
                    <AppAlert variant="info">
                      Message delivery stats are temporarily unavailable. Plan limits and Meta usage are still shown below.
                    </AppAlert>
                  )}
                  <BillingUsageStatsTab
                    info={info}
                    usage={usage}
                    overview={overview}
                    aiCredits={aiCredits}
                    onUpgradeClick={() => handleTabChange('plans')}
                    onBuyAddons={scrollToAddons}
                    onExportCsv={handleExportCsv}
                  />
                </>
              )}

              {activeTab === 'plans' && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center gap-3">
                    <BillingCadenceToggle
                      value={cadence}
                      onChange={(v) => setCadence(v as CadenceTab)}
                      options={[
                        { value: 'monthly', label: 'Monthly' },
                        { value: 'quarterly', label: 'Quarterly', savings: '5% off' },
                        { value: 'yearly', label: 'Yearly', savings: '20% off' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {info.plans.map((plan) => (
                      <BillingPlanCard
                        key={plan.id}
                        plan={plan}
                        isCurrent={plan.id === info.plan}
                        isActivePaidSession={plan.id === info.activePaidPlan && plan.id !== info.plan}
                        canManage={info.canManageBilling}
                        razorpayConfigured={info.razorpayConfigured}
                        loading={upgrading === plan.id}
                        onSelect={() => handleUpgrade(plan)}
                        cadence={cadence}
                      />
                    ))}
                  </div>

                  <BillingFeatureMatrix currentPlan={info.planTier || info.plan} />

                  <AiAddonGrid
                    aiCredits={aiCredits}
                    canManage={info.canManageBilling}
                    razorpayConfigured={info.razorpayConfigured}
                    purchasingSku={purchasingSku}
                    recurringSku={recurringSku}
                    onPurchase={handlePurchaseAddon}
                    onSubscribeRecurring={handleSubscribeRecurring}
                    onCancelRecurring={handleCancelRecurring}
                  />

                  <MetaCostExplainerCard />
                </div>
              )}

              {activeTab === 'history' && (
                <SectionCard
                  title="Payment history"
                  subtitle="Confirmed Razorpay payments for your Samyoj software plan"
                >
                  {!info.recentPayments || info.recentPayments.length === 0 ? (
                    <EmptyState
                      icon={Receipt}
                      title="No payments yet"
                      description="Your payment history will appear here after you upgrade to a paid plan."
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
                                <p className="font-bold text-theme-fg">
                                  {planName}
                                  {payment.cadence ? ` · ${payment.cadence}` : ''}
                                </p>
                                <p className="text-[11px] text-theme-muted">
                                  Paid on {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'N/A'} · Base ₹{(payment.exclGstPaise / 100).toLocaleString('en-IN')} + GST ₹{(payment.gstAmountPaise / 100).toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black tabular-nums text-theme-fg">
                                ₹{(payment.totalAmountPaise / 100).toLocaleString('en-IN')}
                              </span>
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
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
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
