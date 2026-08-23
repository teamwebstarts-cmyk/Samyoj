import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Check,
  FileText,
  FolderOpen,
  Image,
  Mic,
  Package,
  Palette,
  RefreshCw,
  Sparkles,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import { FormPageSkeleton } from '../components/ui/ListLayoutSkeleton';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SegmentedControl from '../components/ui/SegmentedControl';
import {
  CreditsBar,
  ListShell,
  StatusBadge,
  StudioEmpty,
  StudioSection,
  WhatsAppPreview,
  type CreditKind,
} from '../components/content-studio/StudioPrimitives';
import { catalogApi, contentStudioApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';
import { messagingConsent } from '../utils/plainLanguage';

type Tab =
  | 'brand'
  | 'composer'
  | 'images'
  | 'videos'
  | 'audio'
  | 'catalog'
  | 'library'
  | 'calendar'
  | 'approvals';

type ToolAction =
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'translate'
  | 'on_brand'
  | 'ab_variants'
  | 'button_list';

interface BrandKit {
  companyName: string;
  colorPrimary?: string | null;
  colorSecondary?: string | null;
  colorAccent?: string | null;
  audience?: string | null;
  bannedWords: string[];
  mandatoryPhrases: string[];
  sampleLike?: string[];
  valueProps?: string[];
  defaultLocale?: string;
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
  templateCategory?: string | null;
  metaTemplateName?: string | null;
  metaTemplateStatus?: string | null;
  metaRejectionReason?: string | null;
}

interface MediaAsset {
  id: string;
  kind: string;
  status: string;
  prompt?: string | null;
  createdAt: string;
}

interface CalendarEvent {
  id: string;
  type: string;
  title: string;
  body?: string;
  status: string;
  at: string;
}

interface ApprovalItem {
  resourceKind: 'content_draft' | 'media_asset';
  resourceId: string;
  status: string;
  preview: string;
  updatedAt: string;
}

interface CatalogItem {
  id: string;
  name?: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  description?: string | null;
  priceCents?: number | null;
  currency?: string;
  imageUrl?: string | null;
  availability?: string;
  retailerId: string;
}

interface VoiceOption {
  id: string;
  name: string;
  language: string;
}

const emptyBrandKit: BrandKit = {
  companyName: '',
  colorPrimary: '#10b981',
  colorSecondary: '#6366f1',
  colorAccent: '#f59e0b',
  audience: '',
  bannedWords: [],
  mandatoryPhrases: [],
  sampleLike: [],
  valueProps: [],
  defaultLocale: 'en-IN',
  toneFormal: 60,
  toneBrief: 40,
  toneFriendly: 70,
  tonePlayful: 30,
};

const tabMeta = {
  brand: { label: 'Brand Kit', shortLabel: 'Brand', icon: Palette },
  composer: { label: 'Composer', shortLabel: 'Write', icon: Wand2 },
  images: { label: 'Images', shortLabel: 'Images', icon: Image },
  videos: { label: 'Videos', shortLabel: 'Video', icon: Video },
  audio: { label: 'Audio', shortLabel: 'Audio', icon: Mic },
  catalog: { label: 'Catalog', shortLabel: 'Shop', icon: Package },
  library: { label: 'Library', shortLabel: 'Library', icon: FolderOpen },
  calendar: { label: 'Calendar', shortLabel: 'Plan', icon: Calendar },
  approvals: { label: 'Approvals', shortLabel: 'Review', icon: Check },
} as const;

const toneFields = [
  { key: 'toneFormal' as const, label: 'Formal', low: 'Casual', high: 'Formal' },
  { key: 'toneBrief' as const, label: 'Length', low: 'Brief', high: 'Detailed' },
  { key: 'toneFriendly' as const, label: 'Warmth', low: 'Friendly', high: 'Professional' },
  { key: 'tonePlayful' as const, label: 'Mood', low: 'Serious', high: 'Playful' },
];

const colorFields = [
  { key: 'colorPrimary' as const, label: 'Primary' },
  { key: 'colorSecondary' as const, label: 'Secondary' },
  { key: 'colorAccent' as const, label: 'Accent' },
];

const DRAFT_KINDS = [
  { value: 'TEMPLATE_BODY', label: 'Template body' },
  { value: 'TEMPLATE_HEADER', label: 'Template header' },
  { value: 'TEMPLATE_FOOTER', label: 'Template footer' },
  { value: 'BUTTON_LABEL', label: 'Button label' },
  { value: 'CAMPAIGN_COPY', label: 'Campaign copy' },
  { value: 'AGENT_REPLY', label: 'Agent reply' },
  { value: 'FAQ', label: 'FAQ answer' },
  { value: 'PRODUCT_DESCRIPTION', label: 'Product description' },
  { value: 'AD_COPY', label: 'Ad copy' },
  { value: 'AB_VARIANT', label: 'A/B variant' },
  { value: 'FLOW_COPY', label: 'Flow copy' },
];

const LOCALES = [
  { value: 'en-IN', label: 'English (India)' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'ta-IN', label: 'Tamil' },
  { value: 'te-IN', label: 'Telugu' },
  { value: 'bn-IN', label: 'Bengali' },
  { value: 'mr-IN', label: 'Marathi' },
  { value: 'gu-IN', label: 'Gujarati' },
];

const ASPECTS = [
  { value: '1:1', label: '1:1 header' },
  { value: '9:16', label: '9:16 story' },
  { value: '16:9', label: '16:9 wide' },
  { value: '4:5', label: '4:5 catalog' },
];

const VIDEO_ASPECTS = [
  { value: '9:16', label: '9:16 story' },
  { value: '16:9', label: '16:9 wide' },
  { value: '1:1', label: '1:1 square' },
];

const VIDEO_TEMPLATES = [
  { value: 'ad', label: 'Ad creative' },
  { value: 'reveal', label: 'Product reveal' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'explainer', label: 'Explainer' },
];

const TOOLS: Array<{ action: ToolAction; label: string }> = [
  { action: 'rewrite', label: 'Rewrite' },
  { action: 'shorten', label: 'Shorten' },
  { action: 'expand', label: 'Expand' },
  { action: 'translate', label: 'Translate' },
  { action: 'on_brand', label: 'On-brand' },
  { action: 'ab_variants', label: '5 A/B' },
  { action: 'button_list', label: 'List' },
];

const ASSET_KINDS = [
  { value: '', label: 'All media' },
  { value: 'IMAGE', label: 'Images' },
  { value: 'VIDEO', label: 'Videos' },
  { value: 'AUDIO', label: 'Audio' },
];

const LOCALE_TO_META: Record<string, string> = {
  'en-IN': 'en_IN',
  'en-US': 'en_US',
  'hi-IN': 'hi',
  'ta-IN': 'ta',
  'te-IN': 'te',
  'bn-IN': 'bn',
  'mr-IN': 'mr',
  'gu-IN': 'gu',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function previewCopy(kit: BrandKit): string {
  const offer = kit.valueProps?.[0] || 'what we offer';
  const stop = kit.mandatoryPhrases?.[0] || 'Reply STOP to opt out.';
  return `Hi — this is ${kit.companyName || 'your brand'}. ${offer}. Want details? ${stop}`;
}

function formatPrice(product: CatalogProduct) {
  if (product.priceCents == null) return '';
  const amount = (product.priceCents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${product.currency || 'INR'} ${amount}`;
}

function HonestyNote({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
      {children}
    </p>
  );
}

export default function ContentStudioPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('brand');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [toolBusy, setToolBusy] = useState<ToolAction | null>(null);
  const [metaBusy, setMetaBusy] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit>(emptyBrandKit);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [credits, setCredits] = useState<{
    plan?: string;
    credits?: Record<string, CreditKind>;
  } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [draftKind, setDraftKind] = useState('TEMPLATE_BODY');
  const [locale, setLocale] = useState('en-IN');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [latestDraft, setLatestDraft] = useState<ContentDraft | null>(null);
  const [policyNote, setPolicyNote] = useState<string | null>(null);
  const [bannedWordsText, setBannedWordsText] = useState('');
  const [mandatoryPhrasesText, setMandatoryPhrasesText] = useState('');
  const [valuePropsText, setValuePropsText] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoAspect, setVideoAspect] = useState('9:16');
  const [videoDuration, setVideoDuration] = useState('15');
  const [videoTemplate, setVideoTemplate] = useState('ad');
  const [voiceScript, setVoiceScript] = useState('');
  const [voiceId, setVoiceId] = useState('default');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [catalogId, setCatalogId] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [libraryKind, setLibraryKind] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const libraryKindRef = useRef(libraryKind);
  libraryKindRef.current = libraryKind;

  const loadBrandKit = useCallback(async () => {
    const { data } = await contentStudioApi.getBrandKit();
    const kit = data.data as BrandKit;
    setBrandKit({ ...emptyBrandKit, ...kit });
    setBannedWordsText((kit.bannedWords || []).join(', '));
    setMandatoryPhrasesText((kit.mandatoryPhrases || []).join(', '));
    setValuePropsText((kit.valueProps || []).join(', '));
    if (kit.defaultLocale) setLocale(kit.defaultLocale);
  }, []);

  const loadLibrary = useCallback(async (mediaKind?: string) => {
    const kind = mediaKind ?? libraryKindRef.current;
    const [draftsRes, assetsRes, calendarRes, approvalsRes, creditsRes] = await Promise.all([
      contentStudioApi.listDrafts(),
      contentStudioApi.listAssets(kind ? { kind } : undefined),
      contentStudioApi.getCalendar().catch(() => ({ data: { data: { events: [] } } })),
      contentStudioApi.getApprovalQueue().catch(() => ({ data: { data: { queue: [] } } })),
      contentStudioApi.getCredits().catch(() => ({ data: { data: null } })),
    ]);
    setDrafts(draftsRes.data.data.drafts || []);
    setAssets(assetsRes.data.data.assets || []);
    setCalendarEvents(calendarRes.data?.data?.events || calendarRes.data?.data?.items || []);
    setApprovals(approvalsRes.data?.data?.queue || []);
    setCredits(creditsRes.data?.data || null);
  }, []);

  const loadVoices = useCallback(async () => {
    try {
      const { data } = await contentStudioApi.listVoices();
      const payload = data.data as { voices?: VoiceOption[]; message?: string };
      setVoices(payload.voices || []);
      setVoiceHint(payload.message || null);
      if (payload.voices?.[0]?.id) setVoiceId(payload.voices[0].id);
    } catch {
      setVoices([
        { id: 'default', name: 'Default Voice', language: 'en' },
        { id: 'professional', name: 'Professional', language: 'en' },
      ]);
      setVoiceHint('Voice generation is queued as a stub until ElevenLabs is configured.');
    }
  }, []);

  const loadCatalog = useCallback(async (selected?: string, search?: string, silent = false) => {
    setCatalogBusy(true);
    try {
      const { data } = await catalogApi.listCatalogs();
      const list = (data.data?.catalogs || []) as CatalogItem[];
      setCatalogs(list);
      const nextId = selected || catalogId || list[0]?.id || '';
      if (nextId && nextId !== catalogId) setCatalogId(nextId);
      if (!nextId) {
        setProducts([]);
        return;
      }
      const productsRes = await catalogApi.listProducts({
        catalogId: nextId,
        ...(search ? { search } : {}),
      });
      setProducts(productsRes.data.data?.products || []);
    } catch (err) {
      setCatalogs([]);
      setProducts([]);
      if (!silent) {
        toastError(getErrorMessage(err, 'Could not load catalog. Connect WhatsApp first.'));
      }
    } finally {
      setCatalogBusy(false);
    }
  }, [catalogId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadBrandKit(), loadLibrary(), loadVoices()]);
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not load Content Studio'));
    } finally {
      setLoading(false);
    }
  }, [loadBrandKit, loadLibrary, loadVoices]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'catalog') void loadCatalog(catalogId, catalogSearch, false);
    if (tab === 'images') void loadCatalog(catalogId, catalogSearch, true);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveBrandKit = async () => {
    setSaving(true);
    try {
      await contentStudioApi.updateBrandKit({
        ...brandKit,
        bannedWords: bannedWordsText.split(',').map((s) => s.trim()).filter(Boolean),
        mandatoryPhrases: mandatoryPhrasesText.split(',').map((s) => s.trim()).filter(Boolean),
        valueProps: valuePropsText.split(',').map((s) => s.trim()).filter(Boolean),
        defaultLocale: locale,
      });
      toastSuccess('Brand kit saved');
      await loadBrandKit();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not save brand kit'));
    } finally {
      setSaving(false);
    }
  };

  const applyGeneratedDraft = (draft: ContentDraft, policy?: { reasons?: string[] }) => {
    setLatestDraft(draft);
    if (policy?.reasons?.length) setPolicyNote(policy.reasons.join(' · '));
    else setPolicyNote(null);
  };

  const generateCopy = async () => {
    if (!prompt.trim()) {
      toastError('Write a brief first');
      return;
    }
    setGenerating(true);
    setPolicyNote(null);
    try {
      const { data } = await contentStudioApi.generate({
        prompt: prompt.trim(),
        kind: draftKind,
        locale,
      });
      const payload = data.data as {
        draft?: ContentDraft;
        policy?: { reasons?: string[]; safe?: boolean };
      };
      if (!payload.draft) {
        toastError('Generation failed');
        return;
      }
      applyGeneratedDraft(payload.draft, payload.policy);
      toastSuccess(payload.draft.status === 'BLOCKED' ? 'Draft blocked by policy' : 'Draft ready');
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Generation failed'));
    } finally {
      setGenerating(false);
    }
  };

  const runTool = async (action: ToolAction) => {
    const text = latestDraft?.body || prompt;
    if (!text.trim()) {
      toastError('Generate or paste copy first');
      return;
    }
    setToolBusy(action);
    try {
      const { data } = await contentStudioApi.runTool({
        action,
        text: text.trim(),
        locale,
        kind: draftKind,
        parentDraftId: latestDraft?.id,
      });
      const payload = data.data as {
        draft?: ContentDraft;
        drafts?: ContentDraft[];
        policy?: { reasons?: string[] };
      };
      if (!payload.draft) {
        toastError('Tool failed');
        return;
      }
      applyGeneratedDraft(payload.draft, payload.policy);
      toastSuccess(action === 'ab_variants' ? 'Saved 5 variants in Library' : 'Draft updated');
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Tool failed'));
    } finally {
      setToolBusy(null);
    }
  };

  const sendToReview = async (draft: ContentDraft) => {
    setMetaBusy(draft.id);
    try {
      await contentStudioApi.updateDraft(draft.id, { status: 'IN_REVIEW' });
      toastSuccess('Sent to review');
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not send to review'));
    } finally {
      setMetaBusy(null);
    }
  };

  const submitToMeta = async (draft: ContentDraft) => {
    setMetaBusy(draft.id);
    try {
      const { data } = await contentStudioApi.submitDraftToMeta(draft.id, { category: 'MARKETING' });
      const next = data.data?.draft as ContentDraft | undefined;
      if (next) setLatestDraft(next);
      toastSuccess(`Submitted to Meta as ${data.data?.meta?.name || 'template'}`);
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not submit to Meta'));
    } finally {
      setMetaBusy(null);
    }
  };

  const refreshMeta = async (draft: ContentDraft) => {
    setMetaBusy(draft.id);
    try {
      const { data } = await contentStudioApi.refreshDraftMetaStatus(draft.id);
      const next = data.data?.draft as ContentDraft | undefined;
      if (next) setLatestDraft(next);
      toastSuccess(next?.metaTemplateStatus || 'Status updated');
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not refresh Meta status'));
    } finally {
      setMetaBusy(null);
    }
  };

  const autofixDraft = async (draft: ContentDraft) => {
    setMetaBusy(draft.id);
    try {
      const { data } = await contentStudioApi.autofixDraft(draft.id);
      const next = data.data?.draft as ContentDraft | undefined;
      if (next) applyGeneratedDraft(next, data.data?.policy);
      toastSuccess('Fixed draft ready — review, then submit again');
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not auto-fix'));
    } finally {
      setMetaBusy(null);
    }
  };

  const openInTemplates = (draft: ContentDraft) => {
    navigate('/templates/new', {
      state: {
        studioBody: draft.body,
        studioLanguage: LOCALE_TO_META[draft.locale] || 'en_US',
      },
    });
  };

  const generateImage = async () => {
    if (!imagePrompt.trim()) {
      toastError('Describe the image first');
      return;
    }
    setGenerating(true);
    try {
      await contentStudioApi.generateImage({ prompt: imagePrompt.trim(), aspectRatio });
      toastSuccess('Image queued — it will land in Library');
      setImagePrompt('');
      await loadLibrary();
      setTab('library');
    } catch (err) {
      toastError(getErrorMessage(err, 'Image generation failed'));
    } finally {
      setGenerating(false);
    }
  };

  const generateVideo = async () => {
    if (!videoPrompt.trim()) {
      toastError('Write a video brief first');
      return;
    }
    setGenerating(true);
    try {
      const templateLabel = VIDEO_TEMPLATES.find((item) => item.value === videoTemplate)?.label;
      await contentStudioApi.generateVideo({
        prompt: `${templateLabel}: ${videoPrompt.trim()}`,
        aspectRatio: videoAspect,
        durationSeconds: Number(videoDuration) || 15,
      });
      toastSuccess('Video queued as a stub — it will land in Library');
      setVideoPrompt('');
      await loadLibrary();
      setTab('library');
    } catch (err) {
      toastError(getErrorMessage(err, 'Video generation failed'));
    } finally {
      setGenerating(false);
    }
  };

  const generateVoice = async () => {
    if (!voiceScript.trim()) {
      toastError('Paste a script first');
      return;
    }
    setGenerating(true);
    try {
      await contentStudioApi.generateVoice({
        script: voiceScript.trim(),
        voiceId,
        language: locale.split('-')[0] || 'en',
      });
      toastSuccess('Voice queued as a stub — it will land in Library');
      setVoiceScript('');
      await loadLibrary();
      setTab('library');
    } catch (err) {
      toastError(getErrorMessage(err, 'Voice generation failed'));
    } finally {
      setGenerating(false);
    }
  };

  const syncCatalog = async () => {
    if (!catalogId) {
      toastError('Pick a catalog first');
      return;
    }
    setCatalogBusy(true);
    try {
      const { data } = await catalogApi.sync(catalogId);
      toastSuccess(`Synced ${data.data?.synced ?? 0} products`);
      await loadCatalog(catalogId, catalogSearch);
    } catch (err) {
      toastError(getErrorMessage(err, 'Catalog sync failed'));
    } finally {
      setCatalogBusy(false);
    }
  };

  const describeProduct = async (product: CatalogProduct) => {
    setGenerating(true);
    try {
      const price = formatPrice(product);
      const { data } = await contentStudioApi.generate({
        prompt: `Write a WhatsApp catalog description for "${product.name}". ${price ? `Price: ${price}.` : ''} Keep it under 200 characters.`,
        kind: 'PRODUCT_DESCRIPTION',
        locale,
      });
      const draft = data.data?.draft as ContentDraft | undefined;
      if (draft) applyGeneratedDraft(draft, data.data?.policy);
      toastSuccess('Product description drafted');
      setTab('composer');
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not write description'));
    } finally {
      setGenerating(false);
    }
  };

  const archiveAsset = async (asset: MediaAsset) => {
    try {
      await contentStudioApi.archiveAsset(asset.id);
      toastSuccess('Archived');
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not archive'));
    }
  };

  const archiveDraft = async (draft: ContentDraft) => {
    try {
      await contentStudioApi.updateDraft(draft.id, { status: 'ARCHIVED' });
      toastSuccess('Archived');
      if (latestDraft?.id === draft.id) setLatestDraft(null);
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not archive'));
    }
  };

  const actOnApproval = async (item: ApprovalItem, action: 'approved' | 'rejected') => {
    setApprovingId(item.resourceId);
    try {
      await contentStudioApi.submitApproval({
        resourceKind: item.resourceKind,
        resourceId: item.resourceId,
        action,
      });
      toastSuccess(action === 'approved' ? 'Approved' : 'Rejected');
      await loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not update review'));
    } finally {
      setApprovingId(null);
    }
  };

  const visibleDrafts = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter(
      (draft) =>
        draft.body.toLowerCase().includes(q) ||
        draft.kind.toLowerCase().includes(q) ||
        (draft.metaTemplateName || '').toLowerCase().includes(q)
    );
  }, [drafts, librarySearch]);

  const visibleAssets = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => (asset.prompt || '').toLowerCase().includes(q) || asset.kind.toLowerCase().includes(q));
  }, [assets, librarySearch]);

  const heroStats = useMemo(
    () => [
      { label: 'Drafts', value: drafts.length, tone: 'text-violet-700 dark:text-violet-300' },
      { label: 'Assets', value: assets.length, tone: 'text-sky-700 dark:text-sky-300' },
      { label: 'In review', value: approvals.length, tone: 'text-amber-700 dark:text-amber-300' },
    ],
    [drafts.length, assets.length, approvals.length]
  );

  if (loading) {
    return (
      <PageShell>
        <FormPageSkeleton label="Loading Content Studio" blocks={5} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          badge="Content Studio"
          badgeIcon={Sparkles}
          title="Plan, create, approve, send"
          description="Brand-aware copy, images, video, and voice for WhatsApp — with policy checks, Meta template submit, and a daily generation budget."
          accent="violet"
          stats={heroStats}
        />

        <CreditsBar plan={credits?.plan} credits={credits?.credits} />

        <div className="inbox-shell overflow-hidden">
          <div className="flex items-center gap-3 border-b border-theme-border px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <SegmentedControl
                bare
                compact
                scroll
                value={tab}
                onChange={(v) => setTab(v as Tab)}
                options={(Object.keys(tabMeta) as Tab[]).map((key) => ({
                  value: key,
                  ...tabMeta[key],
                }))}
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
                  <StudioSection title="Identity" subtitle="Name, audience, and colors">
                    <div className="space-y-4">
                      <AppInput
                        label="Brand name"
                        value={brandKit.companyName}
                        onChange={(e) => setBrandKit({ ...brandKit, companyName: e.target.value })}
                      />
                      <AppInput
                        label="Audience"
                        value={brandKit.audience || ''}
                        onChange={(e) => setBrandKit({ ...brandKit, audience: e.target.value })}
                        placeholder="e.g. SMB retailers in India"
                      />
                      <AppTextarea
                        label="Value props"
                        hint="Comma-separated, max 5"
                        value={valuePropsText}
                        onChange={(e) => setValuePropsText(e.target.value)}
                        rows={2}
                        placeholder="Fast delivery, GST invoices, local support"
                      />
                      <AppSelect
                        id="brand-locale"
                        label="Default locale"
                        value={locale}
                        onChange={(e) => setLocale(e.target.value)}
                        options={LOCALES}
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

                  <div className="space-y-4">
                    <StudioSection title="WhatsApp preview" subtitle="How a message will feel">
                      <WhatsAppPreview
                        brandName={brandKit.companyName}
                        color={brandKit.colorPrimary || '#128C7E'}
                        body={previewCopy(brandKit)}
                      />
                    </StudioSection>
                    <StudioSection title="Voice & policy" subtitle="Tone and guardrails">
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {toneFields.map(({ key, label, low, high }) => (
                            <ToneSlider
                              key={key}
                              label={label}
                              low={low}
                              high={high}
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
                          placeholder="guaranteed, cure, best"
                        />
                        <AppTextarea
                          label="Mandatory phrases"
                          hint="At least one should appear in templates"
                          value={mandatoryPhrasesText}
                          onChange={(e) => setMandatoryPhrasesText(e.target.value)}
                          rows={2}
                          placeholder={messagingConsent.templateStopPlaceholder}
                        />
                      </div>
                    </StudioSection>
                  </div>
                </div>

                <div className="flex justify-end border-t border-theme-border pt-4">
                  <AppButton onClick={() => void saveBrandKit()} loading={saving} icon={<Palette size={16} />}>
                    Save brand kit
                  </AppButton>
                </div>
              </div>
            )}

            {tab === 'composer' && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <StudioSection title="Brief" subtitle="What should we write?">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AppSelect
                        id="draft-kind"
                        label="Type"
                        value={draftKind}
                        onChange={(e) => setDraftKind(e.target.value)}
                        options={DRAFT_KINDS}
                      />
                      <AppSelect
                        id="draft-locale"
                        label="Locale"
                        value={locale}
                        onChange={(e) => setLocale(e.target.value)}
                        options={LOCALES}
                      />
                    </div>
                    <AppTextarea
                      label="Brief"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={7}
                      placeholder="Summer sale for SMB retailers. 20% off this week. CTA: Reply YES."
                    />
                    <div className="flex justify-end">
                      <AppButton icon={<Wand2 size={16} />} onClick={() => void generateCopy()} loading={generating}>
                        Generate draft
                      </AppButton>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-theme-muted">AI tools</p>
                      <div className="flex flex-wrap gap-1.5">
                        {TOOLS.map((tool) => (
                          <AppButton
                            key={tool.action}
                            size="sm"
                            variant="secondary"
                            loading={toolBusy === tool.action}
                            disabled={generating || Boolean(toolBusy)}
                            onClick={() => void runTool(tool.action)}
                          >
                            {tool.label}
                          </AppButton>
                        ))}
                      </div>
                    </div>
                  </div>
                </StudioSection>

                <StudioSection title="Draft" subtitle="Saved in Library after generate">
                  {latestDraft ? (
                    <div className="space-y-3 rounded-xl border border-theme-border bg-theme-surface p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                          {latestDraft.kind.replace(/_/g, ' ')}
                        </span>
                        <StatusBadge status={latestDraft.metaTemplateStatus || latestDraft.status} />
                      </div>
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-theme-fg">
                        {latestDraft.body}
                      </p>
                      <p className="text-[11px] tabular-nums text-theme-muted">
                        {latestDraft.body.length} / 1024
                      </p>
                      {policyNote && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                          {policyNote}
                        </p>
                      )}
                      {latestDraft.metaTemplateName && (
                        <p className="text-[12px] text-theme-secondary">
                          Meta: <span className="font-mono">{latestDraft.metaTemplateName}</span>
                          {latestDraft.metaRejectionReason ? ` · ${latestDraft.metaRejectionReason}` : ''}
                        </p>
                      )}
                      <WhatsAppPreview
                        brandName={brandKit.companyName}
                        color={brandKit.colorPrimary || '#128C7E'}
                        body={latestDraft.body}
                      />
                      <DraftActions
                        draft={latestDraft}
                        busy={metaBusy === latestDraft.id}
                        onReview={() => void sendToReview(latestDraft)}
                        onSubmit={() => void submitToMeta(latestDraft)}
                        onRefresh={() => void refreshMeta(latestDraft)}
                        onFix={() => void autofixDraft(latestDraft)}
                        onTemplates={() => openInTemplates(latestDraft)}
                        onCampaigns={() => navigate('/campaigns')}
                      />
                    </div>
                  ) : (
                    <StudioEmpty
                      icon={FileText}
                      title="No draft yet"
                      description="Write a brief on the left. The AI uses your Brand Kit tone and policy rules."
                    />
                  )}
                </StudioSection>
              </div>
            )}

            {tab === 'images' && (
              <div className="mx-auto max-w-2xl space-y-4">
                <StudioSection
                  title="Image studio"
                  subtitle="Meta-ready sizes — 1:1 header, 9:16 story, 16:9 wide, 4:5 catalog"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AppSelect
                      id="image-aspect"
                      label="Aspect"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      options={ASPECTS}
                    />
                    {products.length > 0 && (
                      <AppSelect
                        id="image-product"
                        label="Use a catalog product"
                        value=""
                        onChange={(e) => {
                          const product = products.find((item) => item.id === e.target.value);
                          if (product) {
                            setImagePrompt(
                              `Product photo of ${product.name}${formatPrice(product) ? `, ${formatPrice(product)}` : ''}, brand colors, no extra text.`
                            );
                          }
                        }}
                        options={[
                          { value: '', label: 'Optional shortcut' },
                          ...products.slice(0, 40).map((product) => ({
                            value: product.id,
                            label: product.name,
                          })),
                        ]}
                      />
                    )}
                  </div>
                </StudioSection>
                <AppTextarea
                  label="Describe the image"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={5}
                  placeholder="Product hero on an emerald gradient, logo bottom-right, no extra text."
                />
                <div className="flex justify-end border-t border-theme-border pt-4">
                  <AppButton icon={<Image size={16} />} onClick={() => void generateImage()} loading={generating}>
                    Queue image
                  </AppButton>
                </div>
              </div>
            )}

            {tab === 'videos' && (
              <div className="mx-auto max-w-2xl space-y-4">
                <HonestyNote>
                  Video jobs queue as stubs until a provider is configured. They still use today&apos;s video-second budget.
                </HonestyNote>
                <StudioSection title="Video studio" subtitle="Short-form MP4 for stories, ads, and headers">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <AppSelect
                      id="video-template"
                      label="Template"
                      value={videoTemplate}
                      onChange={(e) => setVideoTemplate(e.target.value)}
                      options={VIDEO_TEMPLATES}
                    />
                    <AppSelect
                      id="video-aspect"
                      label="Aspect"
                      value={videoAspect}
                      onChange={(e) => setVideoAspect(e.target.value)}
                      options={VIDEO_ASPECTS}
                    />
                    <AppSelect
                      id="video-duration"
                      label="Length"
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(e.target.value)}
                      options={[
                        { value: '5', label: '5 seconds' },
                        { value: '15', label: '15 seconds' },
                        { value: '30', label: '30 seconds' },
                        { value: '60', label: '60 seconds' },
                      ]}
                    />
                  </div>
                </StudioSection>
                <AppTextarea
                  label="Script / brief"
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  rows={5}
                  placeholder="15s product reveal: bottle on a teak table, Hindi voiceover, brand color overlay at the end."
                />
                <div className="flex justify-end border-t border-theme-border pt-4">
                  <AppButton
                    icon={<Video size={16} />}
                    onClick={() => void generateVideo()}
                    loading={generating}
                  >
                    Queue video
                  </AppButton>
                </div>
              </div>
            )}

            {tab === 'audio' && (
              <div className="mx-auto max-w-2xl space-y-4">
                <HonestyNote>
                  {voiceHint ||
                    'Voice jobs queue as stubs until ElevenLabs is configured. Standard library voices only — no cloning.'}
                </HonestyNote>
                <StudioSection title="Voice studio" subtitle="TTS for WhatsApp notes and template voiceovers">
                  <AppSelect
                    id="voice-id"
                    label="Voice"
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    options={
                      voices.length
                        ? voices.map((voice) => ({ value: voice.id, label: `${voice.name} · ${voice.language}` }))
                        : [{ value: 'default', label: 'Default Voice · en' }]
                    }
                  />
                </StudioSection>
                <AppTextarea
                  label="Script"
                  value={voiceScript}
                  onChange={(e) => setVoiceScript(e.target.value)}
                  rows={5}
                  placeholder={latestDraft?.body || 'Paste copy here. Hindi and Tamil read more naturally after a provider is connected.'}
                />
                <div className="flex justify-end gap-2 border-t border-theme-border pt-4">
                  {latestDraft && (
                    <AppButton variant="secondary" onClick={() => setVoiceScript(latestDraft.body)}>
                      Use current draft
                    </AppButton>
                  )}
                  <AppButton icon={<Mic size={16} />} onClick={() => void generateVoice()} loading={generating}>
                    Queue voice
                  </AppButton>
                </div>
              </div>
            )}

            {tab === 'catalog' && (
              <div className="space-y-4">
                <StudioSection
                  title="Catalog"
                  subtitle="Sync Meta Commerce products, then draft descriptions"
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      {catalogs.length > 0 && (
                        <div className="w-[200px]">
                          <AppSelect
                            id="catalog-id"
                            value={catalogId}
                            onChange={(e) => {
                              setCatalogId(e.target.value);
                              void loadCatalog(e.target.value, catalogSearch);
                            }}
                            options={catalogs.map((item) => ({
                              value: item.id,
                              label: item.name || item.id,
                            }))}
                          />
                        </div>
                      )}
                      <AppButton variant="secondary" size="sm" loading={catalogBusy} onClick={() => void syncCatalog()}>
                        Sync
                      </AppButton>
                    </div>
                  }
                >
                  <AppInput
                    label="Search products"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void loadCatalog(catalogId, catalogSearch);
                    }}
                    placeholder="Name or retailer id"
                  />
                </StudioSection>
                {products.length === 0 ? (
                  <StudioEmpty
                    icon={Package}
                    title={catalogs.length === 0 ? 'No catalog on this number' : 'No products yet'}
                    description={
                      catalogs.length === 0
                        ? 'Connect WhatsApp with a Commerce catalog, then tap Sync.'
                        : 'Tap Sync to pull products from Meta. Then generate a description for any item.'
                    }
                  />
                ) : (
                  <ListShell>
                    {products.map((product) => (
                      <article key={product.id} className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-theme-fg">{product.name}</p>
                          <p className="mt-0.5 line-clamp-2 text-[12px] text-theme-secondary">
                            {product.description || product.retailerId}
                          </p>
                          <p className="mt-1 text-[11px] text-theme-muted">
                            {[formatPrice(product), product.availability].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <AppButton
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setImagePrompt(
                                `Catalog product photo of ${product.name} on a clean background, brand colors, no extra text.`
                              );
                              setAspectRatio('4:5');
                              setTab('images');
                            }}
                          >
                            Image
                          </AppButton>
                          <AppButton
                            size="sm"
                            loading={generating}
                            onClick={() => void describeProduct(product)}
                          >
                            Write copy
                          </AppButton>
                        </div>
                      </article>
                    ))}
                  </ListShell>
                )}
              </div>
            )}

            {tab === 'library' && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AppInput
                    label="Search"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Prompt, body, template name"
                  />
                  <AppSelect
                    id="library-kind"
                    label="Media kind"
                    value={libraryKind}
                    onChange={(e) => {
                      setLibraryKind(e.target.value);
                      void loadLibrary(e.target.value);
                    }}
                    options={ASSET_KINDS}
                  />
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <StudioSection title="Text drafts" subtitle={`${visibleDrafts.length} saved`}>
                    {visibleDrafts.length === 0 ? (
                      <StudioEmpty
                        icon={FileText}
                        title="No drafts yet"
                        description="Open Composer and generate brand-aware copy."
                        action={
                          <AppButton variant="secondary" onClick={() => setTab('composer')}>
                            Open Composer
                          </AppButton>
                        }
                      />
                    ) : (
                      <ListShell>
                        {visibleDrafts.map((draft) => (
                          <article key={draft.id} className="space-y-2 px-3.5 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                                {draft.kind.replace(/_/g, ' ')}
                              </span>
                              <StatusBadge status={draft.metaTemplateStatus || draft.status} />
                            </div>
                            <p className="line-clamp-4 whitespace-pre-wrap text-[13px] leading-relaxed text-theme-secondary">
                              {draft.body}
                            </p>
                            <p className="text-[11px] text-theme-muted">{formatDate(draft.createdAt)}</p>
                            <DraftActions
                              compact
                              draft={draft}
                              busy={metaBusy === draft.id}
                              onReview={() => void sendToReview(draft)}
                              onSubmit={() => void submitToMeta(draft)}
                              onRefresh={() => void refreshMeta(draft)}
                              onFix={() => void autofixDraft(draft)}
                              onTemplates={() => openInTemplates(draft)}
                              onCampaigns={() => navigate('/campaigns')}
                              onArchive={() => void archiveDraft(draft)}
                              onOpen={() => {
                                setLatestDraft(draft);
                                setTab('composer');
                              }}
                            />
                          </article>
                        ))}
                      </ListShell>
                    )}
                  </StudioSection>

                  <StudioSection title="Media" subtitle={`${visibleAssets.length} items`}>
                    {visibleAssets.length === 0 ? (
                      <StudioEmpty
                        icon={Image}
                        title="No media yet"
                        description="Queue a generation from Images, Videos, or Audio. Jobs land here when ready."
                        action={
                          <AppButton variant="secondary" onClick={() => setTab('images')}>
                            Open Images
                          </AppButton>
                        }
                      />
                    ) : (
                      <ListShell>
                        {visibleAssets.map((asset) => (
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
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <AppButton size="sm" variant="secondary" onClick={() => navigate('/templates')}>
                                Use in template
                              </AppButton>
                              <AppButton size="sm" variant="secondary" onClick={() => navigate('/campaigns')}>
                                Use in campaign
                              </AppButton>
                              <AppButton size="sm" variant="ghost" onClick={() => void archiveAsset(asset)}>
                                Archive
                              </AppButton>
                            </div>
                          </article>
                        ))}
                      </ListShell>
                    )}
                  </StudioSection>
                </div>
              </div>
            )}

            {tab === 'calendar' && (
              <StudioSection title="Next 30 days" subtitle="Drafts, assets, and generation jobs">
                {calendarEvents.length === 0 ? (
                  <StudioEmpty
                    icon={Calendar}
                    title="Nothing scheduled"
                    description="Generated drafts and image jobs show up here as a timeline."
                  />
                ) : (
                  <ListShell>
                    {calendarEvents.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-theme-fg">{item.title}</p>
                          {item.body && (
                            <p className="mt-0.5 line-clamp-1 text-[12px] text-theme-secondary">{item.body}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 sm:shrink-0">
                          <span className="text-[12px] text-theme-secondary">{formatDate(item.at)}</span>
                          <StatusBadge status={item.status} />
                        </div>
                      </div>
                    ))}
                  </ListShell>
                )}
              </StudioSection>
            )}

            {tab === 'approvals' && (
              <StudioSection title="Review queue" subtitle="Drafts and assets waiting on a decision">
                {approvals.length === 0 ? (
                  <StudioEmpty
                    icon={Check}
                    title="Queue is empty"
                    description="Items in review appear here. Approve or reject from this list."
                  />
                ) : (
                  <ListShell>
                    {approvals.map((item) => (
                      <div
                        key={item.resourceId}
                        className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                            {item.resourceKind.replace(/_/g, ' ')}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[13px] text-theme-fg">{item.preview}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={item.status} />
                          <AppButton
                            size="sm"
                            variant="secondary"
                            icon={<Check size={14} />}
                            loading={approvingId === item.resourceId}
                            onClick={() => void actOnApproval(item, 'approved')}
                          >
                            Approve
                          </AppButton>
                          <AppButton
                            size="sm"
                            variant="danger"
                            icon={<X size={14} />}
                            disabled={approvingId === item.resourceId}
                            onClick={() => void actOnApproval(item, 'rejected')}
                          >
                            Reject
                          </AppButton>
                        </div>
                      </div>
                    ))}
                  </ListShell>
                )}
              </StudioSection>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function DraftActions({
  draft,
  busy,
  compact,
  onReview,
  onSubmit,
  onRefresh,
  onFix,
  onTemplates,
  onCampaigns,
  onArchive,
  onOpen,
}: {
  draft: ContentDraft;
  busy: boolean;
  compact?: boolean;
  onReview: () => void;
  onSubmit: () => void;
  onRefresh: () => void;
  onFix: () => void;
  onTemplates: () => void;
  onCampaigns: () => void;
  onArchive?: () => void;
  onOpen?: () => void;
}) {
  const submitted = Boolean(draft.metaTemplateName);
  const rejected = (draft.metaTemplateStatus || '').toUpperCase() === 'REJECTED' || draft.status === 'REJECTED';

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'pt-1'}`}>
      {onOpen && (
        <AppButton size="sm" variant="secondary" onClick={onOpen}>
          Open
        </AppButton>
      )}
      {!submitted && draft.status !== 'BLOCKED' && (
        <>
          <AppButton size="sm" variant="secondary" loading={busy} onClick={onReview}>
            Send to review
          </AppButton>
          <AppButton size="sm" loading={busy} onClick={onSubmit}>
            Submit to Meta
          </AppButton>
        </>
      )}
      {submitted && (
        <AppButton size="sm" variant="secondary" loading={busy} onClick={onRefresh}>
          Refresh Meta
        </AppButton>
      )}
      {rejected && (
        <AppButton size="sm" loading={busy} onClick={onFix}>
          Auto-fix
        </AppButton>
      )}
      <AppButton size="sm" variant="secondary" onClick={onTemplates}>
        Open in Templates
      </AppButton>
      <AppButton size="sm" variant="ghost" onClick={onCampaigns}>
        Campaigns
      </AppButton>
      {onArchive && (
        <AppButton size="sm" variant="ghost" onClick={onArchive}>
          Archive
        </AppButton>
      )}
    </div>
  );
}

function ToneSlider({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-theme-border/60 bg-theme-subtle/30 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
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
      <div className="mt-1 flex justify-between text-[10px] font-medium text-theme-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </label>
  );
}
