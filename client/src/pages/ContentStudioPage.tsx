import { useCallback, useEffect, useState } from 'react';
import { Palette, FolderOpen, Sparkles, RefreshCw } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppTextarea from '../components/ui/AppTextarea';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SegmentedControl from '../components/ui/SegmentedControl';
import { contentStudioApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';

type Tab = 'brand-kit' | 'composer' | 'library' | 'images' | 'calendar';

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

export default function ContentStudioPage() {
  const [tab, setTab] = useState<Tab>('brand-kit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [brandKit, setBrandKit] = useState<BrandKit>(emptyBrandKit);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [prompt, setPrompt] = useState('');
  const [bannedWordsText, setBannedWordsText] = useState('');
  const [mandatoryPhrasesText, setMandatoryPhrasesText] = useState('');
  const [calendarItems, setCalendarItems] = useState<
    Array<{ id: string; title: string; scheduledAt: string; status: string }>
  >([]);

  const loadBrandKit = useCallback(async () => {
    const { data } = await contentStudioApi.getBrandKit();
    const kit = data.data as BrandKit;
    setBrandKit(kit);
    setBannedWordsText((kit.bannedWords || []).join(', '));
    setMandatoryPhrasesText((kit.mandatoryPhrases || []).join(', '));
  }, []);

  const loadLibrary = useCallback(async () => {
    const [draftsRes, assetsRes] = await Promise.all([
      contentStudioApi.listDrafts(),
      contentStudioApi.listAssets(),
    ]);
    setDrafts(draftsRes.data.data.drafts || []);
    setAssets(assetsRes.data.data.assets || []);
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

  const loadCalendar = useCallback(async () => {
    try {
      const { data } = await contentStudioApi.getCalendar();
      setCalendarItems(data.data.items || []);
    } catch {
      setCalendarItems([]);
    }
  }, []);

  useEffect(() => {
    if (tab === 'calendar') void loadCalendar();
  }, [tab, loadCalendar]);

  const generateCopy = async () => {
    if (!prompt.trim()) {
      toastError('Enter a prompt first');
      return;
    }
    setGenerating(true);
    try {
      await contentStudioApi.generate({ prompt: prompt.trim(), kind: 'TEMPLATE_BODY' });
      toastSuccess('Draft generated');
      setPrompt('');
      await loadLibrary();
      setTab('library');
    } catch (err) {
      toastError(getErrorMessage(err, 'Generation failed'));
    } finally {
      setGenerating(false);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      toastError('Enter a prompt first');
      return;
    }
    setGenerating(true);
    try {
      await contentStudioApi.generateImage({ prompt: prompt.trim() });
      toastSuccess('Image job queued');
      setPrompt('');
      await loadLibrary();
      setTab('library');
    } catch (err) {
      toastError(getErrorMessage(err, 'Image generation failed'));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingState label="Loading Content Studio…" />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        badge="Content Studio"
        badgeIcon={Sparkles}
        title="AI content workspace"
        description="Brand-aligned copy and assets for WhatsApp templates, campaigns, and CTWA creatives."
        accent="violet"
      />

      <PageHeader
        actions={
          <AppButton variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </AppButton>
        }
      />

      <div className="mb-6">
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: 'brand-kit', label: 'Brand Kit', shortLabel: 'Brand', icon: Palette },
            { value: 'composer', label: 'Composer', shortLabel: 'Create', icon: Sparkles },
            { value: 'images', label: 'Images', shortLabel: 'Images', icon: Sparkles },
            { value: 'calendar', label: 'Calendar', shortLabel: 'Cal', icon: FolderOpen },
            { value: 'library', label: 'Library', shortLabel: 'Library', icon: FolderOpen },
          ]}
        />
      </div>

      {tab === 'brand-kit' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-theme-border bg-theme-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-theme-fg">Identity</h2>
            <div className="space-y-4">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <AppInput
                  label="Primary"
                  type="color"
                  value={brandKit.colorPrimary || '#10b981'}
                  onChange={(e) => setBrandKit({ ...brandKit, colorPrimary: e.target.value })}
                />
                <AppInput
                  label="Secondary"
                  type="color"
                  value={brandKit.colorSecondary || '#6366f1'}
                  onChange={(e) => setBrandKit({ ...brandKit, colorSecondary: e.target.value })}
                />
                <AppInput
                  label="Accent"
                  type="color"
                  value={brandKit.colorAccent || '#f59e0b'}
                  onChange={(e) => setBrandKit({ ...brandKit, colorAccent: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-theme-border bg-theme-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-theme-fg">Voice & policy</h2>
            <div className="space-y-4">
              <AppTextarea
                label="Banned words (comma-separated)"
                value={bannedWordsText}
                onChange={(e) => setBannedWordsText(e.target.value)}
                rows={2}
              />
              <AppTextarea
                label="Mandatory phrases (comma-separated)"
                value={mandatoryPhrasesText}
                onChange={(e) => setMandatoryPhrasesText(e.target.value)}
                rows={2}
                placeholder="Reply STOP to opt out"
              />
              <div className="grid grid-cols-2 gap-3">
                {(['toneFormal', 'toneBrief', 'toneFriendly', 'tonePlayful'] as const).map((key) => (
                  <AppInput
                    key={key}
                    label={key.replace('tone', '')}
                    type="number"
                    min={0}
                    max={100}
                    value={String(brandKit[key])}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, [key]: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                ))}
              </div>
              <AppButton onClick={() => void saveBrandKit()} disabled={saving}>
                {saving ? 'Saving…' : 'Save brand kit'}
              </AppButton>
            </div>
          </section>
        </div>
      )}

      {tab === 'composer' && (
        <section className="max-w-2xl rounded-xl border border-theme-border bg-theme-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-theme-fg">AI Composer</h2>
          <p className="mb-4 text-sm text-theme-secondary">
            Generate WhatsApp-ready copy using your brand kit tone and policy rules.
          </p>
          <AppTextarea
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Write a promotional message for our summer sale…"
          />
          <div className="mt-4">
            <AppButton onClick={() => void generateCopy()} disabled={generating}>
              {generating ? 'Generating…' : 'Generate draft'}
            </AppButton>
          </div>
        </section>
      )}

      {tab === 'images' && (
        <section className="rounded-xl border border-theme-border bg-theme-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-theme-fg">AI image generation</h2>
          <p className="mb-4 text-[13px] text-theme-secondary">
            Generate on-brand images from your Brand Kit. Jobs appear in Library when complete.
          </p>
          <AppTextarea
            label="Image prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Product hero shot on emerald gradient background..."
          />
          <AppButton className="mt-4" disabled={generating} onClick={() => void generateImage()}>
            Queue image job
          </AppButton>
        </section>
      )}

      {tab === 'calendar' && (
        <section className="rounded-xl border border-theme-border bg-theme-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-theme-fg">Content calendar</h2>
          <p className="mb-4 text-[13px] text-theme-secondary">
            Scheduled drafts and approved assets for the next 30 days.
          </p>
          {calendarItems.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Nothing scheduled"
              description="Approved drafts with a schedule date will appear here."
              action={
                <AppButton variant="secondary" onClick={() => setTab('library')}>
                  View library
                </AppButton>
              }
            />
          ) : (
            <ul className="space-y-2">
              {calendarItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-theme-border px-3 py-2 text-[13px]"
                >
                  <span className="font-medium text-theme-fg">{item.title}</span>
                  <span className="text-theme-muted">
                    {new Date(item.scheduledAt).toLocaleDateString()} · {item.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'library' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-theme-border bg-theme-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-theme-fg">Text drafts</h2>
            {drafts.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No drafts yet"
                description="Generate on-brand copy in the Composer tab."
                action={
                  <AppButton variant="secondary" onClick={() => setTab('composer')}>
                    Open Composer
                  </AppButton>
                }
              />
            ) : (
              <ul className="space-y-3">
                {drafts.map((draft) => (
                  <li
                    key={draft.id}
                    className="rounded-lg border border-theme-border bg-theme-subtle p-3 text-sm"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium text-theme-fg">{draft.kind}</span>
                      <span className="text-xs uppercase text-theme-secondary">{draft.status}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-theme-secondary">{draft.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-theme-border bg-theme-surface p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-theme-fg">Media assets</h2>
            {assets.length === 0 ? (
              <EmptyState icon={FolderOpen} title="No assets yet" description="Image generation will appear here." />
            ) : (
              <ul className="space-y-3">
                {assets.map((asset) => (
                  <li
                    key={asset.id}
                    className="rounded-lg border border-theme-border bg-theme-subtle p-3 text-sm"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium text-theme-fg">{asset.kind}</span>
                      <span className="text-xs uppercase text-theme-secondary">{asset.status}</span>
                    </div>
                    <p className="text-theme-secondary">{asset.prompt || 'Generated asset'}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
