import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  ImagePlus,
  Instagram,
  Layers,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Smartphone,
  Sparkles,
} from 'lucide-react';

type BannerProps = {
  connected: boolean | null;
  handle: string | null;
  canEdit?: boolean;
  onNewPost?: () => void;
};

/** Instagram profile banner — connected / not connected / loading. */
export function PostBanner({ connected, handle, canEdit = false, onNewPost }: BannerProps) {
  const isOff = connected === false;
  const handleHref =
    handle && handle.startsWith('@') ? `https://www.instagram.com/${handle.slice(1)}/` : null;

  return (
    <section className="igp-banner" aria-label="Instagram account">
      <span className="igp-banner__mark" aria-hidden>
        <Send className="h-6 w-6" strokeWidth={2} />
      </span>

      <div className="igp-banner__main">
        <div className="igp-banner__titlerow">
          <h1 className="igp-banner__title">
            {handle ? (
              handleHref ? (
                <a href={handleHref} target="_blank" rel="noreferrer noopener" className="hover:underline">
                  {handle}
                </a>
              ) : (
                handle
              )
            ) : (
              'Instagram Posts'
            )}
          </h1>
          {connected === true ? (
            <span className="igp-banner__badge">Connected</span>
          ) : isOff ? (
            <span className="igp-banner__badge igp-banner__badge--off">Not Connected</span>
          ) : null}
        </div>

        <p className="igp-banner__copy">
          {isOff
            ? 'Connect your Instagram professional account to create, schedule and manage posts. You can also set up comment automation for each post.'
            : 'Create, schedule and manage your Instagram posts. You can also set up comment automation for each post.'}
        </p>
      </div>

      {connected !== false ? (
        <div className="igp-banner__actions">
          <Link to="/content-studio" className="igp-btn igp-btn--soft">
            <Sparkles className="h-3.5 w-3.5" />
            Generate in AI Studio
          </Link>
          {canEdit && onNewPost ? (
            <button type="button" className="igp-btn igp-btn--primary" onClick={onNewPost}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New Post
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export type PostCounts = {
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
  failed: number;
};

type StatsRowProps = {
  counts: PostCounts;
  loading: boolean;
  filter: PostFilterId | null;
  onFilterChange: (value: PostFilterId) => void;
};

const STATS: Array<{
  key: keyof PostCounts;
  filter: PostFilterId;
  label: string;
  icon: typeof FileText;
  tone: string;
}> = [
  { key: 'total', filter: 'all', label: 'Total posts', icon: FileText, tone: 'pink' },
  { key: 'published', filter: 'PUBLISHED', label: 'Published', icon: CheckCircle2, tone: 'green' },
  { key: 'scheduled', filter: 'SCHEDULED', label: 'Scheduled', icon: Clock3, tone: 'blue' },
  { key: 'failed', filter: 'FAILED', label: 'Failed', icon: AlertCircle, tone: 'rose' },
];

/** Status cards. Clicking one filters the All posts grid. */
export function PostStatsRow({ counts, loading, filter, onFilterChange }: StatsRowProps) {
  return (
    <div className="igp-stats" role="tablist" aria-label="Filter posts by status">
      {STATS.map((row) => {
        const Icon = row.icon;
        const selected = filter === row.filter;
        if (loading) {
          return (
            <div key={row.key} className="igp-stat igp-stat--skeleton" aria-hidden>
              <span className={`igp-stat__icon igp-stat__icon--${row.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <span className="igp-stat__value">00</span>
                <span className="igp-stat__label">{row.label}</span>
              </div>
            </div>
          );
        }
        return (
          <button
            key={row.key}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`igp-stat ${selected ? 'igp-stat--on' : ''}`}
            onClick={() => onFilterChange(row.filter)}
          >
            <span className={`igp-stat__icon igp-stat__icon--${row.tone}`}>
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div>
              <p className="igp-stat__value">{counts[row.key]}</p>
              <p className="igp-stat__label">{row.label}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const POST_FILTERS = ['all', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'] as const;
export type PostFilterId = (typeof POST_FILTERS)[number];

export type PostFeedTab = 'posts' | 'live';

type PostFeedBarProps = {
  tab: PostFeedTab;
  onTabChange: (value: PostFeedTab) => void;
  postsCount: number;
  liveCount: number;
  canEdit: boolean;
};

/** Samyoj-managed posts vs media already live on Instagram. */
export function PostFeedBar({
  tab,
  onTabChange,
  postsCount,
  liveCount,
  canEdit,
}: PostFeedBarProps) {
  return (
    <div className="igp-filters">
      <div className="igp-source" role="tablist" aria-label="Post source">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'posts'}
          className={`igp-source__tab ${tab === 'posts' ? 'is-on' : ''}`}
          onClick={() => onTabChange('posts')}
        >
          <span className="igp-source__icon igp-source__icon--samyoj" aria-hidden="true">
            <Layers className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <span className="igp-source__body">
            <strong>Samyoj posts</strong>
            <small>Create, schedule &amp; publish here</small>
          </span>
          <span className="igp-source__count" aria-label={`${postsCount} Samyoj posts`}>
            {postsCount}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'live'}
          className={`igp-source__tab ${tab === 'live' ? 'is-on' : ''}`}
          onClick={() => onTabChange('live')}
        >
          <span className="igp-source__icon igp-source__icon--ig" aria-hidden="true">
            <Instagram className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <span className="igp-source__body">
            <strong>On Instagram</strong>
            <small>Live on your connected account</small>
          </span>
          <span className="igp-source__count" aria-label={`${liveCount} live posts`}>
            {liveCount}
          </span>
        </button>
      </div>

      {!canEdit ? (
        <div className="igp-filters__tools">
          <span className="igp-kind" title="View-only access">
            <Lock className="h-3 w-3" />
            View only
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Small helper used by the connect screen benefit list. */
export const POST_CONNECT_BENEFITS = [
  {
    icon: Send,
    tone: 'pink' as const,
    title: 'Manage all your Instagram posts',
    body: 'Create, schedule and publish from Samyoj.',
  },
  {
    icon: MessageSquare,
    tone: 'violet' as const,
    title: 'Set up comment automation',
    body: 'Automatically reply to comments on your posts.',
  },
  {
    icon: Smartphone,
    tone: 'amber' as const,
    title: 'Preview before you publish',
    body: 'See exactly how your post will look on a phone.',
  },
];

export const POST_AFTER_CONNECT = [
  { icon: ImagePlus, tone: 'pink' as const, title: 'Create & Schedule Posts', body: 'Image, Reel or Carousel' },
  { icon: Sparkles, tone: 'violet' as const, title: 'Use AI Studio', body: 'Generate images and ideas' },
  { icon: MessageSquare, tone: 'amber' as const, title: 'Automate Comments', body: 'Set auto replies for each post' },
  { icon: CalendarClock, tone: 'green' as const, title: 'Already on Instagram', body: 'Automate replies on live posts' },
];
