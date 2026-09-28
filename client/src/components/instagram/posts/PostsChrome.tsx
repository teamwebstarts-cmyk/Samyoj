import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AtSign,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  ImagePlus,
  LayoutGrid,
  List,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Smartphone,
  Sparkles,
} from 'lucide-react';

type BannerProps = {
  connected: boolean | null;
  handle: string | null;
};

/** Instagram profile banner — connected / not connected / loading. */
export function PostBanner({ connected, handle }: BannerProps) {
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
          <h1 className="igp-banner__title">Instagram Posts</h1>
          {connected === true ? (
            <span className="igp-banner__badge">Connected</span>
          ) : isOff ? (
            <span className="igp-banner__badge igp-banner__badge--off">Not Connected</span>
          ) : null}
        </div>

        {handle ? (
          <p className="igp-banner__handle">
            <AtSign className="h-3.5 w-3.5" />
            {handleHref ? (
              <a href={handleHref} target="_blank" rel="noreferrer noopener">
                {handle.replace(/^@/, '')}
              </a>
            ) : (
              handle.replace(/^@/, '')
            )}
            <Send className="h-3 w-3 -rotate-45 opacity-60" />
            <BadgeCheck className="h-3.5 w-3.5 text-[#3897f0]" />
          </p>
        ) : null}

        <p className="igp-banner__copy">
          {isOff
            ? 'Connect your Instagram professional account to create, schedule and manage posts. You can also set up comment automation for each post.'
            : 'Create, schedule and manage your Instagram posts. You can also set up comment automation for each post.'}
        </p>
      </div>

      <div className="igp-banner__art" aria-hidden>
        <span className="igp-banner__plane">
          <Send className="h-5 w-5" strokeWidth={2} />
        </span>
        <span className="igp-spark igp-spark--a" />
        <span className="igp-spark igp-spark--b" />

        {isOff ? (
          <div className="igp-banner__card">
            <strong>Plan Content</strong>
            <span>Schedule posts</span>
          </div>
        ) : (
          <div className="igp-banner__card">
            <strong>Turn ideas into posts</strong>
            <span>Generate images in AI Studio</span>
            <Link className="igp-banner__cta" to="/content-studio">
              <Sparkles className="h-3 w-3" />
              Create with AI
            </Link>
          </div>
        )}

        {isOff ? (
          <div className="igp-banner__card">
            <strong>Grow Audience</strong>
            <span>Track engagement</span>
          </div>
        ) : (
          <div className="igp-banner__collage">
            <span className="igp-banner__tile">
              <ImagePlus className="h-5 w-5" />
            </span>
            <span className="igp-banner__tile">
              <Send className="h-5 w-5" />
            </span>
            <span className="igp-banner__tile">
              <Sparkles className="h-5 w-5" />
            </span>
          </div>
        )}
      </div>
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
  canEdit: boolean;
  onNewPost: () => void;
};

const STATS: Array<{ key: keyof PostCounts; label: string; icon: typeof FileText; tone: string }> = [
  { key: 'total', label: 'Total posts', icon: FileText, tone: 'pink' },
  { key: 'published', label: 'Published', icon: CheckCircle2, tone: 'green' },
  { key: 'scheduled', label: 'Scheduled', icon: Clock3, tone: 'blue' },
  { key: 'drafts', label: 'Drafts', icon: Pencil, tone: 'amber' },
  { key: 'failed', label: 'Failed', icon: AlertCircle, tone: 'rose' },
];

/** Five light KPI chips + primary page actions. Counts only — no invented trends. */
export function PostStatsRow({ counts, loading, canEdit, onNewPost }: StatsRowProps) {
  return (
    <div className="igp-stats">
      {STATS.map((row) => {
        const Icon = row.icon;
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
          <div key={row.key} className="igp-stat">
            <span className={`igp-stat__icon igp-stat__icon--${row.tone}`}>
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div>
              <p className="igp-stat__value">{counts[row.key]}</p>
              <p className="igp-stat__label">{row.label}</p>
            </div>
          </div>
        );
      })}

      <div className="igp-stats__actions">
        <Link to="/content-studio" className="igp-btn igp-btn--soft">
          <Sparkles className="h-3.5 w-3.5" />
          Generate in AI Studio
        </Link>
        {canEdit ? (
          <button type="button" className="igp-btn igp-btn--primary" onClick={onNewPost}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            New Post
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const POST_FILTERS = ['all', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'] as const;
export type PostFilterId = (typeof POST_FILTERS)[number];

const FILTER_LABELS: Record<PostFilterId, string> = {
  all: 'All',
  DRAFT: 'Drafts',
  SCHEDULED: 'Scheduled',
  PUBLISHED: 'Published',
  FAILED: 'Failed',
};

type PostFiltersProps = {
  filter: PostFilterId;
  onFilterChange: (value: PostFilterId) => void;
  counts: Record<PostFilterId, number>;
  query: string;
  onQueryChange: (value: string) => void;
  view: 'grid' | 'list';
  onViewChange: (value: 'grid' | 'list') => void;
  canEdit: boolean;
};

/** Status chips + search + grid/list toggle. Search runs on loaded rows only. */
export function PostFilters({
  filter,
  onFilterChange,
  counts,
  query,
  onQueryChange,
  view,
  onViewChange,
  canEdit,
}: PostFiltersProps) {
  return (
    <div className="igp-filters">
      <div className="igp-filters__chips" role="tablist" aria-label="Filter posts by status">
        {POST_FILTERS.map((id) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`igp-chip ${active ? 'igp-chip--on' : ''}`}
              onClick={() => onFilterChange(id)}
            >
              {FILTER_LABELS[id]}
              <span className="igp-chip__count">{counts[id]}</span>
            </button>
          );
        })}
      </div>

      <div className="igp-filters__tools">
        <label className="sr-only" htmlFor="igp-search">
          Search posts by caption
        </label>
        <input
          id="igp-search"
          className="igp-search"
          type="search"
          placeholder="Search captions…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <button
          type="button"
          className={`igp-iconbtn ${view === 'grid' ? 'igp-iconbtn--on' : ''}`}
          onClick={() => onViewChange('grid')}
          aria-label="Grid view"
          aria-pressed={view === 'grid'}
          title="Grid view"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`igp-iconbtn ${view === 'list' ? 'igp-iconbtn--on' : ''}`}
          onClick={() => onViewChange('list')}
          aria-label="List view"
          aria-pressed={view === 'list'}
          title="List view"
        >
          <List className="h-4 w-4" />
        </button>
        {!canEdit ? (
          <span className="igp-kind" title="View-only access">
            <Lock className="h-3 w-3" />
            View only
          </span>
        ) : null}
      </div>
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
