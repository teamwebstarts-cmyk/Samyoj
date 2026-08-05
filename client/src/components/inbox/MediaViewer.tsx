import { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGlassTipProps } from './ComposerGlassTip';
import { classifyDocumentPreview } from './documentPreview';

export interface MediaViewerItem {
  messageId: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
  url: string;
  filename?: string;
  mimeType?: string;
  /** Loop muted — GIF / short animation opened fullscreen */
  loopMuted?: boolean;
}

interface MediaViewerProps {
  item: MediaViewerItem | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

async function downloadMedia(url: string, filename?: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  }
}

function TextFilePreview({ url, filename }: { url: string; filename?: string }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setText(null);

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`preview ${res.status}`);
        const body = await res.text();
        // Cap huge docs in the viewer UI (download still gets full file).
        const MAX = 400_000;
        return body.length > MAX ? `${body.slice(0, MAX)}\n\n… truncated for preview — use Download for the full file.` : body;
      })
      .then((body) => {
        if (!cancelled) {
          setText(body);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] w-[min(92vw,720px)] items-center justify-center rounded-xl bg-white/10 text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || text == null) {
    return (
      <div className="rounded-xl bg-white/10 px-6 py-8 text-center text-white">
        <p className="text-sm">Could not preview this file.</p>
        <p className="mt-1 text-xs text-white/70">{filename || 'Document'}</p>
      </div>
    );
  }

  return (
    <div className="flex max-h-[80vh] w-[min(96vw,880px)] flex-col overflow-hidden rounded-xl bg-[#f8f9fa] shadow-2xl dark:bg-neutral-900">
      <div className="border-b border-black/5 px-4 py-2 text-[12px] font-medium text-neutral-600 dark:border-white/10 dark:text-neutral-300">
        {filename || 'Document'}
      </div>
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[12.5px] leading-relaxed text-neutral-800 dark:text-neutral-100">
        {text}
      </pre>
    </div>
  );
}

function DocumentPreview({
  url,
  filename,
  mimeType,
  onDownload,
}: {
  url: string;
  filename?: string;
  mimeType?: string;
  onDownload: () => void;
}) {
  const kind = classifyDocumentPreview(filename, mimeType);

  if (kind === 'pdf') {
    return (
      <iframe
        title={filename || 'PDF preview'}
        src={url}
        className="h-[80vh] w-[min(96vw,900px)] rounded-xl bg-white shadow-2xl"
      />
    );
  }

  if (kind === 'text') {
    return <TextFilePreview url={url} filename={filename} />;
  }

  if (kind === 'image') {
    return (
      <img
        src={url}
        alt={filename || 'Photo'}
        className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
    );
  }

  if (kind === 'audio') {
    return (
      <div className="flex w-[min(92vw,420px)] flex-col items-center gap-4 rounded-2xl bg-white/10 px-8 py-10 text-white">
        <p className="text-sm font-medium">{filename || 'Audio'}</p>
        <audio src={url} controls className="w-full" preload="metadata" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/10 px-8 py-10 text-white">
      <FileText className="h-10 w-10 text-white/80" strokeWidth={1.5} />
      <div className="text-center">
        <p className="text-lg font-medium">{filename || 'File'}</p>
        <p className="mt-1 max-w-sm text-[13px] text-white/70">
          Preview is not available for this file type. You can still download it.
        </p>
      </div>
      <button
        type="button"
        onClick={onDownload}
        className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold"
      >
        Download
      </button>
    </div>
  );
}

export default function MediaViewer({
  item,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: MediaViewerProps) {
  const tipFor = useGlassTipProps();
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!item) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev?.();
      if (e.key === 'ArrowRight' && hasNext) onNext?.();
    },
    [item, onClose, onPrev, onNext, hasPrev, hasNext]
  );

  useEffect(() => {
    if (!item) return;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [item, handleKeyDown]);

  if (!item) return null;

  const handleDownload = () => {
    void downloadMedia(item.url, item.filename);
  };

  const title =
    item.filename ||
    (item.type === 'IMAGE' ? 'Photo' : item.type === 'VIDEO' ? 'Video' : item.type === 'AUDIO' ? 'Audio' : 'Document');

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3">
        <div className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">{title}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Download"
            {...tipFor('Download', { placement: 'below', tone: 'onDark' })}
          >
            <Download size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
            {...tipFor('Close', { placement: 'below', tone: 'onDark' })}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {hasPrev && onPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
          aria-label="Previous"
          {...tipFor('Previous', { placement: 'right', tone: 'onDark' })}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {hasNext && onNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
          aria-label="Next"
          {...tipFor('Next', { placement: 'left', tone: 'onDark' })}
        >
          <ChevronRight size={24} />
        </button>
      )}

      <div
        className="flex max-h-[85vh] max-w-[95vw] items-center justify-center p-4 pt-14"
        onClick={(e) => e.stopPropagation()}
      >
        {item.type === 'IMAGE' && (
          <img
            src={item.url}
            alt={item.filename || 'Photo'}
            className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        )}
        {item.type === 'VIDEO' && (
          <video
            src={item.url}
            controls={!item.loopMuted}
            autoPlay
            muted={item.loopMuted}
            loop={item.loopMuted}
            playsInline
            className="max-h-[80vh] max-w-full rounded-lg bg-black shadow-2xl"
          >
            <track kind="captions" />
          </video>
        )}
        {item.type === 'AUDIO' && (
          <div className="flex w-[min(92vw,420px)] flex-col items-center gap-4 rounded-2xl bg-white/10 px-8 py-10 text-white">
            <p className="text-sm font-medium">{item.filename || 'Audio'}</p>
            <audio src={item.url} controls className="w-full" autoPlay preload="metadata" />
          </div>
        )}
        {item.type === 'DOCUMENT' && (
          <DocumentPreview
            url={item.url}
            filename={item.filename}
            mimeType={item.mimeType}
            onDownload={handleDownload}
          />
        )}
      </div>
    </div>
  );
}
