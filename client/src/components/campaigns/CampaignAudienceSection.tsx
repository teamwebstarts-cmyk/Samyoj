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

export type AudienceType = 'MANUAL' | 'TAGS' | 'CONTACTS' | 'ALL_OPTED_IN';

const audienceTypes = [
  {
    id: 'MANUAL' as const,
    label: 'Manual list',
    description: 'Paste or import numbers',
    icon: Phone,
    accent: 'sky',
  },
  {
    id: 'TAGS' as const,
    label: 'By tags',
    description: 'Filter by contact tags',
    icon: Tag,
    accent: 'violet',
  },
  {
    id: 'CONTACTS' as const,
    label: 'Pick contacts',
    description: 'Select individuals',
    icon: UserCheck,
    accent: 'indigo',
  },
  {
    id: 'ALL_OPTED_IN' as const,
    label: 'All opted-in',
    description: 'Full subscribed list',
    icon: Users,
    accent: 'emerald',
  },
] as const;

const accentActive: Record<string, string> = {
  sky: 'border-sky-300/80 bg-sky-50/80 ring-sky-200/70 dark:border-sky-700/50 dark:bg-sky-950/30 dark:ring-sky-800/40',
  violet:
    'border-violet-300/80 bg-violet-50/80 ring-violet-200/70 dark:border-violet-700/50 dark:bg-violet-950/30 dark:ring-violet-800/40',
  indigo:
    'border-indigo-300/80 bg-indigo-50/80 ring-indigo-200/70 dark:border-indigo-700/50 dark:bg-indigo-950/30 dark:ring-indigo-800/40',
  emerald:
    'border-emerald-300/80 bg-emerald-50/80 ring-emerald-200/70 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:ring-emerald-800/40',
};

const accentIcon: Record<string, string> = {
  sky: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_12px_rgba(14,165,233,0.3)]',
  violet: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]',
  indigo: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]',
  emerald:
    'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(37,211,102,0.3)]',
};

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
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-theme-muted">
          Choose audience type
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {audienceTypes.map((type) => {
            const Icon = type.icon;
            const active = audienceType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onAudienceTypeChange(type.id)}
                className={`relative flex flex-col items-start gap-2.5 rounded-2xl border p-3.5 text-left ring-1 transition active:scale-[0.99] sm:p-4 ${
                  active
                    ? accentActive[type.accent]
                    : 'border-theme-border bg-theme-surface hover:border-theme-border-strong hover:bg-theme-subtle/50'
                }`}
              >
                {active && (
                  <span className="absolute right-2.5 top-2.5 text-sky-600 dark:text-sky-400">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                )}
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    active ? accentIcon[type.accent] : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <span>
                  <span className="block text-[13px] font-extrabold text-theme-fg">{type.label}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-theme-muted">
                    {type.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-theme-border bg-theme-subtle/30">
        <div className="border-b border-theme-border/70 bg-theme-surface/60 px-4 py-3">
          <p className="text-[12px] font-extrabold text-theme-fg">
            {audienceTypes.find((t) => t.id === audienceType)?.label} configuration
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
            Only opted-in contacts receive campaign messages
          </p>
        </div>

        <div className="space-y-4 p-4">
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
              title="Broadcast to your full opted-in list"
              description="Every contact with opt-in enabled will be included when you save this campaign. Great for announcements and updates."
              accent="emerald"
            />
          )}

          {showSavedCount && ['TAGS', 'CONTACTS', 'ALL_OPTED_IN'].includes(audienceType) && (
            <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-3.5 py-2.5 dark:border-sky-800/40 dark:bg-sky-950/25">
              <p className="text-[12px] font-medium text-sky-900 dark:text-sky-200">
                Recipients resolve from your contact list on save. Current saved count:{' '}
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
