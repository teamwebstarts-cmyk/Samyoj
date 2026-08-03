import { useEffect, useCallback } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGlassTipProps } from './ComposerGlassTip';

export interface MediaViewerItem {
  messageId: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
  url: string;
  filename?: string;
}

interface MediaViewerProps {
  item: MediaViewerItem | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
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
    const link = document.createElement('a');
    link.href = item.url;
    link.download = item.filename || 'download';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-3">
        <div className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
          {item.filename || (item.type === 'IMAGE' ? 'Photo' : item.type === 'VIDEO' ? 'Video' : 'Document')}
        </div>
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
            controls
            autoPlay
            className="max-h-[80vh] max-w-full rounded-lg bg-black shadow-2xl"
          >
            <track kind="captions" />
          </video>
        )}
        {(item.type === 'DOCUMENT' || item.type === 'AUDIO') && (
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/10 px-8 py-10 text-white">
            <p className="text-lg font-medium">{item.filename || 'File'}</p>
            <button
              type="button"
              onClick={handleDownload}
              className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold"
            >
              Open / Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
