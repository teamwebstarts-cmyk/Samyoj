import { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Phone,
  Sparkles,
  Tag,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import { ModalCallout } from '../ui/modalUi';
import CampaignAudiencePreview, { type AudiencePreviewMetrics } from './CampaignAudiencePreview';
import CampaignContactPicker from './CampaignContactPicker';
import CampaignPhoneCsvImport from './CampaignPhoneCsvImport';
import { PHONE_HINT, PHONE_PLACEHOLDER, validatePhone, validatePhoneLines } from '../../utils/phone';
import { messagingConsent } from '../../utils/plainLanguage';
import type { CampaignRecipientDetail } from './wizard/campaignWizardModel';
import type { ContactImportRow } from '../../utils/contactImport';

export type AudienceType = 'MANUAL' | 'TAGS' | 'CONTACTS' | 'ALL_OPTED_IN';

const audienceTypes = [
  {
    id: 'MANUAL' as const,
    label: 'Phone numbers',
    description: 'Paste or import a list',
    wizardLabel: 'Upload list',
    wizardDescription: 'Paste or import phone numbers',
    icon: Phone,
    tone: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300',
  },
  {
    id: 'TAGS' as const,
    label: 'Contact tags',
    description: 'Choose contacts with these tags',
    wizardLabel: 'Tags',
    wizardDescription: 'Send to contacts with specific tags',
    icon: Tag,
    tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  },
  {
    id: 'CONTACTS' as const,
    label: 'Select contacts',
    description: 'Choose specific contacts',
    wizardLabel: 'Selected contacts',
    wizardDescription: 'Choose individual contacts',
    icon: UserCheck,
    tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  },
  {
    id: 'ALL_OPTED_IN' as const,
    label: messagingConsent.allAudienceLabel,
    description: messagingConsent.allAudienceDescription,
    wizardLabel: 'All contacts',
    wizardDescription: 'Send to opted-in saved contacts',
    icon: Users,
    tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
] as const;

const wizardAudienceTypes = [audienceTypes[3], audienceTypes[1], audienceTypes[2]] as const;

interface CampaignAudienceSectionProps {
  variant?: 'default' | 'wizard';
  audienceType: AudienceType;
  onAudienceTypeChange: (type: AudienceType) => void;
  selectedAudienceTypes?: AudienceType[];
  onAudienceTypesChange?: (types: AudienceType[]) => void;
  audienceOperator?: 'OR' | 'AND';
  onAudienceOperatorChange?: (operator: 'OR' | 'AND') => void;
  phones: string;
  onPhonesChange: (phones: string) => void;
  recipientDetails?: Record<string, CampaignRecipientDetail>;
  onRecipientDetailsChange?: (details: Record<string, CampaignRecipientDetail>) => void;
  audienceTags: string;
  onAudienceTagsChange: (tags: string) => void;
  selectedContactIds: string[];
  onSelectedContactIdsChange: (ids: string[]) => void;
  availableTags: string[];
  editingTotalContacts?: number;
  showSavedCount?: boolean;
  onPreviewCountChange?: (count: number | null) => void;
  onPreviewCostChange?: (cost: number | null) => void;
  onPreviewMetricsChange?: (metrics: AudiencePreviewMetrics | null) => void;
  previewMetrics?: AudiencePreviewMetrics | null;
  templateCategory?: string;
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function CampaignAudienceSection({
  variant = 'default',
  audienceType,
  onAudienceTypeChange,
  selectedAudienceTypes,
  onAudienceTypesChange,
  audienceOperator = 'OR',
  onAudienceOperatorChange,
  phones,
  onPhonesChange,
  recipientDetails,
  onRecipientDetailsChange,
  audienceTags,
  onAudienceTagsChange,
  selectedContactIds,
  onSelectedContactIdsChange,
  availableTags,
  editingTotalContacts,
  showSavedCount,
  onPreviewCountChange,
  onPreviewCostChange,
  onPreviewMetricsChange,
  previewMetrics,
  templateCategory,
}: CampaignAudienceSectionProps) {
  const [manualInputOpen, setManualInputOpen] = useState(Boolean(phones.trim()));
  const selectedTags = useMemo(() => parseTags(audienceTags), [audienceTags]);
  const activeAudienceTypes = useMemo(
    () =>
      variant === 'wizard' && selectedAudienceTypes?.length
        ? selectedAudienceTypes
        : [audienceType],
    [audienceType, selectedAudienceTypes, variant],
  );
  const isTagsSelected = activeAudienceTypes.includes('TAGS');
  const isContactsSelected = activeAudienceTypes.includes('CONTACTS');
  const isAllSelected = activeAudienceTypes.includes('ALL_OPTED_IN');

  const toggleAudienceType = (type: AudienceType) => {
    if (variant !== 'wizard' || !onAudienceTypesChange) {
      onAudienceTypeChange(type);
      return;
    }

    if (type === 'ALL_OPTED_IN') {
      onAudienceTypesChange(['ALL_OPTED_IN']);
      onAudienceTypeChange(type);
      return;
    }

    const withoutAll = activeAudienceTypes.filter((item) => item !== 'ALL_OPTED_IN');
    const next = withoutAll.includes(type)
      ? withoutAll.filter((item) => item !== type)
      : [...withoutAll, type];
    const normalized = next.length ? next : ['ALL_OPTED_IN' as const];
    onAudienceTypesChange(normalized);
    onAudienceTypeChange(normalized[0]);
  };

  const phoneStats = useMemo(() => {
    const lines = phones.split('\n').map((value, index) => ({ value: value.trim(), lineNumber: index + 1 })).filter((line) => line.value);
    const results = lines.map((line) => validatePhone(line.value));
    const validPhones = results.flatMap((result) => (result.ok ? [result.phone] : []));
    return {
      total: lines.length,
      valid: new Set(validPhones).size,
    invalid: results.filter((result) => !result.ok).length,
      duplicates: validPhones.length - new Set(validPhones).size,
      invalidLines: lines.flatMap((line, index) => {
        const result = results[index];
        return result.ok ? [] : [{ ...line, error: result.error }];
      }),
    };
  }, [phones]);

  const removeInvalidPhones = () => {
    const valid = phones
      .split('\n')
      .map((line) => validatePhoneLines([line]))
      .flatMap((result) => (result.ok ? result.phones : []));
    onPhonesChange([...new Set(valid)].join('\n'));
  };

  const deduplicatePhones = () => {
    const values = phones.split('\n').map((line) => line.trim()).filter(Boolean);
    onPhonesChange([...new Set(values)].join('\n'));
  };

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    onAudienceTagsChange(next.join(', '));
  };

  return (
    <div className={`campaign-audience-section ${variant === 'wizard' ? 'campaign-audience-section--wizard' : 'space-y-4'}`}>
      <div
        className={`campaign-audience-options grid gap-2 ${
          variant === 'wizard' ? 'grid-cols-1' : 'grid-cols-2'
        }`}
        role={variant === 'wizard' ? 'group' : 'radiogroup'}
        aria-label="Audience type"
      >
        {(variant === 'wizard' ? wizardAudienceTypes : audienceTypes).map((type) => {
          const Icon = type.icon;
          const active = activeAudienceTypes.includes(type.id);
          const multiSelectable = variant === 'wizard' && type.id !== 'ALL_OPTED_IN';
          const label = variant === 'wizard' ? type.wizardLabel : type.label;
          const description = variant === 'wizard' ? type.wizardDescription : type.description;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => toggleAudienceType(type.id)}
              role={variant === 'wizard' ? 'checkbox' : 'radio'}
              aria-checked={active}
              className={`flex min-h-[52px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-whatsapp-500/40 ${
                active
                  ? 'border-emerald-300 bg-emerald-50/55 shadow-[0_4px_14px_rgba(16,185,129,0.08)] dark:border-emerald-700 dark:bg-emerald-950/25'
                  : 'border-theme-border bg-theme-surface hover:border-theme-border-strong hover:bg-theme-subtle/40'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                  multiSelectable ? 'rounded-md' : 'rounded-full'
                } ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
                aria-hidden="true"
              >
                {active &&
                  (multiSelectable ? (
                    <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-300" strokeWidth={3} />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  ))}
              </span>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${type.tone} ${
                  active ? 'ring-1 ring-emerald-300/80 dark:ring-emerald-700/80' : ''
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="block truncate text-[11px] font-extrabold text-theme-fg">{label}</span>
                  {active && !multiSelectable && (
                    <CheckCircle2
                      className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-300"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[9px] font-medium leading-snug text-theme-muted">
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="campaign-audience-detail-column">
      <div className="campaign-audience-detail overflow-hidden rounded-xl border border-theme-border">
        <div className="flex items-center justify-between gap-3 border-b border-theme-border bg-theme-subtle/40 px-3.5 py-2.5">
          <p className="min-w-0 truncate text-[12px] font-bold text-theme-fg">
            {variant === 'wizard'
              ? activeAudienceTypes
                  .map((type) => audienceTypes.find((item) => item.id === type)?.wizardLabel)
                  .filter(Boolean)
                  .join(' + ')
              : audienceTypes.find((t) => t.id === audienceType)?.label}
          </p>
          {variant === 'wizard' && isTagsSelected && isContactsSelected && (
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="hidden text-[9px] font-semibold text-violet-700/80 sm:inline dark:text-violet-300/80">
                Match
              </span>
              <div className="flex rounded-md border border-violet-200 bg-white p-0.5 dark:border-violet-800 dark:bg-slate-950">
                {(['OR', 'AND'] as const).map((operator) => (
                  <button
                    key={operator}
                    type="button"
                    aria-label={`Match ${operator === 'OR' ? 'any' : 'all'} audience conditions`}
                    aria-pressed={audienceOperator === operator}
                    onClick={() => onAudienceOperatorChange?.(operator)}
                    className={`rounded px-2 py-1 text-[9px] font-extrabold transition ${
                      audienceOperator === operator
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/50'
                    }`}
                  >
                    {operator === 'OR' ? 'Any' : 'All'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 bg-theme-surface p-3.5">
          {audienceType === 'MANUAL' && (
            <>
              <button
                type="button"
                onClick={() => setManualInputOpen((open) => !open)}
                aria-expanded={manualInputOpen}
                className="flex w-full items-center justify-between rounded-xl border border-theme-border bg-theme-subtle/40 px-3.5 py-3 text-left transition hover:bg-theme-subtle/70 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                <span>
                  <span className="block text-[12px] font-bold text-theme-fg">Add phone numbers</span>
                  <span className="mt-0.5 block text-[11px] text-theme-muted">
                    One number per line, or import a CSV file
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 text-theme-muted transition ${manualInputOpen ? 'rotate-180' : ''}`} />
              </button>

              {manualInputOpen && (
                <div className="space-y-3">
                  <AppTextarea
                    id="campaign-phones"
                    label="Phone numbers"
                    hint={`One per line · ${PHONE_HINT}`}
                    placeholder={`${PHONE_PLACEHOLDER}\n919123456789`}
                    value={phones}
                    onChange={(e) => onPhonesChange(e.target.value)}
                    rows={6}
                    className="font-mono text-[13px]"
                    required
                  />
                  <details className="rounded-xl border border-theme-border bg-theme-subtle/30">
                    <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-bold text-theme-secondary">
                      Import a CSV or JSON file
                    </summary>
                    <div className="border-t border-theme-border p-3">
                      <CampaignPhoneCsvImport
                        onPhonesImported={(imported) => {
                          const existing = phones.split('\n').map((p) => p.trim()).filter(Boolean);
                          onPhonesChange([...new Set([...existing, ...imported])].join('\n'));
                        }}
                        onRowsImported={(rows: ContactImportRow[]) => {
                          if (!onRecipientDetailsChange) return;
                          const next = { ...(recipientDetails || {}) };
                          for (const row of rows) {
                            const body = row.extraValues || [];
                            const named = row.customAttributes && Object.keys(row.customAttributes).length
                              ? row.customAttributes
                              : undefined;
                            if (!row.name && !named && !body.some(Boolean)) continue;
                            next[row.phone] = {
                              ...(row.name ? { name: row.name } : {}),
                              variables: {
                                ...(named ? { attributes: named } : body.some(Boolean) ? { body } : {}),
                              },
                            };
                          }
                          onRecipientDetailsChange(next);
                        }}
                      />
                    </div>
                  </details>
                </div>
              )}

              {phoneStats.total > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800 ring-1 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300">
                    <Phone className="h-3 w-3" />
                    {phoneStats.valid} valid numbers
                  </span>
                  {phoneStats.invalid > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300">
                      <XCircle className="h-3 w-3" />
                      {phoneStats.invalid} invalid
                    </span>
                  )}
                  {phoneStats.duplicates > 0 && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-800 ring-1 ring-violet-200/70 dark:bg-violet-950/40 dark:text-violet-300">
                      {phoneStats.duplicates} duplicate{phoneStats.duplicates === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              )}

              {phoneStats.invalidLines.length > 0 && (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-950/25" role="alert">
                  <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                    {phoneStats.invalid} invalid line{phoneStats.invalid === 1 ? '' : 's'} must be fixed before sending
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                    {phoneStats.invalidLines.map((line) => (
                      <li key={line.lineNumber} className="font-mono">
                        Line {line.lineNumber}: {line.value} — {line.error}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={removeInvalidPhones} className="rounded-lg bg-amber-700 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40">
                      Remove invalid rows
                    </button>
                    {phoneStats.duplicates > 0 && (
                      <button type="button" onClick={deduplicatePhones} className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:border-amber-700 dark:text-amber-200">
                        Remove duplicates
                      </button>
                    )}
                  </div>
                </div>
              )}
              {phoneStats.duplicates > 0 && phoneStats.invalidLines.length === 0 && (
                <div className="flex items-center justify-between rounded-xl border border-violet-200/70 bg-violet-50/60 px-3 py-2.5 dark:border-violet-800/40 dark:bg-violet-950/20">
                  <p className="text-[11px] font-semibold text-violet-800 dark:text-violet-300">
                    Duplicate numbers will be counted once.
                  </p>
                  <button type="button" onClick={deduplicatePhones} className="rounded-lg border border-violet-300 px-2.5 py-1.5 text-[11px] font-bold text-violet-900 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40 dark:border-violet-700 dark:text-violet-200">
                    Deduplicate
                  </button>
                </div>
              )}

            </>
          )}

          {isTagsSelected && (
            <>
              <AppInput
                id="audience-tags"
                label="Contact tags"
                hint="Separate tags with commas. Contacts matching any tag are included."
                placeholder="vip, newsletter, lead"
                value={audienceTags}
                onChange={(e) => onAudienceTagsChange(e.target.value)}
                required
              />

              {availableTags.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold text-theme-muted">
                    Choose a tag
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableTags.slice(0, 16).map((tag) => {
                      const selected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          aria-pressed={selected}
                          className={`flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-left text-[11px] font-semibold transition ${
                            selected
                              ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200'
                              : 'border-theme-border bg-theme-surface text-theme-secondary hover:border-violet-200 hover:bg-violet-50/50 dark:hover:border-violet-800 dark:hover:bg-violet-950/20'
                          }`}
                        >
                          <span className="truncate">{tag}</span>
                          {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {isContactsSelected && (
            <CampaignContactPicker
              variant={variant}
              selectedIds={selectedContactIds}
              onChange={onSelectedContactIdsChange}
            />
          )}

          {isAllSelected && (
            variant === 'wizard' ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Total contacts', value: previewMetrics?.total },
                    { label: 'Opted-in', value: previewMetrics?.optedIn },
                    { label: 'Not opted-in', value: previewMetrics?.notOptedIn },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900/45"
                    >
                      <p className="text-[9px] font-semibold text-theme-muted">{item.label}</p>
                      <p className="mt-1 text-[12px] font-extrabold tabular-nums text-theme-fg">
                        {item.value == null ? '—' : item.value.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/70 px-2.5 py-2 dark:border-sky-900/40 dark:bg-sky-950/20">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
                  <p className="text-[9px] font-semibold leading-relaxed text-sky-800 dark:text-sky-200">
                    Only opted-in contacts will receive this campaign.
                  </p>
                </div>
              </div>
            ) : (
              <ModalCallout
                icon={Sparkles}
                title="Consent-based audience"
                description="Use everyone in your contact list who agreed to receive WhatsApp campaign messages."
                accent="emerald"
              />
            )
          )}

          {showSavedCount && activeAudienceTypes.some((type) => ['TAGS', 'CONTACTS', 'ALL_OPTED_IN'].includes(type)) && (
            <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-3.5 py-2.5 dark:border-sky-800/40 dark:bg-sky-950/25">
              <p className="text-[12px] font-medium text-sky-900 dark:text-sky-200">
                Contacts are checked when you save. Current count:{' '}
                <span className="font-extrabold tabular-nums">{editingTotalContacts ?? 0}</span>.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="campaign-audience-preview">
        <CampaignAudiencePreview
          variant={variant === 'wizard' ? 'wizard' : 'default'}
          showMetrics={!(variant === 'wizard' && isAllSelected)}
          audienceType={audienceType}
          audienceTypes={activeAudienceTypes}
          audienceOperator={audienceOperator}
          phones={phones}
          audienceTags={audienceTags}
          selectedContactIds={selectedContactIds}
          requestedCount={activeAudienceTypes.includes('CONTACTS') ? selectedContactIds.length : undefined}
          onCountChange={onPreviewCountChange}
          onCostChange={onPreviewCostChange}
          onMetricsChange={onPreviewMetricsChange}
          templateCategory={templateCategory}
        />
      </div>
      </div>
    </div>
  );
}
