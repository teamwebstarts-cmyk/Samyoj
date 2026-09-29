import { useState } from 'react';
import {
  BadgeCheck,
  Bookmark,
  CalendarClock,
  Clapperboard,
  Eye,
  ExternalLink,
  Grid3x3,
  Heart,
  Home,
  ImagePlus,
  Layers,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  PlusSquare,
  Search,
  Send,
  Type as TypeIcon,
  User,
} from 'lucide-react';
import {
  extractHashtags,
  formatPostDate,
  statusLabel,
  statusModifier,
  type MediaType,
} from './types';
import { resolvePublicMediaUrl } from '../../../utils/publicMediaUrl';
import { FEED_RATIOS, type FeedRatioId } from './cropImage';

export type PreviewData = {
  mediaType: MediaType;
  previewUrl: string;
  caption: string;
  status: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  permalink?: string | null;
  mediaName?: string | null;
  mediaMeta?: string | null;
  feedRatio?: FeedRatioId;
  likes?: number | null;
  comments?: number | null;
  isRemote?: boolean;
};

type PreviewTabProps = {
  data: PreviewData;
  handle: string | null;
  canEdit: boolean;
  editablePost: boolean;
  gridItems: Array<{ id: string; url: string; active: boolean }>;
  automationConfigured: boolean;
  onEdit: () => void;
  onEditAutomation: () => void;
};

const TYPE_META: Record<MediaType, { label: string; icon: typeof ImagePlus }> = {
  IMAGE: { label: 'Image', icon: ImagePlus },
  REELS: { label: 'Reel', icon: Clapperboard },
  CAROUSEL: { label: 'Carousel', icon: Layers },
};

function timezoneLabel(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortOffset' }).formatToParts(new Date());
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
    return `${tz} (${offset})`;
  } catch {
    return '';
  }
}

function handleInitials(handle: string | null): string {
  const clean = (handle ?? 'IG').replace(/^@/, '');
  return clean.slice(0, 2).toUpperCase();
}

