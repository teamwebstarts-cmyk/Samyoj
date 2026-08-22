import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { settingsApi } from '../../services/api';
import type { BusinessIndustryOption, OrgProfilePayload } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';

interface BusinessProfilePanelProps {
  canEdit: boolean;
  onSaved?: () => void;
}

export default function BusinessProfilePanel({ canEdit, onSaved }: BusinessProfilePanelProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [industries, setIndustries] = useState<BusinessIndustryOption[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [completeness, setCompleteness] = useState({
    requiredFilled: 0,
    requiredTotal: 4,
    percent: 0,
    isComplete: false,
  });

  const load = () => {
    setLoading(true);
    settingsApi
      .getProfile()
      .then(({ data }) => {
        const payload = data.data.profile as OrgProfilePayload;
        setIndustries((data.data.industries as BusinessIndustryOption[]) || []);
        setCompanyName(payload.companyName || '');
        setDescription(payload.profile?.description || '');
        setIndustry(payload.profile?.industry || '');
        setWebsite(payload.profile?.website || '');
        setEmail(payload.profile?.email || '');
        setAddress(payload.profile?.address || '');
        setCompleteness(payload.completeness);
      })
      .catch(() => toastError('Could not load business profile'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const missingCore = useMemo(() => {
    const missing: string[] = [];
    if (!companyName.trim()) missing.push('Business name');
    if (!industry) missing.push('Industry category');
    if (!website.trim()) missing.push('Official website');
    if (!description.trim()) missing.push('Business description');
    return missing;
  }, [companyName, industry, website, description]);

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const { data } = await settingsApi.updateProfile({
        companyName: companyName.trim(),
        description: description.trim(),
        industry,
        website: website.trim(),
        email: email.trim(),
        address: address.trim(),
      });
      const payload = data.data.profile as OrgProfilePayload;
      setCompleteness(payload.completeness);
      toastSuccess('Business profile saved successfully');
      onSaved?.();
    } catch {
      toastError('Failed to save business profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-2xl bg-theme-subtle/60" />
        <div className="h-64 animate-pulse rounded-2xl bg-theme-subtle/60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Profile completion status — compact single line */}
      {!completeness.isComplete ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-2.5 ring-1 ring-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:ring-amber-900/40">
          <AlertCircle size={15} strokeWidth={2.25} className="shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-amber-900 dark:text-amber-200">
            Missing: {missingCore.join(', ')}
          </p>
          <span className="shrink-0 rounded-md bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
            {completeness.percent}%
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-2.5 ring-1 ring-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:ring-emerald-900/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} strokeWidth={2.25} className="text-whatsapp-600 dark:text-whatsapp-400" />
            <span className="text-[12px] font-semibold text-emerald-900 dark:text-emerald-200">
              Profile complete
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            Brand active
          </span>
        </div>
      )}

      <SettingsPanel
        title="Business details"
        description="Official company information and customer support credentials."
        icon={Building2}
        accent="emerald"
        footer={
          canEdit ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-[12px] font-medium text-theme-muted">
                Changes apply across messages, templates, and team workspaces.
              </p>
              <AppButton loading={saving} onClick={handleSave}>
                Save profile
              </AppButton>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput
              id="company-name"
              label="Business / Company name"
              required
              placeholder="e.g. Samyoj Technologies Pvt Ltd"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={!canEdit}
            />

            <AppSelect
              id="business-industry"
              label="Industry category"
              required
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={!canEdit}
              options={[
                { value: '', label: 'Select your industry' },
                ...industries.map((ind) => ({ value: ind.value, label: ind.label })),
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput
              id="company-website"
              label="Official website URL"
              required
              type="url"
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              disabled={!canEdit}
            />

            <AppInput
              id="support-email"
              label="Customer support email"
              type="email"
              placeholder="support@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          <AppInput
            id="company-address"
            label="Store / Office address (optional)"
            placeholder="e.g. 102, Silicon Hub, Outer Ring Road, Bangalore - 560103"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!canEdit}
          />

          <AppTextarea
            id="business-description"
            label="Business description / About"
            required
            rows={3}
            placeholder="Briefly describe what products or services your business offers (1–2 sentences)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
          />
        </div>
      </SettingsPanel>
    </div>
  );
}
