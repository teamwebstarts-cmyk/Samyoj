import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Play } from 'lucide-react';
import api from '../../services/api';
import { resolveWaDocumentKind, waDocumentBadge, waDocumentTone } from './waDocumentChrome';

/**
 * Session-level media URL cache. Prefers the cacheable URL from
 * GET /inbox/messages/:id/media-url; falls back to an authenticated blob
 * fetch (object URL) when the endpoint is missing or the URL has expired.
 */
const mediaCache = new Map<string, Promise<string>>();

/**
 * Turn a signed media path/URL into a browser-safe src.
 * Relative `/api/...` loads via the Vite/nginx proxy (same origin as the SPA).
 * Absolute API hosts are rewritten to path-only unless VITE_API_ORIGIN is set
 * (split API deploy), in which case we prefix that origin.
 */
export function toBrowserMediaSrc(urlOrPath: string): string {
  let pathWithQuery: string;
  try {
    if (urlOrPath.startsWith('/')) {
      pathWithQuery = urlOrPath;
    } else {
      const parsed = new URL(urlOrPath);
      pathWithQuery = `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return urlOrPath;
  }

  const envOrigin = import.meta.env.VITE_API_ORIGIN;
  if (envOrigin && /^https?:\/\//i.test(envOrigin)) {
    return `${envOrigin.replace(/\/$/, '')}${pathWithQuery}`;
  }
  return pathWithQuery;
}

async function resolveMediaUrl(messageId: string): Promise<string> {
  try {
    const { data } = await api.get(`/inbox/messages/${messageId}/media-url`);
    const payload = (data?.data ?? data) as {
      path?: string;
      url?: string;
      absoluteUrl?: string;
    };
    const candidate =
      (typeof payload?.path === 'string' && payload.path) ||
      (typeof payload?.url === 'string' && payload.url) ||
      undefined;
    if (candidate) return toBrowserMediaSrc(candidate);
    throw new Error('media-url endpoint returned no url');
  } catch {
    const { data } = await api.get(`/inbox/messages/${messageId}/media`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(data);
  }
}

export function getMediaUrl(messageId: string): Promise<string> {
  let cached = mediaCache.get(messageId);
  if (!cached) {
    cached = resolveMediaUrl(messageId);
    mediaCache.set(messageId, cached);
    cached.catch(() => {
      mediaCache.delete(messageId);
    });
  }
  return cached;
}

export function evictMediaUrl(messageId: string) {
  mediaCache.delete(messageId);
}

const MAX_MEDIA_RETRIES = 1;

/**
 * Soft fade-in after decode. Tracks reveal per-URL so a reset effect cannot
 * wipe a successful cached load (common with signed media URLs).
 */
function useMediaReveal(url: string | null) {
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const revealed = Boolean(url && revealedUrl === url);

  const markRevealed = useCallback(() => {
    if (url) setRevealedUrl(url);
  }, [url]);

  const bindImg = useCallback(
    (el: HTMLImageElement | null) => {
      if (!el || !url) return;
      if (el.complete && el.naturalWidth > 0) setRevealedUrl(url);
    },
    [url]
  );

  const bindVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el || !url) return;
      if (el.readyState >= 2) setRevealedUrl(url);
    },
    [url]
  );

  return { revealed, markRevealed, bindImg, bindVideo };
}

function useAuthenticatedMediaUrl(messageId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    () => Boolean(messageId) && !mediaCache.has(messageId as string)
  );
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retriesRef = useRef(0);

  useEffect(() => {
    if (!messageId) {
      setUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    let timedOut = false;
    const hadCache = mediaCache.has(messageId);
    // Avoid spinner flash when URL is already warm / in-flight in session cache.
    if (!hadCache || attempt > 0) {
      setLoading(true);
    }
    setError(false);

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      timedOut = true;
      setError(true);
      setLoading(false);
    }, 20_000);

    getMediaUrl(messageId)
      .then((resolved) => {
        if (cancelled || timedOut) return;
        setUrl(resolved);
        setError(false);
      })
      .catch(() => {
        if (cancelled || timedOut) return;
        setError(true);
        setUrl(null);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [messageId, attempt]);

  const retry = useCallback(() => {
    if (!messageId) return;
    if (retriesRef.current >= MAX_MEDIA_RETRIES) {
      setUrl(null);
      setError(true);
      setLoading(false);
      return;
    }
    retriesRef.current += 1;
    evictMediaUrl(messageId);
    setUrl(null);
    setAttempt((n) => n + 1);
  }, [messageId]);

  const failSoft = useCallback(() => {
    // Used by <img>/<video> onError — one automatic retry max, then settle on error UI.
    if (!messageId) return;
    if (retriesRef.current >= MAX_MEDIA_RETRIES) {
      setUrl(null);
      setError(true);
      setLoading(false);
      return;
    }
    retriesRef.current += 1;
    evictMediaUrl(messageId);
    setUrl(null);
    setAttempt((n) => n + 1);
  }, [messageId]);

  // Reset retry budget when the message changes.
  useEffect(() => {
    retriesRef.current = 0;
  }, [messageId]);

  return { url, loading, error, retry, failSoft };
}

function MediaError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-1.5 bg-[#f0f2f5] px-3 py-6 dark:bg-neutral-800">
      <span className="text-[12px] text-chat-timestamp">{label}</span>
      <button
        type="button"
        onClick={onRetry}
        className="text-[11px] font-bold text-chat-accent underline underline-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

/**
 * Photo/video footprint. Prefer in-flow media (not only absolute children):
 * shrink-wrapped WhatsApp bubbles + `width: min(100%, …)` + absolute-only kids
 * collapse to ~8×8 (the “tiny View dot” bug). Stickers keep a fixed square.
 */
const VISUAL_SHELL =
  'relative block w-[280px] max-w-full min-w-[200px] shrink-0 overflow-hidden rounded-[6px] bg-[#f0f2f5] dark:bg-neutral-800';
const VISUAL_SHELL_STYLE = {
  aspectRatio: '4 / 3',
  maxHeight: 320,
  minHeight: 150,
} as const;
const STICKER_SHELL =
  'relative flex h-32 w-32 shrink-0 items-center justify-center overflow-visible rounded-[8px] bg-transparent';

interface AuthenticatedImageProps {
  messageId: string;
  alt?: string;
  className?: string;
  onClick?: (url: string) => void;
  /** Stickers: fixed square, no chrome, no layout thrash. */
  variant?: 'image' | 'sticker';
}

export function AuthenticatedImage({
  messageId,
  alt = 'Image',
  className = '',
  onClick,
  variant = 'image',
}: AuthenticatedImageProps) {
  const { url, loading, error, retry, failSoft } = useAuthenticatedMediaUrl(messageId);
  const { revealed, markRevealed, bindImg } = useMediaReveal(url);
  const isSticker = variant === 'sticker';

  if (isSticker) {
    return (
      <div className={`${STICKER_SHELL} ${className}`}>
        {loading && !url && <Loader2 className="h-5 w-5 animate-spin text-chat-tick" />}
        {error && !url && (
          <button type="button" onClick={retry} className="text-[11px] font-bold text-chat-accent underline">
            Retry
          </button>
        )}
        {url && !error && (
          <img
            ref={bindImg}
            src={url}
            alt={alt}
            className={`max-h-32 max-w-32 object-contain transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              revealed ? 'opacity-100' : 'opacity-0'
            }`}
            // Stickers are small — eager avoids “forever spinner” in virtualized lists.
            loading="eager"
            decoding="async"
            onLoad={markRevealed}
            onError={failSoft}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`${VISUAL_SHELL} ${className}`} style={VISUAL_SHELL_STYLE}>
      {(loading && !url) || (url && !revealed && !error) ? (
        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-chat-tick" />
        </div>
      ) : null}
      {error && !url && <MediaError label="Image unavailable" onRetry={retry} />}
      {url && !error && (
        <button
          type="button"
          onClick={() => onClick?.(url)}
          className={`relative block h-full w-full ${onClick ? 'cursor-zoom-in' : 'cursor-default'}`}
          aria-label={alt}
        >
          <img
            ref={bindImg}
            src={url}
            alt={alt}
            className={`block h-full w-full object-cover transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              revealed ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
            decoding="async"
            onLoad={markRevealed}
            onError={failSoft}
          />
          {onClick && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/bubble:bg-black/10 group-hover/bubble:opacity-100">
              <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium text-white">
                View
              </span>
            </span>
          )}
        </button>
      )}
    </div>
  );
}

