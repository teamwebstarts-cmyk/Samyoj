import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Play, X } from 'lucide-react';

interface PreConnectVideoModalProps {
  open: boolean;
  title: string;
  videoUrl?: string;
  onClose: () => void;
}

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return null;
  }
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
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const embed = videoUrl ? toEmbedUrl(videoUrl) : null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 sm:px-5">
          <p className="truncate text-[14px] font-bold text-neutral-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
        {embed ? (
          <div className="aspect-video w-full bg-neutral-950">
            <iframe
              title={title}
              src={embed}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-10 text-center sm:px-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Play className="h-5 w-5" fill="currentColor" strokeWidth={0} />
            </span>
            <p className="mt-4 text-[15px] font-bold text-neutral-900">Video coming soon</p>
            <p className="mt-1.5 max-w-sm text-[13px] font-medium leading-relaxed text-neutral-500">
              We&apos;re preparing this walkthrough. Meanwhile, follow the setup guide to connect WhatsApp.
            </p>
            <Link
              to="/settings?tab=setup"
              onClick={onClose}
              className="mt-5 inline-flex items-center rounded-xl bg-whatsapp-600 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-whatsapp-700"
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
