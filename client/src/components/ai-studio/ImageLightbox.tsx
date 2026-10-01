import { X } from "lucide-react";
import { useEffect } from "react";

interface Props {
  url: string | null;
  title?: string;
  onClose: () => void;
}

export function ImageLightbox({ url, title, onClose }: Props) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Full-size image preview"}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Close preview"
        onClick={onClose}
      >
        <X size={22} />
      </button>
      <img
        src={url}
        alt=""
        className="max-h-[min(92vh,1080px)] max-w-[min(96vw,1080px)] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>
  );
}
