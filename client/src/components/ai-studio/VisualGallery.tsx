import { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CopyPlus, Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import { aiStudioApi } from "../../services/api";
import type { ArtKey, Pack, VisualSet } from "./data/types";
import { MAX_IMAGE_OPTIONS, MAX_SLIDES, MIN_SLIDES, getSlides, newBlankSlide, regenerateSlide, setSlides, variantSlide } from "./data/mock";
import { InstagramIcon } from "./brand";
import { SlideArt } from "./SlideArt";
import { ImageLightbox } from "./ImageLightbox";
import { downloadSlidePoster } from "../../utils/aiStudioPoster";

interface Props {
  pack: Pack;
  set: VisualSet;
  active: number;
  setActive: (i: number) => void;
  update: (fn: (p: Pack) => Pack) => void;
  onToast: (m: string, tone?: "success" | "info" | "error") => void;
  useLiveImages?: boolean;
  imageQuality?: "standard" | "high" | "story";
}


/**
 * Visuals are AI-generated posters — they cannot be text-edited. Users pick,
 * regenerate, or generate variants of the exact image instead.
 */
export function VisualGallery({ pack, set, active, setActive, update, onToast, useLiveImages, imageQuality = "standard" }: Props) {
  const slides = getSlides(pack, set);
  const isCarousel = set === "carousel";
  const [busy, setBusy] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedImage = pack.image?.selected ?? 0;
  const optionCap = isCarousel ? MAX_SLIDES : MAX_IMAGE_OPTIONS;

  const addMediaPath = (packValue: Pack, url: string, previousUrl?: string): Pack => {
    if (!url.startsWith("/api/media/public/") && !url.includes("/api/media/public/")) return packValue;
    const path = url.split("?")[0].split("/api/media/public/")[1];
    if (!path) return packValue;
    const paths = [...(packValue.mediaPaths ?? [])];
    const previousPath = previousUrl?.split("?")[0].split("/api/media/public/")[1];
    const index = previousPath ? paths.indexOf(previousPath) : -1;
    if (index >= 0) paths[index] = path;
    else if (!paths.includes(path)) paths.push(path);
    return { ...packValue, mediaPaths: paths };
  };

  const updateGeneratedMedia = (packValue: Pack, url: string, index: number, previousUrl?: string): Pack => {
    const next = addMediaPath(packValue, url, previousUrl);
    const isHeader = set === "carousel" ? index === 0 : index === (next.image?.selected ?? selectedImage);
    return isHeader && next.whatsapp
      ? { ...next, whatsapp: { ...next.whatsapp, header: { ...next.whatsapp.header, source: url } } }
      : next;
  };

  const scroll = (dir: number) => stripRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });

  const add = () => {
    if (slides.length >= MAX_SLIDES) return onToast(`A carousel can have up to ${MAX_SLIDES} slides.`, "error");
    if (useLiveImages) {
      const source = slides[active] ?? slides[0];
      if (!source) return;
      const insertAt = Math.min(active + 1, slides.length);
      const headline = source.elements.find((e) => e.role === "headline")?.text;
      setBusy("add");
      void fetchSlideImage(insertAt, headline)
        .then((url) => {
          update((p) => {
            const current = getSlides(p, set);
            const base = current[active] ?? current[0];
            if (!base) return p;
            const slide = { ...variantSlide(base, p.ctx, insertAt), image: url, art: "none" as ArtKey };
            return setSlides(updateGeneratedMedia(p, url, insertAt), set, [...current.slice(0, insertAt), slide, ...current.slice(insertAt)]);
          });
          setActive(insertAt);
          onToast("New AI slide added", "success");
        })
        .catch(() => onToast("Image generation failed. Try again.", "error"))
        .finally(() => setBusy(null));
      return;
    }
    const slide = newBlankSlide(pack, slides.length);
    const at = Math.min(active + 1, slides.length);
    const next = [...slides.slice(0, at), slide, ...slides.slice(at)];
    update((p) => setSlides(p, set, next));
    setActive(at);
    onToast("Slide added");
  };

  const remove = (i: number) => {
    if (slides.length <= MIN_SLIDES) return onToast(`A carousel needs at least ${MIN_SLIDES} slides.`, "error");
    const next = slides.filter((_, k) => k !== i);
    update((p) => setSlides(p, set, next));
    setActive(Math.min(active > i ? active - 1 : active, next.length - 1));
    onToast("Slide removed");
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    update((p) => setSlides(p, set, next));
    setActive(j);
  };

  const fetchSlideImage = async (i: number, headline?: string) => {
    const res = await aiStudioApi.regenerateVisual({
      imagePrompt: pack.imagePrompt || pack.brief,
      headline,
      slideIndex: i,
      packId: pack.id,
      imageQuality,
    });
    const url = (res.data as { data?: { url?: string } })?.data?.url;
    if (!url) throw new Error("No image URL");
    return url;
  };

  /** In-place regeneration of one slide/option. */
  const regen = (i: number) => {
    const id = slides[i].id;
    const headline = slides[i].elements.find((e) => e.role === "headline")?.text;
    setBusy(id);
    if (useLiveImages) {
      void fetchSlideImage(i, headline)
        .then((url) => {
          update((p) => {
            const cur = getSlides(p, set);
            return setSlides(
              updateGeneratedMedia(p, url, i, cur[i]?.image || undefined),
              set,
              cur.map((s, k) => (k === i ? { ...s, image: url, art: "none" as ArtKey } : s)),
            );
          });
          onToast("New AI photo for this slide", "success");
        })
        .catch(() => onToast("Image generation failed. Try again.", "error"))
        .finally(() => setBusy(null));
      return;
    }
    window.setTimeout(() => {
      update((p) => {
        const cur = getSlides(p, set);
        return setSlides(p, set, cur.map((s, k) => (k === i ? regenerateSlide(s, p.ctx, k) : s)));
      });
      setBusy(null);
      onToast(isCarousel ? "Slide regenerated" : "Option regenerated");
    }, 650);
  };

  /** Generate a fresh variant of one slide/option and insert it after it. */
  const variant = (i: number) => {
    if (useLiveImages && slides.length >= 4) {
      return onToast("A live pack can have up to 4 generated photos.", "error");
    }
    if (slides.length >= optionCap) {
      return onToast(
        isCarousel ? `A carousel can have up to ${MAX_SLIDES} slides.` : `You can have up to ${MAX_IMAGE_OPTIONS} image options. Delete one first.`,
        "error",
      );
    }
    const id = slides[i].id;
    const headline = slides[i].elements.find((e) => e.role === "headline")?.text;
    setBusy(id);
    if (useLiveImages) {
      void fetchSlideImage(i + 1, headline)
        .then((url) => {
          update((p) => {
            const cur = getSlides(p, set);
            const v = { ...variantSlide(cur[i], p.ctx, i), image: url, art: "none" as ArtKey };
            const next = [...cur.slice(0, i + 1), v, ...cur.slice(i + 1)];
            return setSlides(updateGeneratedMedia(p, url, i), set, next);
          });
          setActive(i + 1);
          onToast("New AI variant added", "success");
        })
        .catch(() => onToast("Image generation failed. Try again.", "error"))
        .finally(() => setBusy(null));
      return;
    }
    window.setTimeout(() => {
      update((p) => {
        const cur = getSlides(p, set);
        const v = variantSlide(cur[i], p.ctx, i);
        const next = [...cur.slice(0, i + 1), v, ...cur.slice(i + 1)];
        return setSlides(p, set, next);
      });
      setActive(i + 1);
      setBusy(null);
      onToast(isCarousel ? "Variant added next to this slide" : "Variant added to your options");
    }, 650);
  };

  const download = (i: number) => {
    const s = slides[i];
    if (!s) return;
    void downloadSlidePoster(s, `${(pack.name || "ai-studio").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${isCarousel ? "slide" : "poster"}-${i + 1}.png`)
      .then((ok) => onToast(ok ? "Poster downloaded (PNG · 1080 × 1080)" : "Couldn't render the poster.", ok ? "success" : "error"));
  };

  const openPreview = (i: number, url?: string) => {
    setActive(i);
    if (url) setLightboxUrl(url);
  };

  const itemActions = (i: number) => (
    <div className="mt-1 flex items-center justify-center gap-0.5">
      <button type="button" className="icon-btn !h-7 !w-7" aria-label={`New variant of slide ${i + 1}`} title="New variant" disabled={busy !== null} onClick={() => variant(i)}>
        <CopyPlus size={14} />
      </button>
      <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Regenerate slide ${i + 1}`} title="Regenerate" disabled={busy !== null} onClick={() => regen(i)}>
        <RefreshCw size={14} />
      </button>
      <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Download slide ${i + 1}`} title="Download PNG" onClick={() => download(i)}>
        <Download size={14} />
      </button>
      {isCarousel && (
        <>
          <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Move slide ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
            <ChevronLeft size={15} />
          </button>
          <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Move slide ${i + 1} later`} disabled={i === slides.length - 1} onClick={() => move(i, 1)}>
            <ChevronRight size={15} />
          </button>
          <button type="button" className="icon-btn !h-7 !w-7 hover:!bg-[var(--danger-soft)] hover:!text-[var(--danger)]" aria-label={`Delete slide ${i + 1}`} disabled={slides.length <= MIN_SLIDES} onClick={() => remove(i)}>
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  );

  return (
    <section className="card p-4 sm:p-5" aria-labelledby={`vis-${set}`}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--surface-subtle)]">
          <InstagramIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`vis-${set}`} className="text-[14px] font-extrabold leading-tight">
            {isCarousel ? "Visuals — Instagram Carousel" : "Visuals — Instagram Image"}
          </h3>
          <p className="text-[12px] text-[var(--text-muted)]">
            {isCarousel ? `${slides.length} carousel slides · 1080 × 1080` : `${slides.length} options · pick one · 1080 × 1080`}
          </p>
        </div>
        <span className="pill bg-[var(--surface-subtle)] text-[var(--text-muted)]" aria-label={`${slides.length} of ${optionCap}`}>
          {slides.length} / {optionCap}
        </span>
      </div>
      {busy === "add" && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-[var(--ai-primary-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--ai-primary)]" role="status" aria-live="polite">
          <RefreshCw size={14} className="spin flex-none" />
          Creating a new visual for this slide…
        </div>
      )}

      {isCarousel ? (
        <div className="relative">
          <button type="button" aria-label="Scroll slides left" className="absolute -left-2 top-[44px] z-10 hidden h-7 w-7 place-items-center rounded-full border border-[var(--border)] bg-white shadow-md hover:bg-[var(--ai-primary-soft)] sm:grid" onClick={() => scroll(-1)}>
            <ChevronLeft size={15} />
          </button>
          <div ref={stripRef} className="thin-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1" role="listbox" aria-label="Carousel slides" aria-orientation="horizontal">
            {slides.map((s, i) => {
              const on = i === active;
              return (
                <div key={s.id} className="w-[116px] flex-none sm:w-[124px]">
                  <div className="relative">
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      aria-label={`Select slide ${i + 1}`}
                      onClick={() => openPreview(i, s.image || undefined)}
                      className={`block w-full overflow-hidden rounded-xl border-2 transition-all duration-150 ${on ? "border-[var(--ai-primary)] shadow-[0_6px_16px_rgba(109,61,242,0.25)]" : "border-transparent hover:border-[var(--ai-primary-ring)]"} ${busy === s.id ? "opacity-40" : ""}`}
                    >
                      <SlideArt slide={s} label={`Slide ${i + 1}`} />
                    </button>
                    <span className="pointer-events-none absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md bg-white/95 text-[10px] font-extrabold shadow-sm">{i + 1}</span>
                    {busy === s.id && <RefreshCw size={18} className="spin absolute left-1/2 top-1/2 -ml-[9px] -mt-[9px] text-[var(--ai-primary)]" aria-hidden="true" />}
                  </div>
                  {itemActions(i)}
                </div>
              );
            })}
            {slides.length < MAX_SLIDES && (
              <button
                type="button"
                onClick={add}
                aria-label={busy === "add" ? "Generating new slide" : "Add slide"}
                disabled={busy !== null}
                className={`flex aspect-square w-[116px] flex-none flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] text-[12px] font-bold text-[var(--text-muted)] transition-colors hover:border-[var(--ai-primary)] hover:text-[var(--ai-primary)] sm:w-[124px] ${busy === "add" ? "border-[var(--ai-primary)] bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]" : ""}`}
              >
                {busy === "add" ? <RefreshCw size={20} className="spin" /> : <Plus size={20} />}
                {busy === "add" ? "Generating…" : "Add slide"}
              </button>
            )}
          </div>
          <button type="button" aria-label="Scroll slides right" className="absolute -right-2 top-[44px] z-10 hidden h-7 w-7 place-items-center rounded-full border border-[var(--border)] bg-white shadow-md hover:bg-[var(--ai-primary-soft)] sm:grid" onClick={() => scroll(1)}>
            <ChevronRight size={15} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Image options">
          {slides.map((s, i) => {
            const on = i === selectedImage;
            return (
              <div key={s.id} className="min-w-0">
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`Option ${i + 1}${on ? " (selected)" : ""}`}
                  onClick={() => {
                    update((p) => {
                      if (!p.image) return p;
                      const next = { ...p, image: { ...p.image, selected: i } };
                      return next.whatsapp
                        ? { ...next, whatsapp: { ...next.whatsapp, header: { ...next.whatsapp.header, source: s.image || next.whatsapp.header.source } } }
                        : next;
                    });
                    if (s.image) setLightboxUrl(s.image);
                  }}
                  className={`relative block w-full overflow-hidden rounded-xl border-2 transition-all duration-150 ${on ? "border-[var(--ai-primary)] shadow-[0_6px_16px_rgba(109,61,242,0.25)]" : "border-transparent hover:border-[var(--ai-primary-ring)]"} ${busy === s.id || busy === "all" ? "opacity-40" : ""}`}
                >
                  <SlideArt slide={s} label={`Option ${i + 1}`} />
                  {on && (
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--ai-primary)] text-white shadow">
                      <Check size={14} strokeWidth={3.5} />
                    </span>
                  )}
                </button>
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <span className={`truncate text-[12px] font-bold ${on ? "text-[var(--ai-primary)]" : "text-[var(--text-muted)]"}`}>{on ? `Option ${i + 1} · Selected` : `Option ${i + 1}`}</span>
                  <span className="flex flex-none">
                    <button type="button" className="icon-btn !h-7 !w-7" aria-label={`New variant of option ${i + 1}`} title="New variant" disabled={busy !== null} onClick={() => variant(i)}>
                      <CopyPlus size={13} />
                    </button>
                    <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Regenerate option ${i + 1}`} title="Regenerate" disabled={busy !== null} onClick={() => regen(i)}>
                      <RefreshCw size={13} />
                    </button>
                    <button type="button" className="icon-btn !h-7 !w-7" aria-label={`Download option ${i + 1}`} title="Download PNG" onClick={() => download(i)}>
                      <Download size={13} />
                    </button>
                  </span>
                </div>
                {!on && (
                  <button type="button" className="btn btn-sm btn-soft mt-1 w-full" onClick={() => update((p) => {
                    if (!p.image) return p;
                    const next = { ...p, image: { ...p.image, selected: i } };
                    return next.whatsapp
                      ? { ...next, whatsapp: { ...next.whatsapp, header: { ...next.whatsapp.header, source: s.image || next.whatsapp.header.source } } }
                      : next;
                  })}>
                    Select image
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ImageLightbox url={lightboxUrl} title="Generated visual" onClose={() => setLightboxUrl(null)} />
    </section>
  );
}
