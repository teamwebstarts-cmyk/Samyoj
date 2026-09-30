import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { resolvePublicMediaUrl } from '../../../utils/publicMediaUrl';
import { toastError } from '../../../utils/toast';
import { getErrorMessage } from '../../../utils/errors';
import { instagramApi } from '../../../services/api';
import {
  AlertTriangle,
  CalendarClock,
  Clapperboard,
  Clock3,
  ImagePlus,
  Info,
  Layers,
  Loader2,
  Maximize2,
  Replace,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react';
import {
  CAPTION_MAX,
  CAROUSEL_MAX,
  HASHTAG_MAX,
  countHashtags,
  type MediaItem,
  type MediaType,
  type MediaUploadState,
} from './types';
import { FEED_RATIOS, cropImageToRatio, type FeedRatioId } from './cropImage';

type StudioAsset = { id: string; publicUrl: string | null; prompt: string | null };

type ComposerTabProps = {
  mediaType: MediaType;
  onMediaTypeChange: (value: MediaType) => void;
  feedRatio: FeedRatioId;
  onFeedRatioChange: (value: FeedRatioId) => void;
  canEdit: boolean;
  composerMode: boolean;
  saving: boolean;
  uploadState: MediaUploadState | null;
  previewUrl: string;
  videoUrl: string;
  mediaItems: MediaItem[];
  onUploadFile: (file: File, target: 'single' | 'carousel') => void;
  onRemoveSlide: (index: number) => void;
  onRemoveMedia: () => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  scheduleLocal: string;
  onScheduleChange: (value: string) => void;
  scheduleError: ScheduleError;
  onScheduleErrorChange: (value: ScheduleError) => void;
  studioOpen: boolean;
  studioAssets: StudioAsset[];
  onOpenStudio: () => void;
  onPickStudio: (asset: StudioAsset) => void;
  lastError: string | null;
};

const TYPE_TABS: Array<{ id: MediaType; label: string; icon: typeof ImagePlus }> = [
  { id: 'IMAGE', label: 'Image', icon: ImagePlus },
  { id: 'REELS', label: 'Reel', icon: Clapperboard },
  { id: 'CAROUSEL', label: 'Carousel', icon: Layers },
];

const ACCEPT: Record<MediaType, string> = {
  IMAGE: 'image/jpeg,image/png,image/webp',
  REELS: 'video/mp4,video/quicktime',
  CAROUSEL: 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime',
};

const FORMAT_HINT: Record<MediaType, string> = {
  IMAGE: 'JPG, PNG, WebP • Max 8 MB',
  REELS: 'MP4, MOV • Max 100 MB',
  CAROUSEL: 'JPG, PNG, WebP, MP4, MOV • 2–10 slides',
};

const UPLOAD_TITLE: Record<MediaType, string> = {
  IMAGE: 'Upload an image',
  REELS: 'Upload a video',
  CAROUSEL: 'Upload media',
};

const MIN_LEAD_MS = 10 * 60 * 1000;
const MAX_LEAD_MS = 75 * 24 * 60 * 60 * 1000;

export type ScheduleError = 'empty' | 'early' | 'late' | null;

function toLocalStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Returns 'early' | 'late' when out of the 10 min – 75 day window. */
function scheduleProblem(value: string): Exclude<ScheduleError, null | 'empty'> | null {
  const when = new Date(value).getTime();
  if (Number.isNaN(when)) return null;
  const delta = when - Date.now();
  if (delta < MIN_LEAD_MS) return 'early';
  if (delta > MAX_LEAD_MS) return 'late';
  return null;
}

export default function PostComposerTab({
  mediaType,
  onMediaTypeChange,
  feedRatio,
  onFeedRatioChange,
  canEdit,
  composerMode,
  saving,
  uploadState,
  previewUrl,
  videoUrl,
  mediaItems,
  onUploadFile,
  onRemoveSlide,
  onRemoveMedia,
  caption,
  onCaptionChange,
  scheduleLocal,
  onScheduleChange,
  scheduleError,
  onScheduleErrorChange,
  studioOpen,
  studioAssets,
  onOpenStudio,
  onPickStudio,
  lastError,
}: ComposerTabProps) {
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [captionBusy, setCaptionBusy] = useState<'polish' | 'generate' | null>(null);
  const [captionPrompt, setCaptionPrompt] = useState('');
  const sourceUrlRef = useRef('');
  const skipSourceRef = useRef(false);
  const uploading = Boolean(uploadState);
  const busy = saving || uploading;
  const editable = canEdit && composerMode && !uploading;
  const hashtagCount = countHashtags(caption);
  const hashTone =
    hashtagCount > HASHTAG_MAX ? 'over' : hashtagCount >= HASHTAG_MAX - 5 ? 'warn' : '';

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!editable) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onUploadFile(file, mediaType === 'CAROUSEL' ? 'carousel' : 'single');
  };

  const insertCaption = (next: string) => {
    onCaptionChange(next.slice(0, CAPTION_MAX));
    requestAnimationFrame(() => {
      captionRef.current?.focus();
    });
  };

  const runCaptionAi = async (mode: 'polish' | 'generate', text: string) => {
    const input = text.trim();
    if (mode === 'polish' && !input) {
      toastError('Write a caption first, then Magic can polish it.');
      return;
    }
    if (mode === 'generate' && !input) {
      toastError('Describe the post, then generate a caption.');
      return;
    }
    setCaptionBusy(mode);
    try {
      const { data } = await instagramApi.posts.captionAi({ mode, text: input });
      const next = data.data.caption.trim();
      if (!next) {
        toastError('Could not write that caption. Try again.');
        return;
      }
      insertCaption(next);
      if (mode === 'generate') setCaptionPrompt('');
    } catch (err) {
      toastError(getErrorMessage(err) || 'Could not write that caption.');
    } finally {
      setCaptionBusy(null);
    }
  };

  const onGenerateCaption = (event: FormEvent) => {
    event.preventDefault();
    void runCaptionAi('generate', captionPrompt);
  };

  const resolvedPreviewUrl = resolvePublicMediaUrl(previewUrl);
  const resolvedVideoUrl = resolvePublicMediaUrl(videoUrl);
  const [previewBroken, setPreviewBroken] = useState(false);
  useEffect(() => {
    setPreviewBroken(false);
  }, [resolvedPreviewUrl, resolvedVideoUrl, mediaType]);

  useEffect(() => {
    if (!resolvedPreviewUrl) {
      sourceUrlRef.current = '';
      skipSourceRef.current = false;
      return;
    }
    if (skipSourceRef.current) {
      skipSourceRef.current = false;
      return;
    }
    sourceUrlRef.current = resolvedPreviewUrl;
  }, [resolvedPreviewUrl]);

  const ratioValue = FEED_RATIOS.find((row) => row.id === feedRatio)?.value ?? 1;
  const frameRatio = mediaType === 'REELS' ? '9 / 16' : String(ratioValue);

  const applyRatio = async (next: FeedRatioId) => {
    onFeedRatioChange(next);
    const source = sourceUrlRef.current;
    if (!source || mediaType !== 'IMAGE' || !editable) return;
    const spec = FEED_RATIOS.find((row) => row.id === next);
    if (!spec) return;
    setCropping(true);
    try {
      const file = await cropImageToRatio(source, spec.value);
      skipSourceRef.current = true;
      onUploadFile(file, 'single');
    } catch (err) {
      skipSourceRef.current = false;
      toastError(err instanceof Error ? err.message : 'Could not crop this image.');
    } finally {
      setCropping(false);
    }
  };

  const hasSingleMedia =
    mediaType !== 'CAROUSEL' && Boolean(mediaType === 'REELS' ? resolvedVideoUrl : resolvedPreviewUrl);

  const presets: Array<{ label: string; offsetMs: number; value: string }> = [
    { label: 'In 1 hour', offsetMs: 60 * 60 * 1000, value: '' },
    { label: 'Tomorrow 9 AM', offsetMs: -1, value: '' },
    { label: 'Next week', offsetMs: 7 * 24 * 60 * 60 * 1000, value: '' },
  ];
  const tomorrowNine = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalStamp(d);
  })();
  const presetValues: string[] = [
    toLocalStamp(new Date(Date.now() + presets[0].offsetMs)),
    tomorrowNine,
    toLocalStamp(new Date(Date.now() + presets[2].offsetMs)),
  ];
  const isPresetActive = (value: string, offsetMs: number): boolean => {
    if (!scheduleLocal) return false;
    if (offsetMs === -1) return scheduleLocal === value;
    return Math.abs(new Date(scheduleLocal).getTime() - (Date.now() + offsetMs)) < 60 * 1000;
  };

  const handleScheduleInput = (value: string) => {
    onScheduleChange(value);
    if (!value) {
      onScheduleErrorChange(null);
      return;
    }
    const problem = scheduleProblem(value);
    onScheduleErrorChange(problem === 'early' ? 'early' : problem === 'late' ? 'late' : null);
  };

  return (
    <div>
      {!composerMode ? (
        <p className="igp-readonly">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {mediaType === 'IMAGE' ? 'Image' : mediaType === 'REELS' ? 'Reel' : 'Carousel'} posts are read-only
            after publishing. Update the caption automation or preview instead.
          </span>
        </p>
      ) : null}

      {!canEdit ? (
        <p className="igp-readonly">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Your role can view posts. Ask an OWNER, ADMIN or SUPERVISOR to create or publish.</span>
        </p>
      ) : null}

      <div className="igp-types" role="radiogroup" aria-label="Post type">
        {TYPE_TABS.map((row) => {
          const Icon = row.icon;
          const active = mediaType === row.id;
          return (
            <button
              key={row.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`igp-type ${active ? 'igp-type--on' : ''}`}
              disabled={!editable || busy}
              onClick={() => onMediaTypeChange(row.id)}
            >
              <Icon className="h-4 w-4" strokeWidth={2.1} />
              {row.label}
            </button>
          );
        })}
      </div>

      {/* Upload / preview */}
      <div className="igp-media-zone" aria-busy={uploading}>
        {uploadState ? <MediaUploadOverlay state={uploadState} /> : null}
        {hasSingleMedia && !uploading ? (
          <>
          <div className={`igp-drop igp-drop--has ${mediaType === 'REELS' ? 'igp-drop--reel' : ''}`}>
            <div className="igp-drop__canvas" style={{ aspectRatio: frameRatio }}>
              <button
                type="button"
                className="igp-drop__preview"
                onClick={() => setExpanded(true)}
                aria-label="Open larger preview"
              >
                {mediaType === 'REELS' && resolvedVideoUrl && !previewBroken ? (
                  <video
                    src={resolvedVideoUrl}
                    muted
                    playsInline
                    onError={() => setPreviewBroken(true)}
                  />
                ) : resolvedPreviewUrl && !previewBroken ? (
                  <img
                    src={resolvedPreviewUrl}
                    alt="Post media preview"
                    onError={() => setPreviewBroken(true)}
                  />
                ) : (
                  <div className="igp-drop__media-fallback">
                    <ImagePlus className="h-8 w-8 opacity-35" strokeWidth={1.5} />
                  </div>
                )}
              </button>

              <div className="igp-drop__tools">
                <button
                  type="button"
                  className="igp-drop__iconbtn"
                  onClick={() => setExpanded(true)}
                  aria-label="Enlarge preview"
                  title="Enlarge"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
                {editable ? (
                  <>
                    <label className="igp-drop__iconbtn" title="Replace">
                      <Replace className="h-3.5 w-3.5" />
                      <span className="sr-only">Replace</span>
                      <input
                        type="file"
                        accept={ACCEPT[mediaType]}
                        className="sr-only"
                        disabled={busy || cropping}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            sourceUrlRef.current = '';
                            skipSourceRef.current = false;
                            onFeedRatioChange('1:1');
                            onUploadFile(file, 'single');
                          }
                          event.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="igp-drop__iconbtn igp-drop__iconbtn--danger"
                      disabled={busy || cropping}
                      onClick={onRemoveMedia}
                      aria-label="Remove media"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>

              {mediaType === 'IMAGE' ? (
                <div className="igp-drop__ratios" role="radiogroup" aria-label="Instagram crop ratio">
                  {FEED_RATIOS.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      role="radio"
                      aria-checked={feedRatio === row.id}
                      title={`${row.hint} ${row.label}`}
                      className={`igp-drop__ratio ${feedRatio === row.id ? 'igp-drop__ratio--on' : ''}`}
                      disabled={!editable || busy || cropping}
                      onClick={(event) => {
                        event.stopPropagation();
                        void applyRatio(row.id);
                      }}
                    >
                      <i className={`igp-drop__ratio-shape igp-drop__ratio-shape--${row.id.replace(':', '-').replace('.', '')}`} />
                      <span>{row.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {cropping ? <span className="igp-drop__cropping">Cropping {feedRatio}</span> : null}
            </div>
          </div>
          {expanded ? (
            <div className="igp-lightbox" role="dialog" aria-label="Large media preview" onClick={() => setExpanded(false)}>
              <button type="button" className="igp-lightbox__close" onClick={() => setExpanded(false)} aria-label="Close preview">
                Close
              </button>
              <div className="igp-lightbox__frame" style={{ aspectRatio: frameRatio }} onClick={(event) => event.stopPropagation()}>
                {mediaType === 'REELS' && resolvedVideoUrl ? (
                  <video src={resolvedVideoUrl} controls muted playsInline />
                ) : resolvedPreviewUrl ? (
                  <img src={resolvedPreviewUrl} alt="Large post preview" />
                ) : null}
              </div>
            </div>
          ) : null}
          </>
        ) : !uploading ? (
          <div
            className={`igp-drop ${dragging ? 'igp-drop--drag' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (editable) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <span className="igp-drop__icon">
              <Upload className="h-5 w-5" strokeWidth={2} />
            </span>
            <p className="igp-drop__title">{UPLOAD_TITLE[mediaType]}</p>
            <p className="igp-drop__hint">{FORMAT_HINT[mediaType]}</p>
            {editable ? (
              <label className="igp-btn igp-btn--primary" style={{ height: 32 }}>
                Choose File
                <input
                  type="file"
                  accept={ACCEPT[mediaType]}
                  className="sr-only"
                  disabled={busy}
                  aria-label={UPLOAD_TITLE[mediaType]}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUploadFile(file, mediaType === 'CAROUSEL' ? 'carousel' : 'single');
                    event.target.value = '';
                  }}
                />
              </label>
            ) : (
              <span className="igp-drop__hint">Read-only</span>
            )}
          </div>
        ) : (
          <div className="igp-drop igp-drop--uploading" aria-hidden />
        )}
      </div>

      {/* Carousel slides */}
      {mediaType === 'CAROUSEL' ? (
        <div>
          <div className="igp-sublabel">
            <span>Slides</span>
            <span className="igp-sublabel__hint">
              {mediaItems.length}/{CAROUSEL_MAX}
            </span>
          </div>
          <div className="igp-slides">
            {mediaItems.map((item, index) => (
              <div key={`${item.url}-${index}`} className="igp-slide">
                {item.kind === 'video' ? (
                  <video src={item.url} muted playsInline />
                ) : (
                  <img src={item.url} alt={`Slide ${index + 1}`} />
                )}
                <span className="igp-slide__badge">
                  {item.kind === 'video' ? 'Video' : 'Image'}
                </span>
                {editable ? (
                  <button
                    type="button"
                    className="igp-slide__x"
                    onClick={() => onRemoveSlide(index)}
                    aria-label={`Remove slide ${index + 1}`}
                    disabled={busy}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            {editable && mediaItems.length < CAROUSEL_MAX ? (
              <label className="igp-slide igp-slide--add">
                <ImagePlus className="h-4 w-4" />
                Add slide
                <input
                  type="file"
                  accept={ACCEPT.CAROUSEL}
                  className="sr-only"
                  disabled={busy}
                  aria-label="Add carousel slide"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUploadFile(file, 'carousel');
                    event.target.value = '';
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* AI Studio picker (Image only) */}
      {mediaType === 'IMAGE' && editable ? (
        <button type="button" className="igp-detail__edit mt-3" onClick={onOpenStudio}>
          <Sparkles className="mr-1 inline h-3.5 w-3.5" />
          Use an image from AI Studio
        </button>
      ) : null}
      {mediaType === 'IMAGE' && studioOpen ? (
        <div className="igp-slides">
          {studioAssets.length === 0 ? (
            <p className="igp-drop__hint">
              No images yet. Generate one in AI Studio, then come back.
            </p>
          ) : (
            studioAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                className="igp-slide"
                onClick={() => onPickStudio(asset)}
                aria-label="Use this AI Studio image"
              >
                <img src={asset.publicUrl || ''} alt="" />
              </button>
            ))
          )}
        </div>
      ) : null}

      {/* Caption */}
      <div className="igp-sublabel">
        <label htmlFor="igp-caption">Caption</label>
        <div className="igp-sublabel__meta">
          {editable ? (
            <button
              type="button"
              className="igp-magic"
              disabled={Boolean(captionBusy) || busy}
              onClick={() => void runCaptionAi('polish', caption)}
              title="Polish this caption"
              aria-label="Magic: polish this caption"
            >
              {captionBusy === 'polish' ? (
                <Loader2 className="igp-magic__wand igp-magic__wand--spin" aria-hidden />
              ) : (
                <WandSparkles className="igp-magic__wand" aria-hidden />
              )}
              Magic
            </button>
          ) : null}
          {hashtagCount > 0 ? (
            <span className={`igp-sublabel__hint ${hashTone ? `igp-sublabel__hint--${hashTone}` : ''}`}>
              #{hashtagCount}/{HASHTAG_MAX}
            </span>
          ) : null}
          <span
            className={`igp-sublabel__hint ${caption.length > CAPTION_MAX ? 'igp-sublabel__hint--over' : ''}`}
          >
            {caption.length}/{CAPTION_MAX}
          </span>
        </div>
      </div>
      <textarea
        id="igp-caption"
        ref={captionRef}
        className="igp-caption"
        value={caption}
        maxLength={CAPTION_MAX}
        rows={5}
        disabled={!editable || Boolean(captionBusy)}
        placeholder="Write a caption…"
        onChange={(event) => onCaptionChange(event.target.value)}
      />
      {editable ? (
        <form className="igp-caption__gen" onSubmit={onGenerateCaption}>
          <input
            type="text"
            className="igp-caption__prompt"
            value={captionPrompt}
            maxLength={400}
            disabled={Boolean(captionBusy) || busy}
            placeholder="Describe the post, then generate a caption"
            aria-label="Caption prompt"
            onChange={(event) => setCaptionPrompt(event.target.value)}
          />
          <button
            type="submit"
            className="igp-caption__write"
            disabled={Boolean(captionBusy) || busy}
          >
            {captionBusy === 'generate' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
            Generate
          </button>
        </form>
      ) : null}

      {/* Schedule */}
      {composerMode ? (
        <div className="igp-sched">
          <div className="igp-sched__head">
            <span className="igp-sched__icon">
              <CalendarClock className="h-4 w-4" />
            </span>
            <div>
              <p className="igp-sched__title">Schedule (Optional)</p>
              <p className="igp-sched__hint">
                You can schedule your post from 10 minutes to 75 days ahead.
              </p>
            </div>
          </div>
          <div className="igp-sched__input">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <input
              type="datetime-local"
              value={scheduleLocal}
              disabled={!canEdit}
              aria-label="Schedule date and time"
              onChange={(event) => handleScheduleInput(event.target.value)}
            />
          </div>
          {canEdit ? (
            <div className="igp-sched__presets" role="group" aria-label="Quick schedule">
              {presets.map((preset, index) => {
                const presetValue = presetValues[index];
                const active = isPresetActive(presetValue, preset.offsetMs);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={`igp-sched__preset ${active ? 'igp-sched__preset--on' : ''}`}
                    onClick={() => {
                      onScheduleChange(presetValue);
                      onScheduleErrorChange(null);
                    }}
                  >
                    <Clock3 className="h-3 w-3" />
                    {preset.label}
                  </button>
                );
              })}
              {scheduleLocal ? (
                <button
                  type="button"
                  className="igp-sched__preset"
                  onClick={() => {
                    onScheduleChange('');
                    onScheduleErrorChange(null);
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
          {scheduleError === 'early' ? (
            <p className="igp-sched__warn">
              <AlertTriangle className="h-3.5 w-3.5" />
              Pick at least 10 minutes from now.
            </p>
          ) : null}
          {scheduleError === 'late' ? (
            <p className="igp-sched__warn igp-sched__warn--over">
              <AlertTriangle className="h-3.5 w-3.5" />
              Schedule at most 75 days ahead.
            </p>
          ) : null}
        </div>
      ) : null}

      {lastError ? (
        <p className="igp-error">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{lastError}</span>
        </p>
      ) : null}
    </div>
  );
}

function MediaUploadOverlay({ state }: { state: MediaUploadState }) {
  return (
    <div className="igp-upload-overlay" role="status" aria-live="polite">
      <div className="igp-upload">
        <span className="igp-upload__spinner" aria-hidden>
          <Loader2 className="h-7 w-7 animate-spin" />
        </span>
        <p className="igp-upload__title">{state.label}</p>
        <p className="igp-upload__file">{state.fileName}</p>
        <div className="igp-upload__track">
          <div className="igp-upload__bar" style={{ width: `${state.progress}%` }} />
        </div>
        <p className="igp-upload__pct">{state.progress}%</p>
        <p className="igp-upload__hint">Please wait — your preview will appear when upload finishes.</p>
      </div>
    </div>
  );
}