export default function PostPreviewTab({
  data,
  handle,
  canEdit,
  editablePost,
  gridItems,
  automationConfigured,
  onEdit,
  onEditAutomation,
}: PreviewTabProps) {
  const [view, setView] = useState<'feed' | 'grid'>('feed');
  const hashtags = extractHashtags(data.caption);
  const type = TYPE_META[data.mediaType];
  const previewUrl = resolvePublicMediaUrl(data.previewUrl);
  const resolvedGridItems = gridItems.map((item) => ({
    ...item,
    url: resolvePublicMediaUrl(item.url),
  }));
  const tz = timezoneLabel();
  const displayHandle = (handle ?? '@samyoj_business').replace(/^@/, '');
  const feedRatio = FEED_RATIOS.find((row) => row.id === data.feedRatio)?.value ?? 1;

  const scheduleText =
    data.status === 'SCHEDULED' && data.scheduledAt
      ? formatPostDate(data.scheduledAt)
      : data.status === 'PUBLISHED' && data.publishedAt
        ? formatPostDate(data.publishedAt)
        : null;

  const timeLine = (() => {
    if (data.status === 'SCHEDULED') return scheduleText ? `Scheduled for ${scheduleText}` : 'Scheduled';
    if (data.status === 'PUBLISHED') return scheduleText ?? 'Published';
    if (data.status === 'FAILED') return 'Not published yet';
    if (data.status === 'PROCESSING') return 'Publishing…';
    return 'Just now';
  })();

  return (
    <div className="igp-preview">
      <div className="igp-preview__head">
        <span className="igp-sched__icon">
          <Eye className="h-4 w-4" />
        </span>
        <div>
          <h3>Post Preview</h3>
          <p className="igp-preview__sub">Review how your post will look on Instagram</p>
        </div>
        <div className="igp-viewtoggle" role="tablist" aria-label="Preview mode">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'feed'}
            className={view === 'feed' ? 'on' : ''}
            onClick={() => setView('feed')}
            title="Feed view"
            aria-label="Feed view"
          >
            <Home className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'grid'}
            className={view === 'grid' ? 'on' : ''}
            onClick={() => setView('grid')}
            title="Grid view"
            aria-label="Grid view"
          >
            <Grid3x3 className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="igp-preview__cols">
        <div className="igp-preview__left">
          <div className="igp-phone-stage">
          {view === 'feed' ? (
            <div className="igp-phone" aria-label="Phone preview of the Instagram feed post">
              <div className="igp-phone__island" aria-hidden />
              <div className="igp-phone__status">
                <span>9:41</span>
                <span className="igp-phone__status-icons" aria-hidden>
                  <span className="igp-phone__signal" />
                  <span className="igp-phone__wifi" />
                  <span className="igp-phone__battery" />
                </span>
              </div>
              <div className="igp-phone__igbar">
                <span className="igp-phone__iglogo">Instagram</span>
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <div className="igp-phone__stories" aria-hidden>
                <span className="igp-story">
                  <span className="igp-story__ring">
                    <span className="igp-story__inner">{handleInitials(handle)}</span>
                  </span>
                  <span className="igp-story__label">Your story</span>
                </span>
                {['design studio', 'fashion', 'cafe'].map((label, index) => (
                  <span key={label} className="igp-story">
                    <span className="igp-story__ring">
                      <span
                        className="igp-story__inner"
                        style={{
                          background:
                            index === 0
                              ? 'linear-gradient(150deg,#fda4af,#c4b5fd)'
                              : index === 1
                                ? 'linear-gradient(150deg,#fcd34d,#fda4af)'
                                : 'linear-gradient(150deg,#a5b4fc,#67e8f9)',
                        }}
                      >
                        {label.slice(0, 1).toUpperCase()}
                      </span>
                    </span>
                    <span className="igp-story__label">{label}</span>
                  </span>
                ))}
              </div>
              <div className="igp-phone__posthead">
                <span className="igp-phone__avatar">{handleInitials(handle)}</span>
                <span className="igp-phone__handle">
                  <strong>
                    {displayHandle}
                    <BadgeCheck
                      className="ml-0.5 inline h-2.5 w-2.5 align-[-1px] text-[#3897f0]"
                      aria-label="Verified"
                    />
                  </strong>
                  <span>Sponsored</span>
                </span>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </div>
              <div
                className={`igp-phone__media ${data.mediaType === 'REELS' ? 'igp-phone__media--reel' : ''}`}
                style={data.mediaType === 'IMAGE' ? { aspectRatio: String(feedRatio) } : undefined}
              >
                {previewUrl ? (
                  data.mediaType === 'REELS' ? (
                    <video src={previewUrl} muted playsInline loop autoPlay />
                  ) : (
                    <img src={previewUrl} alt="" />
                  )
                ) : (
                  <span className="igp-phone__mediaempty">
                    <ImagePlus className="h-6 w-6" />
                    Your media appears here
                  </span>
                )}
                {data.mediaType === 'REELS' && previewUrl ? (
                  <span className="igp-phone__reelbadge">
                    <Clapperboard className="h-2.5 w-2.5" />
                    Reel
                  </span>
                ) : null}
                {data.mediaType === 'CAROUSEL' && previewUrl ? (
                  <span className="igp-phone__dots" aria-hidden>
                    <i className="on" />
                    <i />
                    <i />
                  </span>
                ) : null}
              </div>
              <div className="igp-phone__actions">
                <Heart className="h-4 w-4" />
                <MessageCircle className="h-4 w-4" />
                <Send className="h-4 w-4" />
                <Bookmark className="igp-phone__bookmark h-4 w-4" />
              </div>
              <div className="igp-phone__body">
                {typeof data.likes === 'number' || typeof data.comments === 'number' ? (
                  <p className="igp-phone__metrics">
                    <strong>{typeof data.likes === 'number' ? data.likes.toLocaleString() : '—'} likes</strong>
                    <span>{typeof data.comments === 'number' ? data.comments.toLocaleString() : '—'} comments</span>
                  </p>
                ) : null}
                <p className={`igp-phone__caption ${data.caption ? '' : 'igp-phone__caption--empty'}`}>
                  {data.caption ? (
                    <>
                      <strong>{displayHandle}</strong> {data.caption}
                    </>
                  ) : (
                    'Write a caption to preview it here.'
                  )}
                </p>
                <p className="igp-phone__time">{timeLine}</p>
              </div>
              <div className="igp-phone__nav" aria-hidden>
                <Home className="h-4 w-4" />
                <Search className="h-4 w-4" />
                <PlusSquare className="h-4 w-4" />
                <Clapperboard className="h-4 w-4" />
                <User className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <div className="igp-phone igp-phone--profile" aria-label="Profile grid preview">
              <div className="igp-phone__island" aria-hidden />
              <div className="igp-phone__status">
                <span>9:41</span>
                <span className="igp-phone__status-icons" aria-hidden>
                  <span className="igp-phone__signal" />
                  <span className="igp-phone__wifi" />
                  <span className="igp-phone__battery" />
                </span>
              </div>
              <div className="igp-phone__profile">
                <span className="igp-phone__avatar igp-phone__avatar--lg">{handleInitials(handle)}</span>
                <p className="igp-phone__profile-handle">{displayHandle}</p>
                <p className="igp-phone__profile-meta">Posts · Followers · Following</p>
              </div>
              <div className="igp-minigrid">
                {resolvedGridItems.slice(0, 9).map((item) => (
                  <span
                    key={item.id}
                    className={`igp-minigrid__cell ${item.active ? 'igp-minigrid__cell--on' : ''}`}
                  >
                    {item.url ? <img src={item.url} alt="" /> : null}
                  </span>
                ))}
                {Array.from({ length: Math.max(0, 9 - gridItems.length) }).map((_, index) => (
                  <span key={`empty-${index}`} className="igp-minigrid__cell igp-minigrid__cell--empty">
                    <PlusSquare className="h-3.5 w-3.5" />
                  </span>
                ))}
              </div>
              <div className="igp-phone__nav" aria-hidden>
                <Home className="h-4 w-4" />
                <Search className="h-4 w-4" />
                <PlusSquare className="h-4 w-4" />
                <Clapperboard className="h-4 w-4" />
                <User className="h-4 w-4" />
              </div>
            </div>
          )}
          </div>
        </div>

        <div className="igp-preview__right">
          {/* Post details */}
          <section className="igp-detail">
            <div className="igp-detail__head">
              <TypeIcon className="h-3.5 w-3.5 text-[var(--igp-muted)]" />
              <h4>Post Details</h4>
              {data.isRemote ? (
                <span className="igp-status igp-status--published igp-detail__status" style={{ marginLeft: 'auto' }}>
                  Live
                </span>
              ) : editablePost && canEdit ? (
                <button type="button" className="igp-detail__edit" onClick={onEdit}>
                  Edit
                </button>
              ) : null}
            </div>
            <div className="igp-detail__rows">
              <div className="igp-detail__row">
                <span className="igp-detail__label">
                  <type.icon className="h-3.5 w-3.5" />
                  Post type
                </span>
                <span className="igp-detail__value">{type.label}</span>
              </div>
              {data.status && !data.isRemote ? (
                <div className="igp-detail__row">
                  <span className="igp-detail__label">Status</span>
                  <span className="igp-detail__value">
                    <span className={`igp-status igp-status--${statusModifier(data.status)} igp-detail__status`}>
                      {statusLabel(data.status)}
                    </span>
                  </span>
                </div>
              ) : null}
              {data.mediaName || previewUrl ? (
                <div className="igp-detail__row">
                  <span className="igp-detail__label">Media</span>
                  <span className="igp-detail__value">
                    <span className="igp-detail__media">
                      <span className="igp-detail__mediathumb">
                        {previewUrl ? <img src={previewUrl} alt="" /> : null}
                      </span>
                      <span className="igp-detail__mediafile">
                        <strong>{data.mediaName || 'Media'}</strong>
                        {data.mediaMeta ? <span>{data.mediaMeta}</span> : null}
                      </span>
                    </span>
                  </span>
                </div>
              ) : null}
              {data.permalink ? (
                <div className="igp-detail__row">
                  <span className="igp-detail__label">Link</span>
                  <span className="igp-detail__value">
                    <a
                      href={data.permalink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-[var(--igp-accent)] hover:underline"
                    >
                      View on Instagram
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                </div>
              ) : null}
            </div>

            <p className={`igp-detail__caption ${data.caption ? '' : 'igp-detail__caption--empty'}`}>
              {data.caption || 'No caption yet.'}
            </p>
            {typeof data.likes === 'number' || typeof data.comments === 'number' ? (
              <div className="igp-live-metrics" aria-label="Instagram engagement">
                <span><Heart className="h-3.5 w-3.5" /> {typeof data.likes === 'number' ? data.likes.toLocaleString() : 'Stats unavailable'} likes</span>
                <span><MessageCircle className="h-3.5 w-3.5" /> {typeof data.comments === 'number' ? data.comments.toLocaleString() : 'Stats unavailable'} comments</span>
              </div>
            ) : null}
            <span className="igp-sublabel__hint" style={{ display: 'block', marginTop: 6, textAlign: 'right' }}>
              {data.caption.length}/2200
            </span>

            {hashtags.length > 0 ? (
              <>
                <p className="igp-detail__label" style={{ marginTop: 8 }}>
                  Hashtags ({hashtags.length})
                </p>
                <div className="igp-hashchips">
                  {hashtags.slice(0, 12).map((tag, index) => (
                    <span key={`${tag}-${index}`} className="igp-hashchip">
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          {/* Schedule */}
          {!data.isRemote ? (
            <section className="igp-detail">
              <div className="igp-detail__head">
                <CalendarClock className="h-3.5 w-3.5 text-[var(--igp-muted)]" />
                <h4>Schedule</h4>
                {editablePost && canEdit ? (
                  <button type="button" className="igp-detail__edit" onClick={onEdit}>
                    Edit
                  </button>
                ) : null}
              </div>
              <div className="igp-detail__rows">
                <div className="igp-detail__row">
                  <span className="igp-detail__label">Publish time</span>
                  <span className={`igp-detail__value ${scheduleText ? '' : 'igp-detail__value--muted'}`}>
                    {scheduleText ?? 'Not scheduled — publishes when you choose'}
                    {scheduleText && tz ? <span className="igp-tz">{tz}</span> : null}
                  </span>
                </div>
              </div>
            </section>
          ) : null}

          {/* Comment automation summary */}
          <section className="igp-detail">
            <div className="igp-detail__head">
              <MessageSquare className="h-3.5 w-3.5 text-[var(--igp-muted)]" />
              <h4>Comment Automation</h4>
              {canEdit ? (
                <button type="button" className="igp-detail__edit" onClick={onEditAutomation}>
                  Edit
                </button>
              ) : null}
            </div>
            <div className="igp-autosummary">
              <div className="igp-autosummary__row">
                <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[var(--igp-accent)]" aria-hidden />
                <strong className="igp-autosummary__title">Auto reply to comments</strong>
                <span
                  className={`igp-autosummary__state ${
                    automationConfigured ? 'igp-autosummary__state--on' : 'igp-autosummary__state--off'
                  }`}
                >
                  {automationConfigured ? 'Configured' : 'Not set up'}
                </span>
              </div>
              <p className="igp-autosummary__hint">
                Custom reply when someone comments on this post.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