interface AuthenticatedVideoProps {
  messageId: string;
  className?: string;
  onClick?: (url: string) => void;
  /**
   * `gif` — muted autoplay loop (WhatsApp-style), no play overlay remounts.
   * `video` — soft poster + play; stable shell (no duration-based mode switch).
   */
  variant?: 'video' | 'gif';
}

export function AuthenticatedVideo({
  messageId,
  className = '',
  onClick,
  variant = 'video',
}: AuthenticatedVideoProps) {
  const { url, loading, error, retry, failSoft } = useAuthenticatedMediaUrl(messageId);
  const { revealed, markRevealed, bindVideo } = useMediaReveal(url);
  const isGif = variant === 'gif';

  return (
    <div
      className={`${VISUAL_SHELL} ${isGif ? '' : 'bg-black dark:bg-black'} ${className}`}
      style={VISUAL_SHELL_STYLE}
    >
      {(loading && !url) || (url && !revealed && !error) ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2
            className={`h-5 w-5 animate-spin ${isGif ? 'text-chat-tick' : 'text-white/70'}`}
          />
        </div>
      ) : null}

      {error && !url && (
        <MediaError label={isGif ? 'GIF unavailable' : 'Video unavailable'} onRetry={retry} />
      )}

      {url && !error && isGif && (
        <button
          type="button"
          onClick={() => onClick?.(url)}
          className={`absolute inset-0 block ${onClick ? 'cursor-zoom-in' : 'cursor-default'}`}
          aria-label="Animated GIF"
        >
          <video
            ref={bindVideo}
            src={url}
            className={`h-full w-full object-contain transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              revealed ? 'opacity-100' : 'opacity-0'
            }`}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onLoadedData={markRevealed}
            onError={failSoft}
          />
          {onClick && (
            <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/90">
              GIF
            </span>
          )}
        </button>
      )}

      {url && !error && !isGif && onClick && (
        <button
          type="button"
          onClick={() => onClick(url)}
          className="group absolute inset-0 block cursor-pointer"
          aria-label="Play video"
        >
          <video
            ref={bindVideo}
            src={url}
            className={`h-full w-full object-cover transition-opacity duration-200 ease-out motion-reduce:transition-none ${
              revealed ? 'opacity-100' : 'opacity-0'
            }`}
            preload="metadata"
            muted
            playsInline
            onLoadedData={markRevealed}
            onError={failSoft}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/20 via-transparent to-transparent">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[#111b21] shadow-md ring-1 ring-black/5">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </span>
        </button>
      )}

      {url && !error && !isGif && !onClick && (
        <video
          ref={bindVideo}
          src={url}
          controls
          className={`absolute inset-0 h-full w-full bg-black object-contain transition-opacity duration-200 ease-out motion-reduce:transition-none ${
            revealed ? 'opacity-100' : 'opacity-0'
          }`}
          preload="metadata"
          playsInline
          onLoadedData={markRevealed}
          onError={failSoft}
        >
          <track kind="captions" />
        </video>
      )}
    </div>
  );
}

