import {
  CalendarClock,
  Clapperboard,
  Heart,
  ImagePlus,
  MessageCircle,
  MessageSquare,
  Plus,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { resolvePublicMediaUrl } from '../../../utils/publicMediaUrl';
import InstagramGlyph from '../../dashboard/icons/InstagramGlyph';
import {
  postDisplayDate,
  statusLabel,
  statusModifier,
  type LibraryItem,
  type PostRow,
} from './types';

type GridProps = {
  posts: PostRow[];
  loading: boolean;
  selectedId: string | null;
  onOpen: (post: PostRow) => void;
  query: string;
  onClearQuery: () => void;
};

function tileThumb(post: PostRow): string {
  const raw =
    post.mediaType === 'REELS' && post.mediaPayload[0]?.url
      ? post.mediaPayload[0].url
      : post.imageUrl || post.mediaPayload.find((item) => item.kind === 'image')?.url || '';
  return resolvePublicMediaUrl(raw);
}

function metric(value: number | null | undefined): string {
  if (typeof value !== 'number') return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

/** Skeleton tiles shown while the first page of posts loads. */
function GridSkeleton() {
  return (
    <div className="igp-grid" aria-busy="true" aria-label="Loading posts">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="igp-tile igp-tile--skeleton">
          <span className="igp-tile__frame" />
          <span className="igp-tile__meta" />
        </div>
      ))}
    </div>
  );
}

/** Empty state — connected, zero Samyoj posts. Mirrors the reference design. */
export function PostsZeroState({ canEdit, onNewPost }: { canEdit: boolean; onNewPost: () => void }) {
  return (
    <section className="igp-zero">
      <div className="igp-zero__art" aria-hidden>
        <span className="igp-zero__card igp-zero__card--left">
          <ImagePlus className="h-7 w-7" strokeWidth={1.6} />
        </span>
        <span className="igp-zero__card igp-zero__card--right">
          <Clapperboard className="h-7 w-7" strokeWidth={1.6} />
        </span>
        <div className="igp-zero__center">
          <span className="igp-zero__mark">
            <ImagePlus className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="igp-zero__dashed">
            <Plus className="h-6 w-6" strokeWidth={2.2} />
          </span>
        </div>
        <span className="igp-zero__plane">
          <Sparkles className="h-5 w-5" />
        </span>
      </div>

      <h2 className="igp-zero__title">No posts yet</h2>
      <p className="igp-zero__desc">
        Create your first Instagram post to engage with your audience, schedule content and set up comment automation.
      </p>

      <div className="igp-zero__actions">
        {canEdit ? (
          <button type="button" className="igp-btn igp-btn--primary igp-btn--lg" onClick={onNewPost}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Create Your First Post
          </button>
        ) : null}
        <Link to="/content-studio" className={`igp-btn igp-btn--outline igp-btn--lg ${canEdit ? '' : 'ml-0'}`}>
          <Wand2 className="h-4 w-4" />
          Generate in AI Studio
        </Link>
      </div>

      <div className="igp-explore">
        <span className="igp-explore__label">Or explore</span>
      </div>
      <div className="igp-explore__grid">
        <div className="igp-explore__card">
          <span className="igp-explore__icon igp-explore__icon--pink">
            <CalendarClock className="h-4 w-4" />
          </span>
          <span>
            <strong>Plan Ahead</strong>
            <span>Schedule posts for the best time.</span>
          </span>
        </div>
        <div className="igp-explore__card">
          <span className="igp-explore__icon igp-explore__icon--violet">
            <Wand2 className="h-4 w-4" />
          </span>
          <span>
            <strong>Save Time</strong>
            <span>Use AI Studio to create content.</span>
          </span>
        </div>
        <div className="igp-explore__card">
          <span className="igp-explore__icon igp-explore__icon--amber">
            <MessageSquare className="h-4 w-4" />
          </span>
          <span>
            <strong>Automate Replies</strong>
            <span>Set up comment automation for each post.</span>
          </span>
        </div>
      </div>
    </section>
  );
}

