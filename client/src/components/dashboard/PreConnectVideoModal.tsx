import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Play, X } from 'lucide-react';
import { isDirectMediaUrl, toEmbedUrl } from '../../utils/preconnectVideos';

interface PreConnectVideoModalProps {
  open: boolean;
  title: string;
  videoUrl?: string;
  onClose: () => void;
}

export default function PreConnectVideoModal({
  open,
  title,
  videoUrl,
  onClose,
}: PreConnectVideoModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = videoUrl?.trim() || undefined;
  const direct = trimmed && isDirectMediaUrl(trimmed) ? trimmed : null;
  const embed = !direct && trimmed ? toEmbedUrl(trimmed) : null;
  const hasVideo = Boolean(direct || embed);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-neutral-200/90 bg-white shadow-xl sm:max-h-[90dvh] sm:max-w-xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-3 py-3 sm:px-5">
          <p className="min-w-0 flex-1 truncate pr-2 text-[13.5px] font-bold text-neutral-900 sm:text-[14px]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 sm:h-8 sm:w-8"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
        {hasVideo ? (
          <div className="aspect-video w-full bg-neutral-950">
            {direct ? (
              <video
                key={direct}
                src={direct}
                className="h-full w-full"
                controls
                autoPlay
                playsInline
                preload="metadata"
              />
            ) : (
              <iframe
                key={embed!}
                title={title}
                src={embed!}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-10 text-center sm:px-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm">
              <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />
            </span>
            <p className="mt-4 text-[15px] font-bold text-neutral-900">Watch introductory video</p>
            <p className="mt-1.5 max-w-sm text-[13px] font-medium leading-relaxed text-neutral-500">
              Meanwhile, follow the setup guide to connect WhatsApp and start messaging.
            </p>
            <Link
              to="/settings?tab=setup"
              onClick={onClose}
              className="mt-5 inline-flex items-center rounded-xl bg-[#25D366] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1ebe57]"
            >
              Open setup guide
            </Link>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
