import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Calendar,
  FileText,
  FolderOpen,
  Image,
  Palette,
  RefreshCw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppTextarea from '../components/ui/AppTextarea';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SegmentedControl from '../components/ui/SegmentedControl';
import { contentStudioApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';
import { messagingConsent } from '../utils/plainLanguage';

type Tab = 'brand' | 'create' | 'library';
type CreateMode = 'copy' | 'image';

interface BrandKit {
  companyName: string;
  colorPrimary?: string | null;
  colorSecondary?: string | null;
  colorAccent?: string | null;
  audience?: string | null;
  bannedWords: string[];
  mandatoryPhrases: string[];
  toneFormal: number;
  toneBrief: number;
  toneFriendly: number;
  tonePlayful: number;
}

interface ContentDraft {
  id: string;
  kind: string;
  status: string;
  body: string;
  locale: string;
  createdAt: string;
}

interface MediaAsset {
  id: string;
  kind: string;
  status: string;
  prompt?: string | null;
  createdAt: string;
}

interface CalendarItem {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
}

const emptyBrandKit: BrandKit = {
  companyName: '',
  colorPrimary: '#10b981',
  colorSecondary: '#6366f1',
  colorAccent: '#f59e0b',
  audience: '',
  bannedWords: [],
  mandatoryPhrases: [],
  toneFormal: 60,
  toneBrief: 40,
  toneFriendly: 70,
  tonePlayful: 30,
};

const tabMeta = {
  brand: { label: 'Brand Kit', shortLabel: 'Brand', icon: Palette },
  create: { label: 'Create', shortLabel: 'Create', icon: Sparkles },
  library: { label: 'Library', shortLabel: 'Library', icon: FolderOpen },
} as const;

const toneFields = [
  { key: 'toneFormal' as const, label: 'Formal' },
  { key: 'toneBrief' as const, label: 'Brief' },
  { key: 'toneFriendly' as const, label: 'Friendly' },
  { key: 'tonePlayful' as const, label: 'Playful' },
];

const colorFields = [
  { key: 'colorPrimary' as const, label: 'Primary' },
  { key: 'colorSecondary' as const, label: 'Secondary' },
  { key: 'colorAccent' as const, label: 'Accent' },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'APPROVED' || status === 'READY' || status === 'COMPLETED'
      ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300'
      : status === 'FAILED'
        ? 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300'
        : 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300';

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${tone}`}>
      {status.toLowerCase()}
    </span>
  );
}

function StudioSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-extrabold tracking-tight text-theme-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] text-theme-secondary">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ListShell({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-theme-border overflow-hidden rounded-xl border border-theme-border bg-theme-surface">
      {children}
    </div>
  );
}

export default function ContentStudioPage() {
  const [tab, setTab] = useState<Tab>('brand');
  const [createMode, setCreateMode] = useState<CreateMode>('copy');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [brandKit, setBrandKit] = useState<BrandKit>(emptyBrandKit);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [bannedWordsText, setBannedWordsText] = useState('');
  const [mandatoryPhrasesText, setMandatoryPhrasesText] = useState('');

  const loadBrandKit = useCallback(async () => {
    const { data } = await contentStudioApi.getBrandKit();
    const kit = data.data as BrandKit;
    setBrandKit(kit);
    setBannedWordsText((kit.bannedWords || []).join(', '));
    setMandatoryPhrasesText((kit.mandatoryPhrases || []).join(', '));
  }, []);

  const loadLibrary = useCallback(async () => {
    const [draftsRes, assetsRes, calendarRes] = await Promise.all([
      contentStudioApi.listDrafts(),
      contentStudioApi.listAssets(),
      contentStudioApi.getCalendar().catch(() => ({ data: { data: { items: [] } } })),
    ]);
    setDrafts(draftsRes.data.data.drafts || []);
    setAssets(assetsRes.data.data.assets || []);
    setCalendarItems(calendarRes.data.data.items || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadBrandKit(), loadLibrary()]);
    } catch (err) {
      toastError(getErrorMessage(err, 'Failed to load Content Studio'));
    } finally {
      setLoading(false);
    }
  }, [loadBrandKit, loadLibrary]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveBrandKit = async () => {
    setSaving(true);
    try {
      await contentStudioApi.updateBrandKit({
        ...brandKit,
        bannedWords: bannedWordsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        mandatoryPhrases: mandatoryPhrasesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toastSuccess('Brand kit saved');
      await loadBrandKit();
    } catch (err) {
      toastError(getErrorMessage(err, 'Failed to save brand kit'));
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    if (!prompt.trim()) {
      toastError('Enter a prompt first');
      return;
    }
    setGenerating(true);
    try {
      if (createMode === 'copy') {
        await contentStudioApi.generate({ prompt: prompt.trim(), kind: 'TEMPLATE_BODY' });
        toastSuccess('Draft generated');
      } else {
        await contentStudioApi.generateImage({ prompt: prompt.trim() });
        toastSuccess('Image job queued');
      }
      setPrompt('');
      await loadLibrary();
      setTab('library');
    } catch (err) {
      toastError(
        getErrorMessage(err, createMode === 'copy' ? 'Generation failed' : 'Image generation failed')
      );
    } finally {
      setGenerating(false);
    }
  };

  const heroStats = useMemo(
    () => [
      { label: 'Drafts', value: drafts.length, tone: 'text-violet-700 dark:text-violet-300' },
      { label: 'Assets', value: assets.length, tone: 'text-sky-700 dark:text-sky-300' },
      {
        label: 'Scheduled',
        value: calendarItems.length,
        tone: 'text-amber-700 dark:text-amber-300',
      },
    ],
    [drafts.length, assets.length, calendarItems.length]
  );

  const brandPreview = brandKit.companyName || 'Your brand';

  if (loading) {
    return (
      <PageShell>
        <LoadingState label="Loading Content Studio…" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          badge="Content Studio"
          badgeIcon={Sparkles}
          title="AI content for WhatsApp"
          description="Set your brand voice, generate copy and images, and manage everything in one library."
          accent="violet"
          stats={heroStats}
        />

        <div className="inbox-shell overflow-hidden">
          <div className="flex items-center gap-3 border-b border-theme-border px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <SegmentedControl
                bare
                value={tab}
                onChange={(v) => setTab(v as Tab)}
                options={[
                  { value: 'brand', ...tabMeta.brand },
                  { value: 'create', ...tabMeta.create },
                  { value: 'library', ...tabMeta.library },
                ]}
                ariaLabel="Content Studio sections"
              />
            </div>
            <AppButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={15} />}
              onClick={() => void load()}
              aria-label="Refresh"
            >
              <span className="hidden sm:inline">Refresh</span>
            </AppButton>
          </div>

          <div className="p-4 sm:p-5">
            {tab === 'brand' && (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <StudioSection title="Identity" subtitle="Company profile and brand colors">
                    <div className="space-y-4">
                      <div className="rounded-xl border border-theme-border bg-theme-subtle/30 p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {[brandKit.colorPrimary, brandKit.colorSecondary, brandKit.colorAccent].map(
                              (color, i) => (
                                <span
                                  key={i}
                                  className="h-8 w-8 rounded-lg ring-1 ring-theme-border"
                                  style={{ backgroundColor: color || '#10b981' }}
                                />
                              )
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-bold text-theme-fg">{brandPreview}</p>
                            <p className="truncate text-[12px] text-theme-secondary">
                              {brandKit.audience || 'Add your target audience'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <AppInput
                        label="Company name"
                        value={brandKit.companyName}
                        onChange={(e) => setBrandKit({ ...brandKit, companyName: e.target.value })}
                      />
                      <AppInput
                        label="Audience"
                        value={brandKit.audience || ''}
                        onChange={(e) => setBrandKit({ ...brandKit, audience: e.target.value })}
                        placeholder="e.g. SMB retailers in India"
                      />

                      <div>
                        <p className="mb-2 text-[12px] font-bold text-theme-secondary">Brand colors</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {colorFields.map(({ key, label }) => (
                            <label key={key} className="space-y-2">
                              <span className="text-[11px] font-semibold text-theme-muted">{label}</span>
                              <div className="flex items-center gap-2 rounded-xl border border-theme-border bg-theme-subtle/40 p-2">
                                <input
                                  type="color"
                                  value={brandKit[key] || '#10b981'}
                                  onChange={(e) => setBrandKit({ ...brandKit, [key]: e.target.value })}
                                  className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                                  aria-label={label}
                                />
                                <span className="font-mono text-[11px] text-theme-secondary">
                                  {brandKit[key]}
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </StudioSection>

                  <StudioSection title="Voice & policy" subtitle="Tone sliders and content guardrails">
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {toneFields.map(({ key, label }) => (
                          <ToneSlider
                            key={key}
                            label={label}
                            value={brandKit[key]}
                            onChange={(value) => setBrandKit({ ...brandKit, [key]: value })}
                          />
                        ))}
                      </div>

                      <AppTextarea
                        label="Banned words"
                        hint="Comma-separated"
                        value={bannedWordsText}
                        onChange={(e) => setBannedWordsText(e.target.value)}
                        rows={2}
                        placeholder="cheap, guaranteed, free money"
                      />
                      <AppTextarea
                        label="Mandatory phrases"
                        hint="Comma-separated"
                        value={mandatoryPhrasesText}
                        onChange={(e) => setMandatoryPhrasesText(e.target.value)}
                        rows={2}
                        placeholder={messagingConsent.templateStopPlaceholder}
                      />
                    </div>
                  </StudioSection>
                </div>

                <div className="flex justify-end border-t border-theme-border pt-4">
                  <AppButton onClick={() => void saveBrandKit()} loading={saving} icon={<Palette size={16} />}>
                    Save brand kit
                  </AppButton>
                </div>
              </div>
            )}

            {tab === 'create' && (
              <div className="mx-auto max-w-2xl space-y-4">
                <StudioSection
                  title="AI generator"
                  subtitle={
                    createMode === 'copy'
                      ? 'WhatsApp-ready copy aligned to your brand kit'
                      : 'On-brand images queued to your library'
                  }
                >
                  <SegmentedControl
                    bare
                    value={createMode}
                    onChange={setCreateMode}
                    options={[
                      { value: 'copy', label: 'Copy', shortLabel: 'Copy', icon: FileText },
                      { value: 'image', label: 'Image', shortLabel: 'Image', icon: Image },
                    ]}
                    ariaLabel="Create mode"
                  />
                </StudioSection>

                <AppTextarea
                  label={createMode === 'copy' ? 'What should we write?' : 'Describe the image'}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  placeholder={
                    createMode === 'copy'
                      ? 'Write a promotional message for our summer sale…'
                      : 'Product hero shot on emerald gradient background…'
                  }
                />

                <div className="flex flex-col gap-3 border-t border-theme-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] text-theme-secondary">
                    {createMode === 'copy'
                      ? 'Uses your tone settings and policy rules from Brand Kit.'
                      : 'Completed jobs appear in Library when ready.'}
                  </p>
                  <AppButton
                    icon={createMode === 'copy' ? <Wand2 size={16} /> : <Image size={16} />}
                    onClick={() => void generate()}
                    loading={generating}
                  >
                    {createMode === 'copy' ? 'Generate draft' : 'Queue image'}
                  </AppButton>
                </div>
              </div>
            )}

            {tab === 'library' && (
              <div className="space-y-6">
                {calendarItems.length > 0 && (
                  <StudioSection title="Scheduled" subtitle="Approved content for the next 30 days">
                    <ListShell>
                      {calendarItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                              <Calendar className="h-4 w-4" />
                            </div>
                            <p className="truncate text-[13px] font-semibold text-theme-fg">{item.title}</p>
                          </div>
                          <div className="flex items-center gap-2 sm:shrink-0">
                            <span className="text-[12px] text-theme-secondary">
                              {formatDate(item.scheduledAt)}
                            </span>
                            <StatusBadge status={item.status} />
                          </div>
                        </div>
                      ))}
                    </ListShell>
                  </StudioSection>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                  <StudioSection title="Text drafts" subtitle={`${drafts.length} saved`}>
                    {drafts.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        compact
                        title="No drafts yet"
                        description="Create marketing copy in the Create tab."
                        action={
                          <AppButton variant="secondary" onClick={() => setTab('create')}>
                            Create copy
                          </AppButton>
                        }
                      />
                    ) : (
                      <ListShell>
                        {drafts.map((draft) => (
                          <article key={draft.id} className="px-3.5 py-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                                {draft.kind.replace(/_/g, ' ')}
                              </span>
                              <StatusBadge status={draft.status} />
                            </div>
                            <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-theme-secondary">
                              {draft.body}
                            </p>
                            <p className="mt-2 text-[11px] text-theme-muted">{formatDate(draft.createdAt)}</p>
                          </article>
                        ))}
                      </ListShell>
                    )}
                  </StudioSection>

                  <StudioSection title="Media assets" subtitle={`${assets.length} items`}>
                    {assets.length === 0 ? (
                      <EmptyState
                        icon={Image}
                        compact
                        title="No images yet"
                        description="Generate images in the Create tab."
                        action={
                          <AppButton
                            variant="secondary"
                            onClick={() => {
                              setCreateMode('image');
                              setTab('create');
                            }}
                          >
                            Create image
                          </AppButton>
                        }
                      />
                    ) : (
                      <ListShell>
                        {assets.map((asset) => (
                          <article key={asset.id} className="px-3.5 py-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                                {asset.kind}
                              </span>
                              <StatusBadge status={asset.status} />
                            </div>
                            <p className="line-clamp-2 text-[13px] text-theme-secondary">
                              {asset.prompt || 'Generated asset'}
                            </p>
                            <p className="mt-2 text-[11px] text-theme-muted">{formatDate(asset.createdAt)}</p>
                          </article>
                        ))}
                      </ListShell>
                    )}
                  </StudioSection>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function ToneSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-theme-border/60 bg-theme-subtle/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-theme-fg">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-theme-muted">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-theme-subtle accent-violet-600"
      />
    </label>
  );
}
