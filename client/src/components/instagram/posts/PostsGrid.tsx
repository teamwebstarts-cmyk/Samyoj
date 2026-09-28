import { CalendarClock, Clapperboard, ImagePlus, Layers, MessageSquare, Plus, Sparkles, Wand2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  postDisplayDate,
  statusLabel,
  statusModifier,
  type LibraryItem,
  type MediaType,
  type PostRow,
} from './types';

type GridProps = {
  posts: PostRow[];
  loading: boolean;
  selectedId: string | null;
  onOpen: (post: PostRow) => void;
  view: 'grid' | 'list';
  query: string;
  onClearQuery: () => void;
};

const KIND_META: Partial<Record<MediaType, { label: string; icon: typeof Clapperboard }>> = {
  REELS: { label: 'Reel', icon: Clapperboard },
  CAROUSEL: { label: 'Carousel', icon: Layers },
};

function tileThumb(post: PostRow): string {
  if (post.mediaType === 'REELS' && post.mediaPayload[0]?.kind === 'video') {
    return post.imageUrl;
  }
  return post.imageUrl;
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
  view,
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

  if (view === 'list') {
    return (
      <div className="igp-list">
        {posts.map((post) => {
          const date = postDisplayDate(post);
          const kind = KIND_META[post.mediaType];
          return (
            <button
              key={post.id}
              type="button"
              className={`igp-rowitem ${selectedId === post.id ? 'igp-rowitem--on' : ''}`}
              onClick={() => onOpen(post)}
            >
              <span className="igp-rowitem__thumb">
                <img src={tileThumb(post)} alt="" loading="lazy" />
              </span>
              <span className="igp-rowitem__main">
                <span className={`igp-rowitem__caption ${post.caption ? '' : 'igp-rowitem__caption--empty'}`}>
                  {post.caption || 'No caption yet'}
                </span>
                <span className="igp-rowitem__sub">
                  {date ? (
                    <>
                      <CalendarClock className="h-3 w-3" />
                      {date}
                    </>
                  ) : null}
                  {kind ? (
                    <span className="igp-kind">
                      <kind.icon className="h-3 w-3" />
                      {kind.label}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className={`igp-status igp-status--${statusModifier(post.status)} igp-rowitem__status`}>
                {statusLabel(post.status)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="igp-grid">
      {posts.map((post) => {
        const date = postDisplayDate(post);
        return (
          <button
            key={post.id}
            type="button"
            className={`igp-tile ${selectedId === post.id ? 'igp-tile--on' : ''}`}
            onClick={() => onOpen(post)}
            aria-label={`${statusLabel(post.status)} post${date ? `, ${date}` : ''}`}
          >
            <span className="igp-tile__frame">
              <img src={tileThumb(post)} alt="" loading="lazy" />
              <span className={`igp-status igp-status--${statusModifier(post.status)}`}>
                {statusLabel(post.status)}
              </span>
              <span className="igp-igbadge" aria-hidden>
                <ImagePlus className="h-3 w-3" strokeWidth={2.4} />
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
};

/** Recent media from the connected account — automation only, never re-published. */
export function PostsLibrary({ items, loading, error, selectedId, onOpen, onRefresh }: LibraryProps) {
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
        <p className="igp-emptynote">No live posts found on this account yet.</p>
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
              aria-label="Open live Instagram post"
            >
              <img src={item.thumbnailUrl} alt="" loading="lazy" />
              <span className="igp-lib__live">Live</span>
              <span className="igp-lib__ig" aria-hidden>
                <ImagePlus className="h-3 w-3" strokeWidth={2.4} />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
