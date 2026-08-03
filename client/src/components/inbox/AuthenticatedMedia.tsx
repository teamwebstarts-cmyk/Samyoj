import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Play } from 'lucide-react';
import api from '../../services/api';

/**
 * Session-level media URL cache. Prefers the cacheable URL from
 * GET /inbox/messages/:id/media-url; falls back to an authenticated blob
 * fetch (object URL) when the endpoint is missing or the URL has expired.
 */
const mediaCache = new Map<string, Promise<string>>();

async function resolveMediaUrl(messageId: string): Promise<string> {
  try {
    const { data } = await api.get(`/inbox/messages/${messageId}/media-url`);
    const url = (data?.data?.url ?? data?.url) as string | undefined;
    if (typeof url === 'string' && url) return url;
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

function useAuthenticatedMediaUrl(messageId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(messageId));
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!messageId) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    getMediaUrl(messageId)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [messageId, attempt]);

  const retry = useCallback(() => {
    if (messageId) evictMediaUrl(messageId);
    setAttempt((n) => n + 1);
  }, [messageId]);

  return { url, loading, error, retry };
}

function MediaError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 bg-[#f0f2f5] px-3 py-6 dark:bg-neutral-800">
      <span className="text-[12px] text-[#667781] dark:text-neutral-400">{label}</span>
      <button
        type="button"
        onClick={onRetry}
        className="text-[11px] font-bold text-[#008069] underline underline-offset-2"
      >
        Retry
      </button>
    </div>
  );
}

interface AuthenticatedImageProps {
  messageId: string;
  alt?: string;
  className?: string;
  onClick?: (url: string) => void;
}

export function AuthenticatedImage({ messageId, alt = 'Image', className = '', onClick }: AuthenticatedImageProps) {
  const { url, loading, error, retry } = useAuthenticatedMediaUrl(messageId);

  if (loading) {
    return (
      <div className={`flex min-h-[120px] items-center justify-center bg-[#f0f2f5] dark:bg-neutral-800 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-[#8696a0]" />
      </div>
    );
  }

  if (error || !url) {
    return <MediaError label="Image unavailable" onRetry={retry} />;
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(url)}
      className={`group relative block w-full cursor-zoom-in ${onClick ? '' : 'cursor-default'} ${className}`}
    >
      <img
        src={url}
        alt={alt}
        className="block max-h-72 w-full object-cover transition group-hover:brightness-95"
        loading="lazy"
        onError={() => {
          evictMediaUrl(messageId);
          retry();
        }}
      />
      {onClick && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/10">
          <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            View
          </span>
        </span>
      )}
    </button>
  );
}

interface AuthenticatedVideoProps {
  messageId: string;
  className?: string;
  onClick?: (url: string) => void;
}

export function AuthenticatedVideo({ messageId, className = '', onClick }: AuthenticatedVideoProps) {
  const { url, loading, error, retry } = useAuthenticatedMediaUrl(messageId);

  if (loading) {
    return (
      <div className={`flex min-h-[120px] items-center justify-center bg-[#111b21] ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-white/70" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={`bg-[#111b21] ${className}`}>
        <MediaError label="Video unavailable" onRetry={retry} />
      </div>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(url)}
        className={`group relative block w-full cursor-pointer ${className}`}
      >
        <video src={url} className="block max-h-72 w-full bg-black object-cover" preload="metadata" muted />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/40">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
            <Play className="h-6 w-6 fill-[#111b21] text-[#111b21]" />
          </span>
        </span>
      </button>
    );
  }

  return (
    <video src={url} controls className={`block max-h-72 w-full bg-black ${className}`} preload="metadata">
      <track kind="captions" />
    </video>
  );
}

interface AuthenticatedAudioProps {
  messageId: string;
  className?: string;
}

export function AuthenticatedAudio({ messageId, className = '' }: AuthenticatedAudioProps) {
  const { url, loading, error, retry } = useAuthenticatedMediaUrl(messageId);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-1 py-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-[#8696a0]" />
        <span className="text-[12px] text-[#667781]">Loading audio...</span>
      </div>
    );
  }

  if (error || !url) {
    return (
      <p className={`px-1 py-2 text-[12px] ${className}`}>
        <span className="text-[#667781]">Voice message unavailable · </span>
        <button type="button" onClick={retry} className="font-bold text-[#008069] underline underline-offset-2">
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
  className?: string;
  onClick?: (url: string) => void;
}

export function AuthenticatedDocument({ messageId, filename, className = '', onClick }: AuthenticatedDocumentProps) {
  const { url, loading, error, retry } = useAuthenticatedMediaUrl(messageId);

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
      disabled={loading || (!error && !url)}
      className={`flex w-full items-center gap-3 rounded-lg bg-[#f0f2f5]/80 px-3 py-2.5 text-left transition hover:bg-[#e9edef] disabled:cursor-not-allowed dark:bg-neutral-800/70 dark:hover:bg-neutral-800 ${className}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#008069] shadow-sm dark:bg-neutral-900">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-5 w-5" strokeWidth={2} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#111b21] dark:text-neutral-100">
          {filename || 'Document'}
        </p>
        <p className="text-[11px] text-[#667781] dark:text-neutral-400">
          {loading ? 'Loading...' : error ? 'Unavailable — tap to retry' : 'Tap to view'}
        </p>
      </div>
    </button>
  );
}