interface AuthenticatedAudioProps {
  messageId: string;
  className?: string;
}

export function AuthenticatedAudio({ messageId, className = '' }: AuthenticatedAudioProps) {
  const { url, loading, error, retry } = useAuthenticatedMediaUrl(messageId);

  if (loading && !url) {
    return (
      <div className={`flex items-center gap-2 px-1 py-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-chat-tick" />
        <span className="text-[12px] text-chat-timestamp">Loading audio...</span>
      </div>
    );
  }

  if (error || !url) {
    return (
      <p className={`px-1 py-2 text-[12px] ${className}`}>
        <span className="text-chat-timestamp">Voice message unavailable · </span>
        <button type="button" onClick={retry} className="font-bold text-chat-accent underline underline-offset-2">
          Retry
        </button>
      </p>
    );
  }

  return <audio src={url} controls className={`w-full min-w-[220px] ${className}`} preload="metadata" />;
}

interface AuthenticatedDocumentProps {
  messageId: string;
  filename?: string;
  mimeType?: string;
  sizeLabel?: string;
  className?: string;
  onClick?: (url: string) => void;
}

export function AuthenticatedDocument({
  messageId,
  filename,
  sizeLabel,
  className = '',
  onClick,
  mimeType,
}: AuthenticatedDocumentProps) {
  const { url, loading, error, retry } = useAuthenticatedMediaUrl(messageId);
  const kind = resolveWaDocumentKind(filename, mimeType);
  const badge = waDocumentBadge(kind, filename);

  const handleOpen = () => {
    if (!url) return;
    if (onClick) {
      onClick(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      type="button"
      onClick={error ? retry : handleOpen}
      disabled={(loading && !url) || (!error && !url && !loading)}
      className={`flex w-full items-center gap-3 rounded-lg bg-[#f0f2f5]/80 px-3 py-2.5 text-left transition hover:bg-[#e9edef] disabled:cursor-not-allowed dark:bg-neutral-800/70 dark:hover:bg-neutral-800 ${className}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm ${waDocumentTone(kind)}`}
      >
        {loading && !url ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-5 w-5" strokeWidth={2} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-chat-text">
          {filename || 'Document'}
        </p>
        <p className="text-[11px] text-chat-timestamp">
          {loading && !url
            ? 'Loading...'
            : error
              ? 'Unavailable — tap to retry'
              : [sizeLabel, badge].filter(Boolean).join(' · ') || 'Tap to preview'}
        </p>
      </div>
    </button>
  );
}
