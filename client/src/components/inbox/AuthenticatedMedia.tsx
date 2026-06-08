import { useEffect, useState } from 'react';
import { FileText, Loader2, Play } from 'lucide-react';
import api from '../../services/api';

function useAuthenticatedMediaUrl(messageId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(messageId));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!messageId) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    setLoading(true);
    setError(false);

    api
      .get(`/inbox/messages/${messageId}/media`, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [messageId]);

  return { url, loading, error };
}

interface AuthenticatedImageProps {
  messageId: string;
  alt?: string;
  className?: string;
  onClick?: (url: string) => void;
}

export function AuthenticatedImage({ messageId, alt = 'Image', className = '', onClick }: AuthenticatedImageProps) {
  const { url, loading, error } = useAuthenticatedMediaUrl(messageId);

  if (loading) {
    return (
      <div className={`flex min-h-[120px] items-center justify-center bg-[#f0f2f5] ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-[#8696a0]" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={`flex items-center justify-center bg-[#f0f2f5] px-3 py-6 text-[12px] text-[#667781] ${className}`}>
        Image unavailable
      </div>
    );
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
  const { url, loading, error } = useAuthenticatedMediaUrl(messageId);

  if (loading) {
    return (
      <div className={`flex min-h-[120px] items-center justify-center bg-[#111b21] ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-white/70" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={`flex items-center justify-center bg-[#111b21] px-3 py-8 text-[12px] text-white/70 ${className}`}>
        Video unavailable
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
  const { url, loading, error } = useAuthenticatedMediaUrl(messageId);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-1 py-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-[#8696a0]" />
        <span className="text-[12px] text-[#667781]">Loading audio...</span>
      </div>
    );
  }

  if (error || !url) {
    return <p className={`px-1 py-2 text-[12px] text-[#667781] ${className}`}>Voice message unavailable</p>;
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
  const { url, loading, error } = useAuthenticatedMediaUrl(messageId);

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
      onClick={handleOpen}
      disabled={loading || error || !url}
      className={`flex w-full items-center gap-3 rounded-lg bg-[#f0f2f5]/80 px-3 py-2.5 text-left transition hover:bg-[#e9edef] disabled:cursor-not-allowed ${className}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#008069] shadow-sm">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-5 w-5" strokeWidth={2} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#111b21]">
          {filename || 'Document'}
        </p>
        <p className="text-[11px] text-[#667781]">
          {loading ? 'Loading...' : error ? 'Unavailable' : 'Tap to view'}
        </p>
      </div>
    </button>
  );
}
