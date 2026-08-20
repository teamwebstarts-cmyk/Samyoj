import { useEffect, useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { platformRequest } from '../api';
import { Button, PageHeader, PageLoading, SectionCard } from '../components/ui';

export function BillingConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [planTiersJson, setPlanTiersJson] = useState('');
  const [billingSkusJson, setBillingSkusJson] = useState('');
  
  const [tierError, setTierError] = useState('');
  const [skuError, setSkuError] = useState('');

  useEffect(() => {
    platformRequest<any>('/settings')
      .then((data) => {
        setPlanTiersJson(JSON.stringify(data.planTiers || {}, null, 2));
        setBillingSkusJson(JSON.stringify(data.billingSkus || [], null, 2));
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load config');
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setError('');
    setTierError('');
    setSkuError('');
    
    let planTiers;
    let billingSkus;
    
    try {
      planTiers = JSON.parse(planTiersJson);
    } catch (e) {
      setTierError('Invalid JSON format');
      return;
    }
    
    try {
      billingSkus = JSON.parse(billingSkusJson);
    } catch (e) {
      setSkuError('Invalid JSON format');
      return;
    }

    setSaving(true);
    try {
      await platformRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({ planTiers, billingSkus }),
      });
      alert('Billing configuration saved and applied globally.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoading label="Loading configuration..." />;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Billing Configuration"
        purpose="Configure plan tiers, features, and pricing SKUs. Changes take effect immediately."
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <SectionCard title="Plan Tiers" purpose="Define the base tiers (launch, starter, growth, pro, enterprise) and their features." padded>
        <div className="space-y-4">
          <textarea
            className="w-full h-[400px] font-mono text-sm bg-[var(--surface)] border border-[var(--border)] rounded p-4 focus:ring-1 focus:ring-[var(--accent)] outline-none"
            value={planTiersJson}
            onChange={(e) => setPlanTiersJson(e.target.value)}
          />
          {tierError && <p className="text-red-500 text-sm">{tierError}</p>}
        </div>
      </SectionCard>

      <SectionCard title="Billing SKUs" purpose="Define the pricing and cadences for each plan tier." padded>
        <div className="space-y-4">
          <textarea
            className="w-full h-[400px] font-mono text-sm bg-[var(--surface)] border border-[var(--border)] rounded p-4 focus:ring-1 focus:ring-[var(--accent)] outline-none"
            value={billingSkusJson}
            onChange={(e) => setBillingSkusJson(e.target.value)}
          />
          {skuError && <p className="text-red-500 text-sm">{skuError}</p>}
        </div>
      </SectionCard>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