/** Grid / list of Samyoj-managed posts, with skeletons and filtered-empty note. */
export function PostsGrid({
  posts,
  loading,
  selectedId,
  onOpen,
  query,
  onClearQuery,
}: GridProps) {
  if (loading) return <GridSkeleton />;

  if (posts.length === 0 && query.trim()) {
    return (
      <div className="igp-grid">
        <p className="igp-emptynote">
          No posts match “{query.trim()}”.{' '}
          <button
            type="button"
            className="font-bold text-[var(--igp-accent)] underline"
            onClick={onClearQuery}
          >
            Clear search
          </button>
        </p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="igp-grid">
        <p className="igp-emptynote">No posts with this status yet.</p>
      </div>
    );
  }

  return (
    <div className="igp-grid">
      {posts.map((post) => {
        const date = postDisplayDate(post);
        const thumb = tileThumb(post);
        return (
          <button
            key={post.id}
            type="button"
            className={`igp-tile ${selectedId === post.id ? 'igp-tile--on' : ''}`}
            onClick={() => onOpen(post)}
            aria-label={`${statusLabel(post.status)} post${date ? `, ${date}` : ''}`}
          >
            <span className="igp-tile__frame">
              {thumb ? (
                <img src={thumb} alt="" loading="lazy" />
              ) : (
                <span className="igp-tile__media-fallback" aria-hidden>
                  <ImagePlus className="h-8 w-8 opacity-40" strokeWidth={1.5} />
                </span>
              )}
              <span className={`igp-status igp-status--${statusModifier(post.status)}`}>
                {statusLabel(post.status)}
              </span>
              <span className="igp-igbadge" aria-hidden>
                <InstagramGlyph className="h-3 w-3" />
              </span>
            </span>
            <span className="igp-tile__meta">
              <span className="igp-tile__date">
                <CalendarClock className="h-3 w-3 shrink-0" />
                {date ?? '—'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

type LibraryProps = {
  items: LibraryItem[];
  loading: boolean;
  error?: boolean;
  selectedId: string | null;
  onOpen: (item: LibraryItem) => void;
  onRefresh: () => void;
  emptyNote?: string;
};

/** Recent media from the connected account — automation only, never re-published. */
export function PostsLibrary({ items, loading, error, selectedId, onOpen, onRefresh, emptyNote }: LibraryProps) {
  return (
    <section className="igp-lib">
      <div className="igp-lib__head">
        <div>
          <h2 className="igp-lib__title">
            <ImagePlus className="h-4 w-4" strokeWidth={2.2} />
            Already on Instagram
          </h2>
          <p className="igp-lib__desc">
            Pick a live post to set comment and DM automation without re-publishing it.
          </p>
        </div>
        <button
          type="button"
          className="igp-btn igp-btn--outline"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="igp-lib__grid" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <span key={index} className="igp-lib__skeleton" />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <p className="igp-emptynote" role="status">
          Could not load your live posts.{' '}
          <button type="button" className="font-bold text-[var(--igp-accent)] underline" onClick={onRefresh}>
            Try again
          </button>
        </p>
      ) : items.length === 0 ? (
        <p className="igp-emptynote">{emptyNote || 'No live posts found on this account yet.'}</p>
      ) : (
        <div className="igp-lib__grid">
          {items.map((item) => (
            <button
              key={item.igMediaId}
              type="button"
              className={`igp-lib__tile ${
                selectedId === `remote:${item.igMediaId}` ? 'igp-lib__tile--on' : ''
              }`}
              onClick={() => onOpen(item)}
              aria-label={`Open live Instagram post${item.caption ? `: ${item.caption}` : ''}. ${metric(item.likes)} likes, ${metric(item.comments)} comments`}
            >
              <img src={resolvePublicMediaUrl(item.thumbnailUrl)} alt="" loading="lazy" />
              <span className="igp-lib__live">Live</span>
              <span className="igp-lib__ig" aria-hidden>
                <InstagramGlyph className="h-3 w-3" />
              </span>
              <span className="igp-lib__metrics" aria-label={`${metric(item.likes)} likes, ${metric(item.comments)} comments`}>
                <span><Heart className="h-3 w-3" /> {metric(item.likes)}</span>
                <span><MessageCircle className="h-3 w-3" /> {metric(item.comments)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
