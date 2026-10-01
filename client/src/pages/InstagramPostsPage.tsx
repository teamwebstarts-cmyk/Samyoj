import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarClock, FileText, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import { useAuth } from '../contexts/AuthContext';
import { useMetaChannelConnect } from '../components/layout/MetaChannelChips';
import MetaMockNotice from '../components/meta/MetaMockNotice';
import { useMetaMock } from '../contexts/MetaMockContext';
import { automationApi, contentStudioApi, instagramApi } from '../services/api';
import { getInstagramMockLibrary, getInstagramMockPosts, isMetaMockId, mergeById } from '../utils/metaMockData';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';
import { resolvePublicMediaUrl } from '../utils/publicMediaUrl';
import ConnectScreen from '../components/instagram/posts/ConnectScreen';
import PostPanel from '../components/instagram/posts/PostPanel';
import PostComposerTab, { type ScheduleError } from '../components/instagram/posts/PostComposerTab';
import PostPreviewTab, { type PreviewData } from '../components/instagram/posts/PostPreviewTab';
import PostAutomationTab from '../components/instagram/posts/PostAutomationTab';
import { PostBanner, PostFeedBar, PostStatsRow, type PostCounts, type PostFeedTab, type PostFilterId } from '../components/instagram/posts/PostsChrome';
import { PostsGrid, PostsLibrary, PostsZeroState } from '../components/instagram/posts/PostsGrid';
import {
  CAPTION_MAX,
  CAROUSEL_MAX,
  HASHTAG_MAX,
  IMAGE_MAX_MB,
  REMOTE_PREFIX,
  VIDEO_MAX_MB,
  countHashtags,
  isRemoteId,
  type LibraryItem,
  type MediaItem,
  type MediaType,
  type PanelTab,
  type MediaUploadState,
  type PostRow,
} from '../components/instagram/posts/types';
import type { FeedRatioId } from '../components/instagram/posts/cropImage';
import './instagram-comments.css';
import './instagram-posts.css';

type StudioAsset = { id: string; publicUrl: string | null; prompt: string | null };

