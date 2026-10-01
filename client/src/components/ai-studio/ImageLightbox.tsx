import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

interface Props {
  url: string | null;
  urls?: string[];
  title?: string;
  onClose: () => void;
  onChange?: (url: string, index: number) => void;
}

export function ImageLightbox({ url, urls, title, onClose, onChange }: Props) {
  const list = useMemo(() => {
    const unique = urls?.filter(Boolean) ?? [];
    if (url && !unique.includes(url)) return [url, ...unique];
    return unique.length ? unique : url ? [url] : [];
  }, [url, urls]);

  const open = Boolean(url);
  const index = url ? Math.max(0, list.indexOf(url)) : 0;
  const current = url ? (list[index] ?? url) : "";
  const hasNav = list.length > 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && hasNav) {
        const next = (index + 1 + list.length) % list.length;
        onChange?.(list[next], next);
      }
      if (e.key === "ArrowLeft" && hasNav) {
        const next = (index - 1 + list.length) % list.length;
        onChange?.(list[next], next);
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, hasNav, index, list, onChange, onClose]);

  if (!open || !current) return null;

  const go = (dir: number) => {
    if (!hasNav) return;
    const next = (index + dir + list.length) % list.length;
    onChange?.(list[next], next);
  };

  const dialog = (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center overflow-hidden p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Image preview"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onWheel={(e) => {
        if (!hasNav) return;
        if (e.deltaY > 20) go(1);
        if (e.deltaY < -20) go(-1);
      }}
    >
      <div
        className="absolute inset-0 bg-black/82 backdrop-blur-md"
        aria-hidden="true"
        onMouseDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      <div
        className="relative z-10 flex max-h-[min(92vh,1080px)] max-w-[min(96vw,1080px)] items-center justify-center"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute -right-2 -top-2 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/90 sm:-right-3 sm:-top-3"
          aria-label="Close preview"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X size={20} />
        </button>
        {hasNav && (
          <>
            <button
              type="button"
              className="absolute left-0 z-20 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-white sm:-translate-x-12"
              aria-label="Previous visual"
              onClick={() => go(-1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="absolute right-0 z-20 grid h-10 w-10 translate-x-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-white sm:translate-x-12"
              aria-label="Next visual"
              onClick={() => go(1)}
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
        <img
          src={current}
          alt=""
          className="max-h-[min(92vh,1080px)] max-w-[min(96vw,1080px)] rounded-lg object-contain shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          draggable={false}
        />
        {hasNav && (
          <p className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-white/80">
            {index + 1} / {list.length}
          </p>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
