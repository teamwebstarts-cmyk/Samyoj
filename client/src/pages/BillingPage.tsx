import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CreditCard,
  IndianRupee,
  Lock,
  Receipt,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import PageHero from '../components/ui/PageHero';
import EmptyState from '../components/ui/EmptyState';
import BillingCurrentPlanHero from '../components/billing/BillingCurrentPlanHero';
import BillingPlanCard from '../components/billing/BillingPlanCard';
import BillingSkeleton from '../components/billing/BillingSkeleton';
import BillingUsageWidget from '../components/billing/BillingUsageWidget';
import { billingApi, settingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { BillingInfo, BillingPlan, BillingUsage } from '../types';
import { openRazorpayCheckout } from '../utils/razorpay';
import { toastError, toastSuccess } from '../utils/toast';

const paymentMethods = [
  { label: 'UPI', icon: Smartphone },
  { label: 'Cards', icon: CreditCard },
  { label: 'Netbanking', icon: IndianRupee },
  { label: 'Secure checkout', icon: Lock },
];

function formatAmount(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function BillingPage() {
  const { user } = useAuth();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [dailyBudgetInr, setDailyBudgetInr] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const load = () => {
    setLoadFailed(false);
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
  };

  useEffect(load, []);

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

  return (
    <PageShell>
      <PageHero
        badge="Account"
        badgeIcon={CreditCard}
        title="Billing & Plans"
        description="Manage your subscription, team seats, and upgrades. Pay securely with Razorpay — UPI, cards, and netbanking supported."
        accent="emerald"
      />

      {loading ? (
        <BillingSkeleton />
      ) : loadFailed ? (
        <EmptyState
          icon={ShieldAlert}
          title="Could not load billing"
          description="Please refresh the page or try again in a moment."
        />
      ) : info ? (
        <div className="space-y-6 pb-8">
          <BillingCurrentPlanHero info={info} />

          {usage && <BillingUsageWidget usage={usage} dailyBudgetInr={dailyBudgetInr} />}

          {/* Payment trust strip */}
          <div className="dashboard-card flex flex-wrap items-center justify-between gap-4 px-5 py-4 animate-fade-up-delay">
            <div>
              <p className="text-[12px] font-extrabold text-theme-fg">Secure payments via Razorpay</p>
              <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
                PCI-compliant checkout · instant plan activation
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-theme-border bg-theme-subtle/50 px-3 py-1.5 text-[11px] font-semibold text-theme-secondary"
                >
                  <Icon className="h-3.5 w-3.5 text-whatsapp-600" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {!info.canManageBilling && (
            <div className="flex items-start gap-3 rounded-2xl border border-sky-200/80 bg-sky-50/90 px-4 py-3.5 dark:border-sky-800/40 dark:bg-sky-900/20">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-400" />
              <div>
                <p className="text-[13px] font-bold text-sky-900 dark:text-sky-200">
                  View-only access
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-sky-800/90 dark:text-sky-300/90">
                  Only organization admins can change plans. Contact your admin to upgrade.
                </p>
              </div>
            </div>
          )}

          {!info.razorpayConfigured && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3.5 dark:border-amber-800/40 dark:bg-amber-900/20">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <div>
                <p className="text-[13px] font-bold text-amber-900 dark:text-amber-200">
                  Paid plans unavailable
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-amber-800/90 dark:text-amber-300/90">
                  Razorpay is not configured on the server. Set RAZORPAY_KEY_ID and
                  RAZORPAY_KEY_SECRET to enable checkout.
                </p>
              </div>
            </div>
          )}

          {/* Plans */}
          <div>
            <div className="mb-4 flex items-end justify-between gap-3 px-0.5">
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-theme-fg">
                  Choose your plan
                </h2>
                <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
                  Scale as your team and customer base grows
                </p>
              </div>
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
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Recent payments */}
          {info.recentPayments && info.recentPayments.length > 0 && (
            <div className="dashboard-card overflow-hidden animate-fade-up-delay-2">
              <div className="flex items-center gap-2 border-b border-theme-border bg-theme-subtle/50 px-5 py-4">
                <Receipt className="h-4 w-4 text-theme-muted" />
                <div>
                  <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
                    Payment history
                  </h3>
                  <p className="text-[12px] font-medium text-theme-secondary">
                    Recent successful transactions
                  </p>
                </div>
              </div>
              <div className="divide-y divide-theme-border">
                {info.recentPayments.map((payment, i) => {
                  const planName =
                    info.plans.find((p) => p.id === payment.planId)?.name ?? payment.planId;
                  return (
                    <div
                      key={`${payment.planId}-${payment.paidAt ?? i}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-[13px]"
                    >
                      <div>
                        <p className="font-semibold text-theme-fg">{planName} plan</p>
                        <p className="text-[11px] text-theme-muted">
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : 'Pending confirmation'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {formatAmount(payment.amountPaise)}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Paid
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </PageShell>
  );
}