/** Newest activity first: published date, else schedule, else last edit. */
function postRecency(post: PostRow): number {
  const iso =
    post.status === 'SCHEDULED'
      ? post.scheduledAt
      : post.status === 'PUBLISHED'
        ? post.publishedAt
        : post.updatedAt || post.createdAt || post.scheduledAt || post.publishedAt;
  const time = iso ? new Date(iso).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

/** Read image dimensions for the preview "Media" row; videos keep size only. */
async function readMediaMeta(file: File): Promise<string | null> {
  const sizeLabel =
    file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
  if (!file.type.startsWith('image/')) return sizeLabel;
  try {
    const url = URL.createObjectURL(file);
    const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = url;
    });
    URL.revokeObjectURL(url);
    return dims ? `${dims.w} × ${dims.h} • ${sizeLabel}` : sizeLabel;
  } catch {
    return sizeLabel;
  }
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Keep the composer docked only when the viewport can give both columns room. */
function useIsDesktopPanel(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

export default function InstagramPostsPage() {
  const { orgRole } = useAuth();
  const canEdit = orgRole === 'OWNER' || orgRole === 'ADMIN' || orgRole === 'SUPERVISOR';
  const { canConnect, busy, startInstagramConnect } = useMetaChannelConnect();
  const { enabled: mockEnabled } = useMetaMock();
  const isDesktop = useIsDesktopPanel();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState(false);

  const [filter, setFilter] = useState<PostFilterId>('all');
  const [feedTab, setFeedTab] = useState<PostFeedTab>('posts');
  const [feedRatio, setFeedRatio] = useState<FeedRatioId>('1:1');

  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('create');
  const [mediaType, setMediaType] = useState<MediaType>('IMAGE');
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaMeta, setMediaMeta] = useState<{ name: string; meta: string | null } | null>(null);
  const [scheduleLocal, setScheduleLocal] = useState('');
  const [scheduleError, setScheduleError] = useState<ScheduleError>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [mediaUpload, setMediaUpload] = useState<MediaUploadState | null>(null);

  const [studioOpen, setStudioOpen] = useState(false);
  const [studioAssets, setStudioAssets] = useState<StudioAsset[]>([]);
  const [autoKeyword, setAutoKeyword] = useState('');
  const [autoPublic, setAutoPublic] = useState('');
  const [autoDm, setAutoDm] = useState('');
  const [autoId, setAutoId] = useState<string | null>(null);
  const automationLoadSeq = useRef(0);
  const automationEditedRef = useRef(false);

  /* ---------------- data ---------------- */

  const loadLibrary = useCallback(async () => {
    if (mockEnabled) {
      setLibrary(getInstagramMockLibrary());
      setLibraryError(false);
      setLibraryLoading(false);
      return;
    }
    setLibraryLoading(true);
    try {
      const { data } = await instagramApi.posts.library();
      setLibrary(data.data.items || []);
      setLibraryError(false);
    } catch {
      setLibrary([]);
      setLibraryError(true);
      toastError('Could not load Instagram library');
    } finally {
      setLibraryLoading(false);
    }
  }, [mockEnabled]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await instagramApi.posts.list('all');
      const real = data.data.posts as PostRow[];
      const samples = mockEnabled ? getInstagramMockPosts() : [];
      setConnected(Boolean(data.data.connected) || samples.length > 0);
      setHandle(
        data.data.account?.username
          ? `@${data.data.account.username.replace(/^@/, '')}`
          : samples.length
            ? '@yourstudio'
            : null,
      );
      setPosts(mergeById(real, samples));
      setLoadFailed(false);
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not load Instagram posts');
      setConnected(false);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [mockEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (connected) void loadLibrary();
  }, [connected, loadLibrary]);

  /* ---------------- selection ---------------- */

  const selected = useMemo(
    () =>
      selectedId && selectedId !== 'new' && !isRemoteId(selectedId)
        ? posts.find((p) => p.id === selectedId) ?? null
        : null,
    [posts, selectedId],
  );

  const remoteItem = useMemo(() => {
    if (!isRemoteId(selectedId)) return null;
    const igMediaId = selectedId.slice(REMOTE_PREFIX.length);
    return library.find((row) => row.igMediaId === igMediaId) ?? null;
  }, [library, selectedId]);

  const automationMediaId = selected?.igMediaId || remoteItem?.igMediaId || null;
  const locked = selected ? selected.status === 'PUBLISHED' || selected.status === 'PROCESSING' : false;
  const composerMode = selectedId === 'new' || (selected && !locked);
  const removable = selected ? ['DRAFT', 'FAILED', 'CANCELLED'].includes(selected.status) : false;

  const samyojIgIds = useMemo(
    () => new Set(posts.map((p) => p.igMediaId).filter(Boolean) as string[]),
    [posts],
  );
  const libraryTiles = library.filter((row) => !samyojIgIds.has(row.igMediaId));
  const selectedLiveStats = selected?.igMediaId
    ? library.find((row) => row.igMediaId === selected.igMediaId)
    : null;

  /* Desktop: panel is always docked — when nothing is selected it shows the
     composer. Closing on desktop therefore resets to a fresh New post. */
  useEffect(() => {
    if (isDesktop && selectedId === null) setSelectedId('new');
  }, [isDesktop, selectedId]);

  const openNew = (type: MediaType = 'IMAGE') => {
    automationLoadSeq.current += 1;
    automationEditedRef.current = false;
    setSelectedId('new');
    setPanelTab('create');
    setMediaType(type);
    setFeedRatio('1:1');
    setCaption('');
    setImageUrl('');
    setVideoUrl('');
    setMediaItems([]);
    setMediaMeta(null);
    setScheduleLocal('');
    setScheduleError(null);
    setStudioOpen(false);
    setAutoKeyword('');
    setAutoPublic('');
    setAutoDm('');
    setAutoId(null);
  };

  /* ---------------- AI Studio hand-off ----------------
     Studio navigates here with the generated pack: media (rendered PNGs) +
     caption prefill the composer; the user reviews, then posts or schedules. */
  const [studioHandoffName, setStudioHandoffName] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const state = (location.state || {}) as {
      studioHandoff?: boolean;
      studioName?: string;
      mediaType?: MediaType;
      caption?: string;
      mediaUrls?: string[];
    };
    if (!state.studioHandoff) return;
    openNew(state.mediaType === 'CAROUSEL' ? 'CAROUSEL' : 'IMAGE');
    if (state.caption) setCaption(state.caption);
    const urls = (state.mediaUrls || []).filter((u) => typeof u === 'string' && u.length > 0);
    if (urls.length > 0) {
      setMediaItems(urls.map((url) => ({ url, kind: 'image' as const })));
      setImageUrl(urls[0]);
      setMediaMeta({
        name: `${state.studioName || 'AI Studio'} visuals`,
        meta: `${urls.length} image${urls.length > 1 ? 's' : ''} from AI Studio`,
      });
    }
    setStudioHandoffName(state.studioName || 'AI Studio');
    // Consume the state so refresh doesn't re-prefill.
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePanel = () => {
    if (isDesktop) {
      openNew('IMAGE');
    } else {
      setSelectedId(null);
    }
  };

  const openExisting = (post: PostRow) => {
    automationLoadSeq.current += 1;
    automationEditedRef.current = false;
    setSelectedId(post.id);
    setMediaType(post.mediaType || 'IMAGE');
    setFeedRatio(post.feedRatio ?? '1:1');
    setCaption(post.caption);
    setImageUrl(post.mediaType === 'REELS' ? '' : post.imageUrl);
    const payload = post.mediaPayload?.length ? post.mediaPayload : [];
    setMediaItems(payload);
    setVideoUrl(post.mediaType === 'REELS' ? payload[0]?.url || post.imageUrl : '');
    setScheduleLocal(post.scheduledAt ? toLocalInput(post.scheduledAt) : '');
    setScheduleError(null);
    setMediaMeta(null);
    setStudioOpen(false);
    setAutoKeyword('');
    setAutoPublic('');
    setAutoDm('');
    setAutoId(null);
    setPanelTab(post.status === 'PUBLISHED' || post.status === 'PROCESSING' ? 'preview' : 'create');
    void loadPostAutomation(post.igMediaId, post.id);
  };

  const openRemote = (item: LibraryItem) => {
    automationLoadSeq.current += 1;
    automationEditedRef.current = false;
    setSelectedId(`${REMOTE_PREFIX}${item.igMediaId}`);
    setPanelTab('preview');
    setFeedRatio('1:1');
    setCaption(item.caption);
    setImageUrl(item.thumbnailUrl);
    setVideoUrl('');
    setMediaItems([]);
    setMediaMeta(null);
    setScheduleLocal('');
    setScheduleError(null);
    setAutoKeyword('');
    setAutoPublic('');
    setAutoDm('');
    setAutoId(null);
    void loadPostAutomation(item.igMediaId);
  };

  /* ---------------- upload ---------------- */

  const uploadFile = async (file: File, target: 'single' | 'carousel') => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/') && file.type !== 'image/gif';
    if (!isVideo && !isImage) {
      toastError('Use JPEG, PNG, WebP, MP4, or MOV.');
      return;
    }
    if (mediaType === 'IMAGE' && isVideo) {
      toastError('Switch to Reel for video.');
      return;
    }
    if (mediaType === 'REELS' && !isVideo) {
      toastError('Reels need a video file.');
      return;
    }
    const maxBytes = (isVideo ? VIDEO_MAX_MB : IMAGE_MAX_MB) * 1024 * 1024;
    if (file.size > maxBytes) {
      toastError(
        isVideo
          ? `Video must be ${VIDEO_MAX_MB} MB or smaller.`
          : `Image must be ${IMAGE_MAX_MB} MB or smaller.`,
      );
      return;
    }
    if (target === 'carousel' && mediaItems.length >= CAROUSEL_MAX) {
      toastError(`Carousel can contain up to ${CAROUSEL_MAX} slides.`);
      return;
    }

    let progressTimer: ReturnType<typeof setInterval> | undefined;
    const stopProgressTimer = () => {
      if (progressTimer) clearInterval(progressTimer);
      progressTimer = undefined;
    };
    const creepProgress = (cap: number) => {
      stopProgressTimer();
      progressTimer = setInterval(() => {
        setMediaUpload((current) => {
          if (!current) {
            stopProgressTimer();
            return null;
          }
          if (current.progress >= cap) return current;
          const step = current.progress < 40 ? 4 : 2;
          return { ...current, progress: Math.min(cap, current.progress + step) };
        });
      }, 140);
    };

    setMediaUpload({ fileName: file.name, label: 'Preparing your file…', progress: 6 });
    creepProgress(28);
    setMediaUpload((current) =>
      current
        ? { ...current, label: 'Uploading to Samyoj…', progress: Math.max(current.progress, 32) }
        : { fileName: file.name, label: 'Uploading to Samyoj…', progress: 32 },
    );
    creepProgress(90);

    try {
      const { data: res } = await instagramApi.posts.upload(file);
      stopProgressTimer();
      setMediaUpload((current) =>
        current
          ? { ...current, label: 'Building preview…', progress: 100 }
          : { fileName: file.name, label: 'Building preview…', progress: 100 },
      );
      const url = res.data.mediaUrl || res.data.imageUrl;
      const kind = res.data.kind || (isVideo ? 'video' : 'image');
      const meta = await readMediaMeta(file);
      await new Promise((resolve) => setTimeout(resolve, 320));
      setMediaMeta({ name: file.name, meta });
      if (target === 'carousel') {
        setMediaItems((prev) => [...prev, { url, kind }]);
        if (!imageUrl && kind === 'image') setImageUrl(url);
      } else if (mediaType === 'REELS') {
        setVideoUrl(url);
        setMediaItems([{ url, kind: 'video' }]);
      } else {
        setImageUrl(url);
        setMediaItems([]);
      }
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not upload media');
    } finally {
      stopProgressTimer();
      setMediaUpload(null);
    }
  };

  const removeSlide = (index: number) => {
    setMediaItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (imageUrl && !next.some((item) => item.url === imageUrl)) {
        setImageUrl(next.find((item) => item.kind === 'image')?.url ?? next[0]?.url ?? '');
      }
      return next;
    });
  };

  const removeMedia = () => {
    setImageUrl('');
    setVideoUrl('');
    setMediaItems([]);
    setMediaMeta(null);
  };

  /* ---------------- AI Studio ---------------- */

  const loadStudioImages = async () => {
    setStudioOpen(true);
    try {
      const { data } = await contentStudioApi.listAssets({ kind: 'IMAGE', limit: '24' });
      const assets =
        ((data as { data?: { assets?: StudioAsset[] } }).data?.assets) || [];
      setStudioAssets(assets.filter((asset) => asset.publicUrl));
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not load AI Studio images');
    }
  };

  const pickStudioImage = (asset: StudioAsset) => {
    if (asset.publicUrl) setImageUrl(asset.publicUrl);
    setMediaMeta({ name: 'AI Studio image', meta: null });
    setStudioOpen(false);
  };

  /* ---------------- automation ---------------- */

  /** Inline composer fields carry into savePostAutomation via these states. */
  const inlineAutomationReady = Boolean(autoKeyword.trim() && (autoPublic.trim() || autoDm.trim()));

  const loadPostAutomation = async (igMediaId: string | null, postId?: string) => {
    const seq = ++automationLoadSeq.current;
    if (!igMediaId && !postId) return;
    try {
      const { data } = await automationApi.list({ limit: '100', triggerType: 'KEYWORD' });
      if (seq !== automationLoadSeq.current || automationEditedRef.current) return;
      const rows =
        ((data as { data?: { automations?: Array<{ id: string; config: Record<string, string> }> } }).data
          ?.automations) || [];
      // Live rules match on media id; pending rules (draft/scheduled) on the post id.
      const match = rows.find(
        (row) =>
          row.config?.platform === 'IG' &&
          ((igMediaId && row.config?.igMediaId === igMediaId) ||
            (postId && row.config?.igPostId === postId)),
      );
      if (!match) return;
      setAutoId(match.id);
      setAutoKeyword(match.config.keyword || '');
      setAutoPublic(match.config.publicMessage || '');
      setAutoDm(match.config.message || match.config.response || '');
    } catch {
      /* automation list is optional */
    }
  };

  const onAutoKeywordChange = (value: string) => {
    automationEditedRef.current = true;
    setAutoKeyword(value);
  };

  const onAutoPublicChange = (value: string) => {
    automationEditedRef.current = true;
    setAutoPublic(value);
  };

  const onAutoDmChange = (value: string) => {
    automationEditedRef.current = true;
    setAutoDm(value);
  };

  const savePostAutomation = async (opts?: { postId?: string; igMediaId?: string | null }) => {
    const igMediaId = opts?.igMediaId ?? automationMediaId;
    const postId =
      opts?.postId ??
      (selectedId && selectedId !== 'new' && !isRemoteId(selectedId) ? selectedId : null);
    if (!igMediaId && !postId) return;
    if (selected && isMetaMockId(selected.id)) {
      toastError('Sample posts do not save a real comment rule.');
      return;
    }
    if (!autoKeyword.trim() || (!autoPublic.trim() && !autoDm.trim())) {
      toastError('Add a comment word, plus a public reply or a private DM.');
      return;
    }
    const nested = Boolean(opts);
    if (!nested) {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
    }
    const config: Record<string, string> = {
      platform: 'IG',
      keyword: autoKeyword.trim(),
      message: autoDm.trim(),
      publicMessage: autoPublic.trim(),
    };
    if (igMediaId) {
      config.igMediaId = igMediaId;
    } else if (postId) {
      config.igPostId = postId;
    } else {
      if (!nested) {
        savingRef.current = false;
        setSaving(false);
      }
      return;
    }
    try {
      const savedName = `Post comment · ${autoKeyword.trim()}`;
      if (autoId) {
        await automationApi.update(autoId, {
          name: savedName,
          triggerType: 'KEYWORD',
          config,
          enabled: true,
        });
      } else {
        const { data } = await automationApi.create({
          name: savedName,
          triggerType: 'KEYWORD',
          config,
          enabled: true,
        });
        const created = (data as { data?: { id?: string } }).data;
        if (created?.id) setAutoId(created.id);
      }
      toastSuccess(
        igMediaId ? 'Comment automation saved' : 'Saved — activates when the post publishes',
      );
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not save comment automation');
    } finally {
      if (!nested) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  /* ---------------- save / publish ---------------- */

  const buildBody = () => {
    if (mediaType === 'REELS') {
      return { caption, mediaType, feedRatio, videoUrl, imageUrl: videoUrl || undefined };
    }
    if (mediaType === 'CAROUSEL') {
      return { caption, mediaType, feedRatio, mediaItems, imageUrl: imageUrl || mediaItems[0]?.url };
    }
    return { caption, mediaType: 'IMAGE' as const, feedRatio, imageUrl };
  };

  const save = async (mode: 'draft' | 'schedule' | 'now') => {
    if (selectedId && selectedId !== 'new' && isMetaMockId(selectedId)) {
      toastError('This is a sample post. Create a real one to publish.');
      return;
    }
    if (inlineAutomationReady && !autoKeyword.trim()) {
      toastError('Add the automation word.');
      return;
    }
    if (Boolean(autoKeyword.trim()) && !autoPublic.trim() && !autoDm.trim()) {
      toastError('Add a public reply or a private DM for the automation.');
      return;
    }
    const body = buildBody();
    if (mediaType === 'IMAGE' && !body.imageUrl) {
      toastError('Add an image first.');
      return;
    }
    if (mediaType === 'REELS' && !videoUrl) {
      toastError('Add a video for this Reel.');
      return;
    }
    if (mediaType === 'CAROUSEL' && mediaItems.length < 2) {
      toastError('Carousel needs at least 2 slides.');
      return;
    }
    if (countHashtags(caption) > HASHTAG_MAX) {
      toastError(`Use at most ${HASHTAG_MAX} hashtags.`);
      return;
    }

    let scheduledAt: string | null = null;
    if (mode === 'schedule') {
      if (!scheduleLocal) {
        setScheduleError('empty');
        toastError('Pick a date and time.');
        return;
      }
      const when = new Date(scheduleLocal).getTime();
      const delta = when - Date.now();
      if (delta < 10 * 60 * 1000) {
        setScheduleError('early');
        toastError('Schedule at least 10 minutes from now.');
        return;
      }
      if (delta > 75 * 24 * 60 * 60 * 1000) {
        setScheduleError('late');
        toastError('Schedule at most 75 days ahead.');
        return;
      }
      scheduledAt = new Date(scheduleLocal).toISOString();
    }

    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = { ...body, scheduledAt: mode === 'draft' ? null : scheduledAt };
      const created =
        selectedId && selectedId !== 'new'
          ? (await instagramApi.posts.update(selectedId, payload)).data.data
          : (await instagramApi.posts.create(payload)).data.data;
      let liveIgMediaId: string | null = created.igMediaId ?? null;
      if (mode === 'now') {
        const published = await instagramApi.posts.publish(created.id);
        liveIgMediaId = published.data.data.igMediaId ?? liveIgMediaId;
        if (published.data.data.status === 'FAILED') {
          toastError(published.data.data.lastError || 'Could not publish post');
        } else {
          toastSuccess('Post published');
          setPanelTab('preview');
          void loadPostAutomation(liveIgMediaId, created.id);
        }
      } else {
        toastSuccess(mode === 'schedule' ? 'Post scheduled' : 'Post saved as draft');
      }
      setSelectedId(created.id);
      if (autoKeyword.trim() && (autoPublic.trim() || autoDm.trim())) {
        await savePostAutomation({ postId: created.id, igMediaId: liveIgMediaId });
      }
      await load();
      if (mode === 'now') void loadLibrary();
    } catch (err) {
      toastError(getErrorMessage(err) || (mode === 'now' ? 'Could not publish post' : 'Could not save post'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const cancelSchedule = async () => {
    if (!selected) return;
    try {
      await instagramApi.posts.cancel(selected.id);
      toastSuccess('Schedule cancelled');
      await load();
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not cancel schedule');
    }
  };

  const removePost = async () => {
    if (!selected) return;
    try {
      await instagramApi.posts.remove(selected.id);
      setSelectedId(null);
      toastSuccess('Post removed');
      await load();
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not remove post');
    }
  };

  /* ---------------- derived ---------------- */

  const counts: PostCounts = useMemo(
    () => ({
      total: posts.length,
      published: posts.filter((post) => post.status === 'PUBLISHED').length,
      scheduled: posts.filter((post) => post.status === 'SCHEDULED').length,
      drafts: posts.filter((post) => post.status === 'DRAFT').length,
      failed: posts.filter((post) => post.status === 'FAILED').length,
    }),
    [posts],
  );

  const visiblePosts = useMemo(() => {
    return posts
      .filter((post) => filter === 'all' || post.status === filter)
      .sort((a, b) => postRecency(b) - postRecency(a));
  }, [posts, filter]);

  const visibleLibrary = libraryTiles;

  const previewUrl = resolvePublicMediaUrl(
    mediaType === 'REELS'
      ? videoUrl
      : mediaType === 'CAROUSEL'
        ? imageUrl || mediaItems[0]?.url || ''
        : imageUrl,
  );

  const previewData: PreviewData = useMemo(() => {
    if (remoteItem) {
      return {
        mediaType: (remoteItem.mediaType === 'REELS' ? 'REELS' : remoteItem.mediaType === 'CAROUSEL' ? 'CAROUSEL' : 'IMAGE') as MediaType,
        previewUrl: resolvePublicMediaUrl(remoteItem.thumbnailUrl),
        caption: remoteItem.caption,
        status: 'PUBLISHED',
        scheduledAt: null,
        publishedAt: null,
        permalink: remoteItem.permalink,
        likes: remoteItem.likes,
        comments: remoteItem.comments,
        feedRatio: '1:1',
        isRemote: true,
      };
    }
    return {
      mediaType,
      previewUrl,
      caption,
      status: selectedId === 'new' ? null : selected?.status ?? null,
      scheduledAt: selectedId === 'new' ? (scheduleLocal ? new Date(scheduleLocal).toISOString() : null) : selected?.scheduledAt ?? null,
      publishedAt: selected?.publishedAt ?? null,
      mediaName: mediaMeta?.name ?? null,
      mediaMeta: mediaMeta?.meta ?? null,
      feedRatio,
      likes: selectedLiveStats?.likes,
      comments: selectedLiveStats?.comments,
    };
  }, [remoteItem, mediaType, previewUrl, caption, selectedId, selected, scheduleLocal, mediaMeta, feedRatio, selectedLiveStats]);

  const gridItems = useMemo(() => {
    const active = { id: 'current', url: previewData.previewUrl, active: true };
    const others = posts
      .filter((post) => post.id !== selectedId && post.imageUrl)
      .map((post) => ({ id: post.id, url: post.imageUrl, active: false }));
    return [active, ...others].slice(0, 9);
  }, [posts, selectedId, previewData.previewUrl]);

  const showZeroState =
    feedTab === 'posts' &&
    connected === true &&
    !loading &&
    posts.length === 0 &&
    filter === 'all';

  /* ---------------- footer actions ---------------- */

  const renderFooter = () => {
    if (!canEdit || !selectedId || remoteItem) return null;
    if (locked) return null;
    return (
      <>
        <button
          type="button"
          className="igp-btn igp-btn--outline"
          disabled={saving}
          onClick={() => void save('draft')}
        >
          <FileText className="h-3.5 w-3.5" />
          Save as Draft
        </button>
        {selected?.status === 'SCHEDULED' ? (
          <button type="button" className="igp-btn igp-btn--ghost" disabled={saving} onClick={() => void cancelSchedule()}>
            <CalendarClock className="h-3.5 w-3.5" />
            Cancel schedule
          </button>
        ) : null}
        {removable ? (
          <button type="button" className="igp-btn igp-btn--danger" disabled={saving} onClick={() => void removePost()}>
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        ) : null}
        {scheduleLocal ? (
          <button
            type="button"
            className="igp-btn igp-btn--primary"
            disabled={saving}
            onClick={() => void save('schedule')}
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <CalendarClock className="h-4 w-4" />
            )}
            Schedule Post
          </button>
        ) : (
          <button
            type="button"
            className="igp-btn igp-btn--primary"
            disabled={saving}
            onClick={() => void save('now')}
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Publish now
          </button>
        )}
      </>
    );
  };

  /* ---------------- panel body ---------------- */

  const renderPanelBody = () => {
    if (panelTab === 'automation') {
      const canConfigureAutomation = Boolean(canEdit && !locked && (remoteItem || composerMode));
      return (
        <PostAutomationTab
          ready={Boolean(automationMediaId)}
          pendingOk={canConfigureAutomation}
          postPersisted={selectedId !== 'new' && selectedId !== null}
          isRemote={Boolean(remoteItem)}
          isMock={Boolean(selected && isMetaMockId(selected.id))}
          canEdit={canEdit}
          saving={saving}
          keyword={autoKeyword}
          onKeywordChange={onAutoKeywordChange}
          publicReply={autoPublic}
          onPublicReplyChange={onAutoPublicChange}
          dm={autoDm}
          onDmChange={onAutoDmChange}
          autoId={autoId}
          onSave={() => void savePostAutomation()}
        />
      );
    }

    if (panelTab === 'preview') {
      return (
        <PostPreviewTab
          data={previewData}
          handle={handle}
          canEdit={canEdit}
          editablePost={Boolean(selected && !locked && !remoteItem)}
          gridItems={gridItems}
          automationConfigured={Boolean(autoId)}
          onEdit={() => setPanelTab('create')}
          onEditAutomation={() => setPanelTab('automation')}
        />
      );
    }

    return (
      <PostComposerTab
        key={selectedId ?? 'new'}
        mediaType={mediaType}
        feedRatio={feedRatio}
        onFeedRatioChange={setFeedRatio}
        onMediaTypeChange={(next) => {
          setMediaType(next);
          if (next === 'IMAGE') {
            setVideoUrl('');
            setMediaItems([]);
          }
        }}
        canEdit={canEdit}
        composerMode={Boolean(composerMode)}
        saving={saving}
        uploadState={mediaUpload}
        previewUrl={previewUrl}
        videoUrl={videoUrl}
        mediaItems={mediaItems}
        onUploadFile={uploadFile}
        onRemoveSlide={removeSlide}
        onRemoveMedia={removeMedia}
        caption={caption}
        onCaptionChange={(value) => setCaption(value.slice(0, CAPTION_MAX))}
        scheduleLocal={scheduleLocal}
        onScheduleChange={setScheduleLocal}
        scheduleError={scheduleError}
        onScheduleErrorChange={setScheduleError}
        studioOpen={studioOpen}
        studioAssets={studioAssets}
        onOpenStudio={() => void loadStudioImages()}
        onPickStudio={pickStudioImage}
        lastError={selected?.lastError ?? null}
      />
    );
  };

  const panelTitle = remoteItem ? 'Live on Instagram' : selectedId === 'new' ? 'New post' : 'Post';

  /* ---------------- render ---------------- */

  return (
    <PageShell list>
      <div className="igc-page igp-page">
        <MetaMockNotice />

        {studioHandoffName && (
          <p className="mt-2 flex items-center gap-2 rounded-xl border border-[#e6defb] bg-[#f4efff] px-3 py-2 text-[12px] font-medium text-[#4c3a86]">
            <Sparkles size={14} className="flex-none text-[#6d3df2]" />
            Loaded from AI Studio — “{studioHandoffName}”. Your visuals and caption are pre-filled below. Review everything, then post when ready.
          </p>
        )}

        <PostBanner
          connected={connected}
          handle={handle}
          canEdit={canEdit}
          onNewPost={() => openNew('IMAGE')}
        />

        {connected === false && !loading ? (
          loadFailed ? (
            <section className="igp-zero" style={{ paddingTop: 44 }}>
              <span className="igp-auto__emptyicon">
                <AlertCircle className="h-5 w-5" />
              </span>
              <h2 className="igp-zero__title">Could not load posts</h2>
              <p className="igp-zero__desc">
                Check your connection and try again. Your posts and settings are safe.
              </p>
              <div className="igp-zero__actions">
                <button type="button" className="igp-btn igp-btn--primary igp-btn--lg" onClick={() => void load()}>
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            </section>
          ) : (
            <ConnectScreen
              canConnect={canConnect}
              busy={busy === 'ig'}
              onConnect={() => void startInstagramConnect()}
            />
          )
        ) : (
          <>
            <div className="igp-workspace">
              <div className="igp-feed">
                <PostStatsRow
                  counts={counts}
                  loading={loading}
                  filter={feedTab === 'posts' ? filter : null}
                  onFilterChange={(next) => {
                    setFilter(next);
                    setFeedTab('posts');
                  }}
                />

                <PostFeedBar
                  tab={feedTab}
                  onTabChange={setFeedTab}
                  postsCount={counts.total}
                  liveCount={libraryTiles.length}
                  canEdit={canEdit}
                />

                {feedTab === 'live' ? (
                  <PostsLibrary
                    items={visibleLibrary}
                    loading={libraryLoading}
                    error={libraryError}
                    selectedId={selectedId}
                    onOpen={openRemote}
                    onRefresh={() => void loadLibrary()}
                  />
                ) : showZeroState ? (
                  <PostsZeroState canEdit={canEdit} onNewPost={() => openNew('IMAGE')} />
                ) : (
                  <PostsGrid
                    posts={visiblePosts}
                    loading={loading}
                    selectedId={selectedId}
                    onOpen={(post) => openExisting(post)}
                  />
                )}
              </div>

              <PostPanel
                open={isDesktop || Boolean(selectedId)}
                onClose={closePanel}
                title={panelTitle}
                tab={panelTab}
                onTabChange={setPanelTab}
                showCreateTab={!remoteItem}
                automationReady={Boolean(autoId || inlineAutomationReady)}
                body={renderPanelBody()}
                footer={renderFooter()}
              />
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
