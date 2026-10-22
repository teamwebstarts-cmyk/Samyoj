import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coins,
  Eye,
  Layers,
  Plus,
  Save,
  ShieldCheck,
  Tag,
  Trash2,
} from 'lucide-react';
import { platformRequest } from '../api';
import { Button, Input, PageHeader, PageLoading, SectionCard, Select, StatusBadge } from '../components/ui';

type PlanTier = 'launch' | 'starter' | 'growth' | 'pro' | 'enterprise';
type Cadence = 'trial' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

interface PlanTierDef {
  tier: PlanTier;
  name: string;
  waNumbers: number | 'unlimited';
  seats: number | 'custom';
  contacts: number | 'unlimited';
  publishedWorkflows: number | 'unlimited';
  aiIncluded: 'off' | 'included' | 'advanced' | 'dedicated';
  callingIncluded: boolean;
  analyticsAdvanced: boolean;
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
  features: string[];
}

interface BillingSkuDef {
  id: string;
  planTier: PlanTier;
  cadence: Cadence;
  name: string;
  cadenceLabel: string;
  pricePaise: number;
  inclGstPaise: number;
  periodDays: number;
  effectiveMonthlyLabel: string;
  invoiceLabel: string;
  upiAutopayAllowed: boolean;
  isMostPopular?: boolean;
}

