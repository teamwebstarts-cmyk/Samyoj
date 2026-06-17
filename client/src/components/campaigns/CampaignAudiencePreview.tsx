import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Users } from 'lucide-react';
import { campaignApi } from '../../services/api';
import { validatePhoneLines } from '../../utils/phone';

type AudienceType = 'MANUAL' | 'TAGS' | 'CONTACTS' | 'ALL_OPTED_IN';

interface CampaignAudiencePreviewProps {
  audienceType: AudienceType;
  phones: string;
  audienceTags: string;
  selectedContactIds: string[];
}

export default function CampaignAudiencePreview({
  audienceType,
  phones,
  audienceTags,
  selectedContactIds,
}: CampaignAudiencePreviewProps) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        let payload: Record<string, unknown>;

        if (audienceType === 'MANUAL') {
          const result = validatePhoneLines(phones.split('\n'));
          if (!result.ok) {
            setCount(null);
            setError(result.errors[0]);
            return;
          }
          payload = {
            audienceType: 'MANUAL',
            recipients: result.phones.map((phone) => ({ phone })),
          };
        } else if (audienceType === 'TAGS') {
          const tags = audienceTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          if (!tags.length) {
            setCount(null);
            setError('Add at least one tag');
            return;
          }
          payload = {
            audienceType: 'TAGS',
            audienceConfig: { tags, requireOptIn: true },
          };
        } else if (audienceType === 'CONTACTS') {
          if (!selectedContactIds.length) {
            setCount(null);
            setError('Select at least one contact');
            return;
          }
          payload = {
            audienceType: 'CONTACTS',
            audienceConfig: { contactIds: selectedContactIds, requireOptIn: true },
          };
        } else {
          payload = {
            audienceType: 'ALL_OPTED_IN',
            audienceConfig: { requireOptIn: true },
          };
        }

        const { data } = await campaignApi.previewAudience(payload);
        if (!cancelled) {
          setCount(data.data.count);
          if (data.data.count === 0) setError('No opted-in recipients match this audience');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setCount(null);
          setError(
            (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
              ?.message || 'Could not preview audience',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = setTimeout(() => void load(), 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audienceType, phones, audienceTags, selectedContactIds]);

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        error
          ? 'border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20'
          : count !== null && count > 0
            ? 'border-sky-200/80 bg-gradient-to-r from-sky-50/80 via-theme-surface to-emerald-50/50 dark:border-sky-800/40 dark:from-sky-950/25 dark:via-transparent dark:to-emerald-950/20'
            : 'border-theme-border bg-theme-subtle/40'
      }`}
    >
      <div className="flex items-center gap-4 px-4 py-3.5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            error
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.28)]'
          }`}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : error ? (
            <AlertCircle className="h-5 w-5" strokeWidth={2.25} />
          ) : (
            <Users className="h-5 w-5" strokeWidth={2.25} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
            Audience estimate
          </p>
          {loading ? (
            <p className="mt-0.5 text-[13px] font-semibold text-theme-secondary">
              Calculating recipient count…
            </p>
          ) : error ? (
            <p className="mt-0.5 text-[13px] font-semibold text-amber-800 dark:text-amber-300">
              {error}
            </p>
          ) : count !== null ? (
            <p className="mt-0.5 text-[13px] font-medium text-theme-secondary">
              <span className="text-2xl font-extrabold tabular-nums text-sky-700 dark:text-sky-400">
                {count.toLocaleString()}
              </span>{' '}
              <span className="font-semibold text-theme-fg">
                {count === 1 ? 'recipient' : 'recipients'} ready to receive
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] font-medium text-theme-secondary">
              Choose who receives this to see the recipient count
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
