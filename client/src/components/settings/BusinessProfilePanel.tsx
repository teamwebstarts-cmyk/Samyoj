import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Bot, Clock, ExternalLink, Sparkles } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppAlert from '../ui/AppAlert';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import AppTextarea from '../ui/AppTextarea';
import { SARVAM_LANGUAGES } from '../calls/CallingSettingsForm';
import { settingsApi } from '../../services/api';
import type { BusinessIndustryOption, OrgProfilePayload } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';

const TIMEZONE_SUGGESTIONS = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'UTC',
];

interface BusinessProfilePanelProps {
  canEdit: boolean;
  onSaved?: () => void;
}

function valuePropsToText(items: string[]): string {
  return items.filter((line) => line.trim()).join('\n');
}

function textToValueProps(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
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
  const [aiNotes, setAiNotes] = useState('');
  const [audience, setAudience] = useState('');
  const [valuePropsText, setValuePropsText] = useState('');
  const [defaultLocale, setDefaultLocale] = useState('en-IN');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  );
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
        setAiNotes(payload.profile?.aiNotes || '');
        setAudience(payload.audience || '');
        setValuePropsText(valuePropsToText(payload.valueProps || []));
        setDefaultLocale(payload.defaultLocale || 'en-IN');
        setTimezone(payload.timezone || 'Asia/Kolkata');
        setCompleteness(payload.completeness);
      })
      .catch(() => toastError('Could not load business profile'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const missingCore = useMemo(() => {
    const missing: string[] = [];
    if (!companyName.trim()) missing.push('Business name');
    if (!description.trim()) missing.push('What you do');
    if (!industry) missing.push('Industry');
    if (!website.trim()) missing.push('Website');
    return missing;
  }, [companyName, description, industry, website]);

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
        aiNotes: aiNotes.trim(),
        audience: audience.trim() || null,
        valueProps: textToValueProps(valuePropsText),
        defaultLocale,
        timezone,
      });
      const payload = data.data.profile as OrgProfilePayload;
      setCompleteness(payload.completeness);
      toastSuccess('Business profile saved');
      onSaved?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not save profile';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SettingsPanel title="Business profile" description="Loading…" icon={Building2} accent="emerald">
        <p className="text-[13px] text-theme-muted">Loading your workspace profile…</p>
      </SettingsPanel>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsPanel
        title="Business profile"
        description="One place for your business details. AI bots, replies, and campaigns use this automatically."
        icon={Building2}
        accent="emerald"
        footer={
          canEdit ? (
            <AppButton loading={saving} onClick={() => void handleSave()}>
              Save profile
            </AppButton>
          ) : (
            <p className="text-[12px] text-theme-muted">Only owners and admins can edit this profile.</p>
          )
        }
      >
        <div className="mb-5 overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/40 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-theme-surface dark:to-teal-950/10">
          <div className="h-0.5 bg-gradient-to-r from-whatsapp-500 to-emerald-500" />
          <div className="px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-extrabold text-emerald-900 dark:text-emerald-200">
                  {completeness.isComplete ? 'Profile complete' : `${completeness.percent}% complete`}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-emerald-800/80 dark:text-emerald-300/80">
                  {completeness.requiredFilled} of {completeness.requiredTotal} essentials filled
                </p>
              </div>
              {!completeness.isComplete && missingCore.length > 0 && (
                <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                  Still needed: {missingCore.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <AppInput
            label="Business name"
            hint="Shown to customers and used in AI replies"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={!canEdit}
            required
          />
          <AppTextarea
            label="What does your business do?"
            hint="1–2 sentences. Used in AI answers and WhatsApp profile later."
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canEdit}
            placeholder="We run a dental clinic in Pune. We book appointments and answer treatment questions."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AppSelect
              label="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={!canEdit}
              options={[
                { value: '', label: 'Select industry' },
                ...industries.map((row) => ({ value: row.value, label: row.label })),
              ]}
            />
            <AppInput
              label="Website"
              placeholder="yourshop.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <AppSelect
              label="Primary language"
              value={defaultLocale}
              onChange={(e) => setDefaultLocale(e.target.value)}
              disabled={!canEdit}
              options={SARVAM_LANGUAGES}
            />
            <AppSelect
              label="Timezone"
              hint="Used for business hours and quiet times"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={!canEdit}
              options={TIMEZONE_SUGGESTIONS.map((tz) => ({ value: tz, label: tz }))}
            />
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Contact on WhatsApp"
        description="Optional — helps customers trust your number."
        icon={ExternalLink}
        accent="sky"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AppInput
            label="Contact email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canEdit}
            placeholder="hello@yourbusiness.com"
          />
          <AppInput
            label="City or address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!canEdit}
            placeholder="Indiranagar, Bengaluru"
          />
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="AI context"
        description="Feeds your chat and calling bots automatically. Override per bot only if needed."
        icon={Sparkles}
        accent="violet"
      >
        <div className="space-y-4">
          <AppInput
            label="Who you serve"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            disabled={!canEdit}
            placeholder="e.g. Families in Mumbai, SMB retailers"
          />
          <AppTextarea
            label="Main products or services"
            hint="One per line — up to 8"
            rows={4}
            value={valuePropsText}
            onChange={(e) => setValuePropsText(e.target.value)}
            disabled={!canEdit}
            placeholder="Teeth cleaning and whitening\nRoot canal treatment\nEmergency dental care"
          />
          <AppTextarea
            label="Policies & boundaries"
            hint="What the AI must never promise"
            rows={3}
            value={aiNotes}
            onChange={(e) => setAiNotes(e.target.value)}
            disabled={!canEdit}
            placeholder="Never quote exact prices. Always ask them to visit for a consultation."
          />
        </div>
        <AppAlert variant="info" className="mt-4">
          <span className="flex items-start gap-2">
            <Bot className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              New bots pre-fill from this profile. For brand colors and marketing tone, use{' '}
              <Link to="/content-studio" className="font-bold text-sky-700 underline-offset-2 hover:underline">
                Content Studio
              </Link>
              .
            </span>
          </span>
        </AppAlert>
      </SettingsPanel>

      <SettingsPanel
        title="Business hours"
        description="Set open days and times in the Business hours tab."
        icon={Clock}
        accent="amber"
      >
        <p className="text-[13px] text-theme-secondary">
          Timezone above applies to your hours. Edit start/end times and working days in{' '}
          <Link
            to="/settings?tab=automation"
            className="font-bold text-amber-800 underline-offset-2 hover:underline dark:text-amber-300"
          >
            Business hours
          </Link>
          .
        </p>
      </SettingsPanel>
    </div>
  );
}