const TIER_THEMES: Record<PlanTier, { bg: string; border: string; badge: string; accent: string }> = {
  launch: { bg: 'from-slate-50 to-slate-100', border: 'border-slate-300', badge: 'bg-slate-200 text-slate-800', accent: 'text-slate-700' },
  starter: { bg: 'from-emerald-50/50 to-purple-50/30', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', accent: 'text-emerald-700' },
  growth: { bg: 'from-purple-50/50 to-indigo-50/30', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800', accent: 'text-purple-700' },
  pro: { bg: 'from-sky-50/50 to-blue-50/30', border: 'border-sky-200', badge: 'bg-sky-100 text-sky-800', accent: 'text-sky-700' },
  enterprise: { bg: 'from-amber-50/50 to-orange-50/30', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800', accent: 'text-amber-800' },
};

export function BillingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [enforcement, setEnforcement] = useState(false);
  const [enforcementSaving, setEnforcementSaving] = useState(false);

  const [planTiers, setPlanTiers] = useState<Record<string, PlanTierDef>>({});
  const [billingSkus, setBillingSkus] = useState<BillingSkuDef[]>([]);

  const [activeTab, setActiveTab] = useState<'tiers' | 'skus'>('tiers');
  const [selectedTier, setSelectedTier] = useState<PlanTier>('growth');

  useEffect(() => {
    Promise.all([
      platformRequest<any>('/settings'),
      platformRequest<{ enabled: boolean }>('/settings/subscription-enforcement'),
    ])
      .then(([data, enforcementState]) => {
        setPlanTiers(data.planTiers || {});
        setBillingSkus(data.billingSkus || []);
        setEnforcement(enforcementState.enabled === true);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load billing configuration');
        setLoading(false);
      });
  }, []);

  const toggleEnforcement = async () => {
    const next = !enforcement;
    setError('');
    setEnforcementSaving(true);
    try {
      const data = await platformRequest<{ enabled: boolean }>('/settings/subscription-enforcement', {
        method: 'PUT',
        body: JSON.stringify({ enabled: next }),
      });
      setEnforcement(data.enabled === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription enforcement');
    } finally {
      setEnforcementSaving(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSavedSuccess(false);
    setSaving(true);
    try {
      await platformRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({ planTiers, billingSkus }),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateTier = (tier: string, field: keyof PlanTierDef, value: any) => {
    setPlanTiers((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], [field]: value },
    }));
  };

  const updateFeature = (tier: string, index: number, value: string) => {
    setPlanTiers((prev) => {
      const features = [...prev[tier].features];
      features[index] = value;
      return { ...prev, [tier]: { ...prev[tier], features } };
    });
  };

  const addFeature = (tier: string) => {
    setPlanTiers((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], features: [...prev[tier].features, 'New feature capability'] },
    }));
  };

  const removeFeature = (tier: string, index: number) => {
    setPlanTiers((prev) => {
      const features = prev[tier].features.filter((_, i) => i !== index);
      return { ...prev, [tier]: { ...prev[tier], features } };
    });
  };

  const updateSku = (index: number, field: keyof BillingSkuDef, value: any) => {
    setBillingSkus((prev) => {
      const skus = [...prev];
      const updated = { ...skus[index], [field]: value };
      // Auto-compute GST if pricePaise changed
      if (field === 'pricePaise') {
        const paise = Number(value) || 0;
        updated.inclGstPaise = Math.round(paise * 1.18);
        const monthlyRs = Math.round(paise / 100 / (updated.periodDays > 30 ? updated.periodDays / 30 : 1));
        updated.effectiveMonthlyLabel = `₹${monthlyRs.toLocaleString('en-IN')}/mo`;
      }
      skus[index] = updated;
      return skus;
    });
  };

  const addSku = () => {
    setBillingSkus((prev) => [
      ...prev,
      {
        id: `sku_${Date.now().toString().slice(-4)}`,
        planTier: selectedTier,
        cadence: 'monthly',
        name: planTiers[selectedTier]?.name || 'Plan',
        cadenceLabel: 'monthly',
        pricePaise: 299900,
        inclGstPaise: Math.round(299900 * 1.18),
        periodDays: 30,
        effectiveMonthlyLabel: '₹2,999/mo',
        invoiceLabel: 'Subscription plan',
        upiAutopayAllowed: true,
      },
    ]);
  };

  const removeSku = (index: number) => {
    setBillingSkus((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) return <PageLoading label="Loading billing & SKU matrix…" />;

  const currentTier = planTiers[selectedTier];
  const theme = TIER_THEMES[selectedTier] || TIER_THEMES.growth;

  return (
    <div className="space-y-6 max-w-7xl pb-24">
      <PageHeader
        title="Billing & Subscription Studio"
        purpose="Live configuration of subscription tiers, quotas, WhatsApp slot limits, AI permissions, and commercial pricing SKUs."
        eyebrow={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-800">
            <Coins className="h-3 w-3 text-purple-600" />
            Dynamic Catalog Engine
          </span>
        }
      />

      <SectionCard
        title="Subscription enforcement"
        purpose="Off: every workspace can use the full product without buying a plan, including AI credits. On: expired plans and credit limits apply, and customers must purchase."
        padded
        action={
          <Button
            type="button"
            variant={enforcement ? 'danger' : 'secondary'}
            loading={enforcementSaving}
            aria-pressed={enforcement}
            onClick={toggleEnforcement}
          >
            {enforcement ? 'On — purchase required' : 'Off — full access'}
          </Button>
        }
      >
        <p className="text-xs leading-relaxed text-slate-600">
          {enforcement
            ? 'Subscriptions are on. Expired workspaces stay read-only until they buy a plan, and AI credit limits block chat and calling.'
            : 'Subscriptions are off. This is the testing default: plan expiry and AI credit limits do not block anyone. Turn this on before production billing.'}
        </p>
      </SectionCard>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Configuration saved and hot-reloaded across the live backend instances!</span>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200/80 gap-4">
        <button
          className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'tiers'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('tiers')}
        >
          <Layers className="h-4 w-4" />
          Plan Tiers & Entitlements
        </button>
        <button
          className={`flex items-center gap-2 pb-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'skus'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
          onClick={() => setActiveTab('skus')}
        >
          <Tag className="h-4 w-4" />
          Pricing SKUs & Cadences ({billingSkus.length})
        </button>
      </div>

      {/* TAB 1: PLAN TIERS & ENTITLEMENTS */}
      {activeTab === 'tiers' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr_320px]">
          {/* Tier Selector Sidebar */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">Available Tiers</p>
            {Object.keys(planTiers).map((tierKey) => {
              const t = planTiers[tierKey];
              const isSelected = selectedTier === tierKey;
              return (
                <button
                  key={tierKey}
                  type="button"
                  onClick={() => setSelectedTier(tierKey as PlanTier)}
                  className={`flex w-full items-center justify-between rounded-xl p-3 text-left transition-all ${
                    isSelected
                      ? 'bg-white shadow-md ring-2 ring-emerald-600/80 font-bold text-slate-900'
                      : 'hover:bg-slate-100/70 text-slate-600'
                  }`}
                >
                  <div>
                    <p className="text-sm">{t.name || tierKey}</p>
                    <p className="text-[11px] font-mono text-slate-400 capitalize">{tierKey}</p>
                  </div>
                  {isSelected && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
                </button>
              );
            })}
          </div>

          {/* Tier Editor Form */}
          {currentTier ? (
            <SectionCard title={`Configure: ${currentTier.name} Tier`} purpose="Adjust resource limits and feature bundle definitions." padded>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Display Plan Name"
                    value={currentTier.name}
                    onChange={(e) => updateTier(selectedTier, 'name', e.target.value)}
                  />
                  <Input
                    label="WhatsApp Phone Slots (Number or 'unlimited')"
                    value={String(currentTier.waNumbers)}
                    onChange={(e) => updateTier(selectedTier, 'waNumbers', e.target.value === 'unlimited' ? 'unlimited' : Number(e.target.value))}
                  />
                  <Input
                    label="Team Seats (Number or 'custom')"
                    value={String(currentTier.seats)}
                    onChange={(e) => updateTier(selectedTier, 'seats', e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
                  />
                  <Input
                    label="Contact Limit (Number or 'unlimited')"
                    value={String(currentTier.contacts)}
                    onChange={(e) => updateTier(selectedTier, 'contacts', e.target.value === 'unlimited' ? 'unlimited' : Number(e.target.value))}
                  />
                  <Input
                    label="Workflows Limit (Number or 'unlimited')"
                    value={String(currentTier.publishedWorkflows)}
                    onChange={(e) => updateTier(selectedTier, 'publishedWorkflows', e.target.value === 'unlimited' ? 'unlimited' : Number(e.target.value))}
                  />

                  <Select
                    label="AI Assistant Level"
                    value={currentTier.aiIncluded}
                    onChange={(e) => updateTier(selectedTier, 'aiIncluded', e.target.value)}
                  >
                    <option value="off">Off (No AI Assistant)</option>
                    <option value="included">Included (Standard RAG Assistant)</option>
                    <option value="advanced">Advanced (Multi-channel bots)</option>
                    <option value="dedicated">Dedicated (Custom LLM Finetune)</option>
                  </Select>

                  <Select
                    label="Support SLA Level"
                    value={currentTier.supportLevel}
                    onChange={(e) => updateTier(selectedTier, 'supportLevel', e.target.value)}
                  >
                    <option value="community">Community Support</option>
                    <option value="email">Standard Email Support</option>
                    <option value="priority">Priority 24/7 SLA</option>
                    <option value="dedicated">Dedicated Account Manager</option>
                  </Select>

                  <div className="flex flex-col justify-center gap-2 pt-2">
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentTier.callingIncluded}
                        onChange={(e) => updateTier(selectedTier, 'callingIncluded', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Voice Calling Module Included
                    </label>
                    <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentTier.analyticsAdvanced}
                        onChange={(e) => updateTier(selectedTier, 'analyticsAdvanced', e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Advanced Analytics & Attribution
                    </label>
                  </div>
                </div>

                {/* Feature Checklist */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Feature Bullet Points</p>
                    <Button variant="secondary" size="sm" onClick={() => addFeature(selectedTier)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Bullet
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {currentTier.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          value={feat}
                          onChange={(e) => updateFeature(selectedTier, idx, e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeFeature(selectedTier, idx)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {/* Live Preview Card */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Eye className="h-3.5 w-3.5" /> Customer App Live Preview
            </div>
            {currentTier && (
              <div className={`rounded-2xl border ${theme.border} bg-gradient-to-b ${theme.bg} p-5 shadow-lg relative overflow-hidden`}>
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}>
                    {currentTier.name}
                  </span>
                  {selectedTier === 'growth' && (
                    <span className="rounded-full bg-purple-600 text-white px-2 py-0.5 text-[9px] font-bold uppercase">
                      Popular
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-2xl font-bold tracking-tight text-slate-900">
                    {selectedTier === 'launch' ? '₹0' : selectedTier === 'enterprise' ? 'Custom' : '₹2,499'}
                    <span className="text-xs font-normal text-slate-500"> / month</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Billed monthly or annually</p>
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-600 border-t border-slate-200/60 pt-4">
                  <p className="font-semibold text-slate-900">Includes:</p>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{currentTier.waNumbers} WhatsApp numbers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{currentTier.seats} team seats</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>{currentTier.contacts === 'unlimited' ? 'Unlimited' : Number(currentTier.contacts).toLocaleString()} contacts</span>
                    </li>
                    {currentTier.features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PRICING SKUS */}
      {activeTab === 'skus' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Catalog SKU prices and GST display components. Recurring Razorpay checkout is not live.
            </p>
            <Button size="sm" onClick={addSku}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add New SKU
            </Button>
          </div>

          <div className="grid gap-4">
            {billingSkus.map((sku, index) => (
              <div key={sku.id || index} className="dashboard-card p-5 bg-white space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md">
                      {sku.id}
                    </span>
                    <StatusBadge status={sku.planTier} />
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      {sku.cadence}
                    </span>
                    {sku.isMostPopular && (
                      <span className="rounded-full bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 text-[10px] font-bold">
                        Most Popular
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      ₹{(sku.pricePaise / 100).toLocaleString('en-IN')}
                      <span className="text-xs font-normal text-slate-500"> (₹{(sku.inclGstPaise / 100).toLocaleString('en-IN')} incl. GST)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSku(index)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Delete SKU"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <Input
                    label="SKU ID"
                    value={sku.id}
                    onChange={(e) => updateSku(index, 'id', e.target.value)}
                  />
                  <Select
                    label="Associated Tier"
                    value={sku.planTier}
                    onChange={(e) => updateSku(index, 'planTier', e.target.value)}
                  >
                    {Object.keys(planTiers).map((t) => (
                      <option key={t} value={t}>{planTiers[t]?.name || t}</option>
                    ))}
                  </Select>
                  <Select
                    label="Cadence"
                    value={sku.cadence}
                    onChange={(e) => updateSku(index, 'cadence', e.target.value)}
                  >
                    <option value="trial">Trial</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom</option>
                  </Select>
                  <Input
                    label="Period Days"
                    type="number"
                    value={sku.periodDays}
                    onChange={(e) => updateSku(index, 'periodDays', Number(e.target.value))}
                  />

                  <Input
                    label="Price in Paise (Excl. GST)"
                    type="number"
                    value={sku.pricePaise}
                    onChange={(e) => updateSku(index, 'pricePaise', Number(e.target.value))}
                  />
                  <Input
                    label="Price in Paise (Incl. 18% GST)"
                    type="number"
                    value={sku.inclGstPaise}
                    onChange={(e) => updateSku(index, 'inclGstPaise', Number(e.target.value))}
                  />
                  <Input
                    label="Monthly Display Label"
                    value={sku.effectiveMonthlyLabel}
                    onChange={(e) => updateSku(index, 'effectiveMonthlyLabel', e.target.value)}
                  />
                  <Input
                    label="Invoice Description"
                    value={sku.invoiceLabel}
                    onChange={(e) => updateSku(index, 'invoiceLabel', e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2 text-xs border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={sku.upiAutopayAllowed}
                      onChange={(e) => updateSku(index, 'upiAutopayAllowed', e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    UPI Autopay eligible in catalog (not wired to checkout)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={sku.isMostPopular || false}
                      onChange={(e) => updateSku(index, 'isMostPopular', e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Mark as "Most Popular" Plan
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Bottom Publish Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 p-4 shadow-xl md:pl-[15.5rem]">
        <div className="content-shell flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Updates deploy globally in real-time to all connected customer workspaces.</span>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} loading={saving}>
              <Save className="h-4 w-4 mr-1.5" />
              {saving ? 'Publishing Changes…' : 'Publish & Sync Live'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
