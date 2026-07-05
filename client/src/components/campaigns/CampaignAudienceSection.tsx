import { useMemo } from 'react';
import {
  CheckCircle2,
  Hash,
  Phone,
  Sparkles,
  Tag,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import { ModalCallout } from '../ui/modalUi';
import CampaignAudiencePreview from './CampaignAudiencePreview';
import CampaignContactPicker from './CampaignContactPicker';
import CampaignPhoneCsvImport from './CampaignPhoneCsvImport';
import { PHONE_HINT, PHONE_PLACEHOLDER, validatePhoneLines } from '../../utils/phone';
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
}: CampaignAudienceSectionProps) {
  const selectedTags = useMemo(() => parseTags(audienceTags), [audienceTags]);

  const phoneStats = useMemo(() => {
    const lines = phones.split('\n').map((p) => p.trim()).filter(Boolean);
    const result = validatePhoneLines(lines);
    return {
      total: lines.length,
      valid: result.ok ? result.phones.length : 0,
      invalid: result.ok ? lines.length - result.phones.length : lines.length,
    };
  }, [phones]);

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    onAudienceTagsChange(next.join(', '));
  };

  const removeTag = (tag: string) => {
    onAudienceTagsChange(selectedTags.filter((t) => t !== tag).join(', '));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {audienceTypes.map((type) => {
          const Icon = type.icon;
          const active = audienceType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onAudienceTypeChange(type.id)}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
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
                  {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-whatsapp-600" />}
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
              <CampaignPhoneCsvImport
                onPhonesImported={(imported) => {
                  const existing = phones
                    .split('\n')
                    .map((p) => p.trim())
                    .filter(Boolean);
                  const merged = [...new Set([...existing, ...imported])];
                  onPhonesChange(merged.join('\n'));
                }}
              />

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800 ring-1 ring-sky-200/70 dark:bg-sky-950/40 dark:text-sky-300">
                  <Phone className="h-3 w-3" />
                  {phoneStats.valid} valid
                </span>
                {phoneStats.invalid > 0 && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300">
                    {phoneStats.invalid} invalid line{phoneStats.invalid === 1 ? '' : 's'}
                  </span>
                )}
                {phoneStats.total > 0 && (
                  <span className="text-[11px] font-medium text-theme-muted">
                    {phoneStats.total} line{phoneStats.total === 1 ? '' : 's'} entered
                  </span>
                )}
              </div>

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
            </>
          )}

          {audienceType === 'TAGS' && (
            <>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-violet-100 py-1 pl-2.5 pr-1.5 text-[11px] font-bold text-violet-800 ring-1 ring-violet-200/70 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50"
                    >
                      <Hash className="h-3 w-3 opacity-70" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="rounded-full p-0.5 transition hover:bg-violet-200/60 dark:hover:bg-violet-800/40"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

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
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.slice(0, 16).map((tag) => {
                      const selected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition ${
                            selected
                              ? 'bg-violet-600 text-white ring-violet-600 dark:bg-violet-500'
                              : 'bg-theme-surface text-violet-700 ring-violet-200/70 hover:bg-violet-50 dark:text-violet-300 dark:ring-violet-800/50 dark:hover:bg-violet-950/40'
                          }`}
                        >
                          {tag}
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
      />
    </div>
  );
}
