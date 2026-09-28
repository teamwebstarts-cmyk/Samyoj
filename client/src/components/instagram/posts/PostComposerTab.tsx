import { useRef, useState, type DragEvent } from 'react';
import {
  AlertTriangle,
  AtSign,
  CalendarClock,
  Clapperboard,
  Clock3,
  ImagePlus,
  Info,
  Layers,
  Loader2,
  Replace,
  Sparkles,
  Trash2,
  Upload,
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

type StudioAsset = { id: string; publicUrl: string | null; prompt: string | null };

type ComposerTabProps = {
  mediaType: MediaType;
  onMediaTypeChange: (value: MediaType) => void;
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

  const insertAtCursor = (text: string) => {
    const field = captionRef.current;
    if (!field || !editable) return;
    const start = field.selectionStart ?? caption.length;
    const end = field.selectionEnd ?? caption.length;
    const next = `${caption.slice(0, start)}${text}${caption.slice(end)}`;
    onCaptionChange(next.slice(0, CAPTION_MAX));
    requestAnimationFrame(() => {
      field.focus();
      const caret = start + text.length;
      field.setSelectionRange(caret, caret);
    });
  };

  const hasSingleMedia = mediaType !== 'CAROUSEL' && Boolean(previewUrl);

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
          <div className="igp-drop igp-drop--has">
            <div className="igp-drop__preview">
              {mediaType === 'REELS' && videoUrl ? (
                <video src={videoUrl} controls muted playsInline />
              ) : (
                <img src={previewUrl} alt="Post media preview" />
              )}
              {editable ? (
                <div className="igp-drop__previewbar">
                  <label className="igp-drop__previewbtn">
                    <Replace className="h-3.5 w-3.5" />
                    Replace
                    <input
                      type="file"
                      accept={ACCEPT[mediaType]}
                      className="sr-only"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUploadFile(file, 'single');
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="igp-drop__previewbtn igp-drop__previewbtn--danger"
                    disabled={busy}
                    onClick={onRemoveMedia}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          </div>
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
        <span
          className={`igp-sublabel__hint ${caption.length > CAPTION_MAX ? 'igp-sublabel__hint--over' : ''}`}
        >
          {caption.length}/{CAPTION_MAX}
        </span>
      </div>
      <textarea
        id="igp-caption"
        ref={captionRef}
        className="igp-caption"
        value={caption}
        maxLength={CAPTION_MAX}
        rows={5}
        disabled={!editable}
        placeholder="Write a caption…"
        onChange={(event) => onCaptionChange(event.target.value)}
      />
      <div className="igp-caption__tools">
        <button
          type="button"
          className="igp-caption__tool"
          onClick={() => insertAtCursor('@')}
          disabled={!editable}
          aria-label="Insert mention"
          title="Insert mention"
        >
          <AtSign className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="igp-caption__tool"
          onClick={() => insertAtCursor('#')}
          disabled={!editable}
          aria-label="Insert hashtag"
          title="Insert hashtag"
        >
          #
        </button>
        {hashtagCount > 0 ? (
          <span
            className={`igp-caption__hashes ${
              hashTone ? `igp-caption__hashes--${hashTone}` : ''
            }`}
          >
            Hashtags {hashtagCount}/{HASHTAG_MAX}
          </span>
        ) : null}
      </div>

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
