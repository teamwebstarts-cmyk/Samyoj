import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
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
import CampaignAudiencePreview from './CampaignAudiencePreview';
import CampaignContactPicker from './CampaignContactPicker';
import CampaignPhoneCsvImport from './CampaignPhoneCsvImport';
import { PHONE_HINT, PHONE_PLACEHOLDER, validatePhone, validatePhoneLines } from '../../utils/phone';
import { messagingConsent } from '../../utils/plainLanguage';

export type AudienceType = 'MANUAL' | 'TAGS' | 'CONTACTS' | 'ALL_OPTED_IN';

const audienceTypes = [
  {
    id: 'MANUAL' as const,
    label: 'Manual list',
    description: 'Paste or import numbers',
    icon: Phone,
  },
  {
    id: 'TAGS' as const,
    label: 'By tags',
    description: 'Filter by contact tags',
    icon: Tag,
  },
  {
    id: 'CONTACTS' as const,
    label: 'Pick contacts',
    description: 'Select individuals',
    icon: UserCheck,
  },
  {
    id: 'ALL_OPTED_IN' as const,
    label: messagingConsent.allAudienceLabel,
    description: messagingConsent.allAudienceDescription,
    icon: Users,
  },
] as const;

interface CampaignAudienceSectionProps {
  audienceType: AudienceType;
  onAudienceTypeChange: (type: AudienceType) => void;
  phones: string;
  onPhonesChange: (phones: string) => void;
  audienceTags: string;
  onAudienceTagsChange: (tags: string) => void;
  selectedContactIds: string[];
  onSelectedContactIdsChange: (ids: string[]) => void;
  availableTags: string[];
  editingTotalContacts?: number;
  showSavedCount?: boolean;
  onPreviewCountChange?: (count: number | null) => void;
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function CampaignAudienceSection({
  audienceType,
  onAudienceTypeChange,
  phones,
  onPhonesChange,
  audienceTags,
  onAudienceTagsChange,
  selectedContactIds,
  onSelectedContactIdsChange,
  availableTags,
  editingTotalContacts,
  showSavedCount,
  onPreviewCountChange,
}: CampaignAudienceSectionProps) {
  const [manualInputOpen, setManualInputOpen] = useState(Boolean(phones.trim()));
  const selectedTags = useMemo(() => parseTags(audienceTags), [audienceTags]);

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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Audience type">
        {audienceTypes.map((type) => {
          const Icon = type.icon;
          const active = audienceType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onAudienceTypeChange(type.id)}
              role="radio"
              aria-checked={active}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-whatsapp-500/40 ${
                active
                  ? 'border-whatsapp-500/30 bg-whatsapp-500/[0.04]'
                  : 'border-theme-border bg-theme-surface hover:border-theme-border-strong hover:bg-theme-subtle/40'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  active ? 'bg-whatsapp-500/10 text-whatsapp-600' : 'bg-theme-subtle text-theme-muted'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="block text-[12px] font-bold text-theme-fg">{type.label}</span>
                  <CheckCircle2
                    className={`h-3.5 w-3.5 shrink-0 text-whatsapp-600 ${active ? 'opacity-100' : 'opacity-0'}`}
                    aria-hidden={!active}
                  />
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-theme-muted">
                  {type.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-theme-border">
        <div className="border-b border-theme-border bg-theme-subtle/40 px-3.5 py-2.5">
          <p className="text-[12px] font-bold text-theme-fg">
            {audienceTypes.find((t) => t.id === audienceType)?.label}
          </p>
          <p className="mt-0.5 text-[11px] text-theme-muted">{messagingConsent.campaignNotice}</p>
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
                    Paste a list or import a CSV when you need it
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
                      Import CSV or JSON instead
                    </summary>
                    <div className="border-t border-theme-border p-3">
                      <CampaignPhoneCsvImport
                        onPhonesImported={(imported) => {
                          const existing = phones.split('\n').map((p) => p.trim()).filter(Boolean);
                          onPhonesChange([...new Set([...existing, ...imported])].join('\n'));
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
                    {phoneStats.valid} eligible format
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

          {audienceType === 'TAGS' && (
            <>
              <AppInput
                id="audience-tags"
                label="Contact tags"
                hint="Comma-separated · matches any tag"
                placeholder="vip, newsletter, lead"
                value={audienceTags}
                onChange={(e) => onAudienceTagsChange(e.target.value)}
                required
              />

              {availableTags.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                    Quick add
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

          {audienceType === 'CONTACTS' && (
            <CampaignContactPicker
              selectedIds={selectedContactIds}
              onChange={onSelectedContactIdsChange}
            />
          )}

          {audienceType === 'ALL_OPTED_IN' && (
            <ModalCallout
              icon={Sparkles}
              title={messagingConsent.allAudienceTitle}
              description={messagingConsent.allAudienceDetail}
              accent="emerald"
            />
          )}

          {showSavedCount && ['TAGS', 'CONTACTS', 'ALL_OPTED_IN'].includes(audienceType) && (
            <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-3.5 py-2.5 dark:border-sky-800/40 dark:bg-sky-950/25">
              <p className="text-[12px] font-medium text-sky-900 dark:text-sky-200">
                People are picked from your contact list when you save. Current count:{' '}
                <span className="font-extrabold tabular-nums">{editingTotalContacts ?? 0}</span>.
              </p>
            </div>
          )}
        </div>
      </div>

      <CampaignAudiencePreview
        audienceType={audienceType}
        phones={phones}
        audienceTags={audienceTags}
        selectedContactIds={selectedContactIds}
        requestedCount={audienceType === 'CONTACTS' ? selectedContactIds.length : undefined}
        onCountChange={onPreviewCountChange}
      />
    </div>
  );
}
