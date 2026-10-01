import { useState } from "react";
import type { KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Check, CheckCircle2, FolderOpen, Pencil, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import type { Channel, Pack, VisualSet } from "./data/types";
import { MAX_BRIEF, outputSummary } from "./data/mock";
import { ChannelIcon } from "./brand";
import { EmailCopyCard, EmailMessagePreview, InstagramCopyCard, InstagramPostPreview, WhatsAppMessagePreview, WhatsAppTemplateCard } from "./ChannelCards";
import { VisualGallery } from "./VisualGallery";
import { SlideArt } from "./SlideArt";
import { ImageLightbox } from "./ImageLightbox";

export type PackTab = "all" | "visuals" | "instagram" | "whatsapp" | "email";

interface Props {
  pack: Pack;
  saved: boolean;
  busy: boolean;
  tab: PackTab;
  setTab: (t: PackTab) => void;
  active: Record<VisualSet, number>;
  setActive: (set: VisualSet, i: number) => void;
  update: (fn: (p: Pack) => Pack) => void;
  onRegenerateAll: (brief?: string) => void;
  onRefine: () => void;
  onSaveDraft: (name: string) => void;
  onViewDrafts: () => void;
  onNew: () => void;
  onEditBrief: () => void;
  onBriefChange?: (brief: string) => void;
  onHandoff: (c: Channel) => void;
  onToast: (m: string, tone?: "success" | "info" | "error") => void;
  useLiveImages?: boolean;
  imageQuality?: "standard" | "high" | "story";
}

const STEPS = ["Describe", "Generate", "Review & Edit", "Use in your channels"];

function StepBar({ handedOff }: { handedOff: boolean }) {
  const current = handedOff ? 3 : 2;
  return (
    <ol className="flex min-w-0 flex-1 items-center justify-between gap-1 sm:gap-2" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2" aria-current={on ? "step" : undefined}>
            <span
              className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-extrabold sm:h-6 sm:w-6 sm:text-[11px] ${
                done || on ? "bg-[var(--ai-primary)] text-white" : "border border-[var(--border-strong)] bg-white text-[var(--text-soft)]"
              }`}
            >
              {done ? <Check size={11} strokeWidth={3.5} /> : i + 1}
            </span>
            <span className={`truncate text-[10.5px] font-bold sm:text-[12px] ${on || done ? "text-[var(--text)]" : "text-[var(--text-soft)]"}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-0.5 hidden h-px min-w-3 flex-1 bg-[var(--border)] sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

export function PackView(p: Props) {
  const { pack } = p;
  const hasVisuals = !!(pack.carousel || pack.image);
  const hasIg = !!pack.instagram;
  const visualCount = (pack.carousel?.length ?? 0) + (pack.image?.options.length ?? 0);
  const anyHandoff = Object.values(pack.handedOff).some(Boolean);
  const [nameDraft, setNameDraft] = useState(pack.name);
  const [previewLightbox, setPreviewLightbox] = useState<string | null>(null);
  const [editingBrief, setEditingBrief] = useState(false);
  const [briefDraft, setBriefDraft] = useState(pack.brief);

  const tabs: { id: PackTab; label: string; show: boolean }[] = [
    { id: "all", label: "Overview", show: true },
    { id: "visuals", label: `Visuals (${visualCount})`, show: hasVisuals },
    { id: "instagram", label: "Instagram Copy", show: hasIg },
    { id: "whatsapp", label: "WhatsApp Template", show: !!pack.whatsapp },
    { id: "email", label: "Email Copy", show: !!pack.email },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const tab = visibleTabs.some((t) => t.id === p.tab) ? p.tab : "all";
  const selectedPreview = pack.carousel?.[p.active.carousel] ?? pack.image?.options[pack.image.selected] ?? null;
  const previewSlides = pack.carousel?.length ? pack.carousel : pack.image?.options ?? [];
  const previewUrls = previewSlides.map((slide) => slide.image).filter((url): url is string => Boolean(url));

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = visibleTabs.findIndex((t) => t.id === tab);
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
    p.setTab(visibleTabs[n].id);
    (e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[n])?.focus();
  };

  const cardProps = { pack, update: p.update, onHandoff: p.onHandoff, onToast: p.onToast, live: p.useLiveImages };
  const channelTab = tab === "instagram" || tab === "whatsapp" || tab === "email";
  const showVisuals = hasVisuals && (tab === "all" || tab === "visuals");
  const channelCards = [
    hasIg && (tab === "all" || tab === "instagram") && <InstagramCopyCard key="ig" {...cardProps} alwaysEdit={tab === "instagram"} />,
    pack.whatsapp && (tab === "all" || tab === "whatsapp") && <WhatsAppTemplateCard key="wa" {...cardProps} alwaysEdit={tab === "whatsapp"} />,
    pack.email && (tab === "all" || tab === "email") && <EmailCopyCard key="em" {...cardProps} alwaysEdit={tab === "email"} />,
  ].filter(Boolean);

  const handoffs: { channel: Channel; title: string; desc: string; show: boolean }[] = [
    { channel: "instagram", title: "Instagram Posts", desc: "Open with this post.", show: hasIg },
    { channel: "whatsapp", title: "WhatsApp Templates", desc: "Open with this template.", show: !!pack.whatsapp },
    { channel: "email", title: "Email Compose", desc: "Open with this email.", show: !!pack.email },
  ];

  const commitName = () => {
    const n = nameDraft.trim() || pack.name;
    setNameDraft(n);
    if (n !== pack.name) p.update((x) => ({ ...x, name: n }));
    return n;
  };

  const applyBrief = () => {
    const next = briefDraft.trim().slice(0, MAX_BRIEF);
    if (!next) {
      p.onToast("Write a brief before saving.", "error");
      return "";
    }
    p.update((x) => ({ ...x, brief: next, imagePrompt: next }));
    p.onBriefChange?.(next);
    setEditingBrief(false);
    p.onToast("Brief updated", "success");
    return next;
  };

  return (
    <div className="anim-fade-up space-y-4" aria-busy={p.busy}>
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button type="button" className="btn btn-sm flex-none" onClick={p.onNew}>
          <ArrowLeft size={14} /> Start new
        </button>
        <StepBar handedOff={anyHandoff} />
        <div className="flex flex-none gap-2">
          <button type="button" className="btn btn-sm" onClick={p.onViewDrafts}>
            <FolderOpen size={14} /> Sessions
          </button>
          {!p.saved && (
            <button type="button" className="btn btn-sm" onClick={() => p.onSaveDraft(commitName())}>
              <Bookmark size={14} /> Save
            </button>
          )}
        </div>
      </div>

      {/* brief */}
      <section className={`card px-3.5 py-2.5 sm:px-4 ${p.saved ? "!border-[#bfe8d3] !bg-[#f3fbf7]" : ""}`}>
        <div className="flex items-start gap-2.5">
          <span
            className="grid h-8 w-8 flex-none place-items-center rounded-lg text-white shadow-[0_6px_14px_rgba(109,61,242,0.28)]"
            style={{ background: "linear-gradient(145deg,#6d3df2 0%,#b07cff 100%)" }}
            aria-hidden="true"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.2 2.4h6.1l3.5 3.4v7.8a.9.9 0 0 1-.9.9H3.2a.9.9 0 0 1-.9-.9V3.3a.9.9 0 0 1 .9-.9Z" fill="white" fillOpacity=".18" stroke="white" strokeWidth="1.2" />
              <path d="M9.2 2.6v2.7h2.8" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M4.6 8.1h6.2M4.6 10.4h4.4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M11.6 1.2l.45 1.05 1.05.45-1.05.45-.45 1.05-.45-1.05-1.05-.45 1.05-.45.45-1.05Z" fill="#ffe08a" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-[13px] font-extrabold tracking-tight">{p.saved ? "Pack saved" : "Your brief"}</h2>
              {!p.saved && (
                <>
                  <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-soft)]">{outputSummary(pack.outputs)}</span>
                  <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-soft)]">{pack.language}</span>
                  {pack.ctx.occasion && <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-soft)]">{pack.ctx.occasion}</span>}
                  {pack.ctx.place && <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-soft)]">{pack.ctx.place}</span>}
                </>
              )}
            </div>
            {p.saved ? (
              <p className="mt-0.5 line-clamp-1 text-[12px] leading-snug text-[var(--text-muted)]">
                Saved as <strong className="text-[var(--text)]">{pack.name}</strong>. Open it anytime from Sessions.
              </p>
            ) : editingBrief ? (
              <textarea
                className="input mt-1.5 h-[52px] min-h-0 w-full resize-none py-1.5 text-[12.5px] leading-snug"
                rows={2}
                value={briefDraft}
                maxLength={MAX_BRIEF}
                aria-label="Edit brief"
                onChange={(e) => setBriefDraft(e.target.value)}
              />
            ) : (
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--text-muted)]" title={pack.brief}>
                {pack.brief}
              </p>
            )}
          </div>
        </div>
        {p.busy && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--ai-primary-soft)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ai-primary)]" role="status" aria-live="polite">
            <RefreshCw size={13} className="spin flex-none" />
            Regenerating this pack…
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2">
          {p.saved ? (
            <>
              <button type="button" className="btn btn-sm" onClick={p.onNew}>
                <Plus size={14} /> Create new
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={p.onViewDrafts}>
                <FolderOpen size={14} /> View sessions
              </button>
            </>
          ) : (
            <>
              {editingBrief ? (
                <>
                  <span className="mr-auto text-[11px] font-semibold text-[var(--text-soft)]">
                    {briefDraft.length}/{MAX_BRIEF}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      setBriefDraft(pack.brief);
                      setEditingBrief(false);
                    }}
                  >
                    <X size={13} /> Cancel
                  </button>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => applyBrief()}>
                    Save brief
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setBriefDraft(pack.brief);
                    setEditingBrief(true);
                  }}
                >
                  <Pencil size={13} /> Edit
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm"
                disabled={p.busy}
                onClick={() => {
                  let next = pack.brief;
                  if (editingBrief) {
                    const saved = applyBrief();
                    if (!saved) return;
                    next = saved;
                  }
                  p.onRegenerateAll(next);
                }}
              >
                <RefreshCw size={14} className={p.busy ? "spin" : ""} /> Generate again
              </button>
              <button type="button" className="btn btn-sm btn-primary" disabled={p.busy} onClick={p.onRefine}>
                <Sparkles size={14} /> Refine copy
              </button>
            </>
          )}
        </div>
      </section>

      <div className="relative grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {p.busy && (
          <div className="absolute inset-0 z-20 flex justify-center rounded-2xl bg-white/72 pt-10 backdrop-blur-[2px]" role="status" aria-live="polite">
            <div className="flex h-fit items-center gap-3 rounded-xl border border-[var(--ai-primary-ring)] bg-white px-4 py-3 shadow-[0_12px_32px_rgba(109,61,242,0.16)]">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]">
                <RefreshCw size={16} className="spin" />
              </span>
              <div>
                <p className="text-[13px] font-extrabold">Generating again</p>
                <p className="text-[12px] text-[var(--text-muted)]">Updating visuals and copy on this page.</p>
              </div>
            </div>
          </div>
        )}
        {/* main workspace */}
        <div className="min-w-0 space-y-4">
          {/* tabs */}
          <div className="thin-scroll -mx-1 overflow-x-auto px-1" onKeyDown={onTabKey}>
            <div role="tablist" aria-label="Content pack sections" className="grid w-full grid-cols-2 gap-1.5 rounded-xl border border-[var(--border)] bg-white p-1.5 sm:flex">
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => p.setTab(t.id)}
                  className={`h-9 min-w-0 flex-1 whitespace-nowrap rounded-lg px-2 text-[12.5px] font-bold transition-colors ${tab === t.id ? "bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-4">
            {showVisuals && pack.carousel && (
              <VisualGallery pack={pack} set="carousel" active={p.active.carousel} setActive={(i) => p.setActive("carousel", i)} update={p.update} onToast={p.onToast} useLiveImages={p.useLiveImages} imageQuality={p.imageQuality} />
            )}
            {showVisuals && pack.image && (
              <VisualGallery pack={pack} set="image" active={p.active.image} setActive={(i) => p.setActive("image", i)} update={p.update} onToast={p.onToast} useLiveImages={p.useLiveImages} imageQuality={p.imageQuality} />
            )}

            {channelCards.length > 0 && (
              <section aria-label="Channel-ready content" className="space-y-3">
                {tab === "all" && (
                  <div className="flex items-end justify-between">
                    <div>
                      <h3 className="text-[14px] font-extrabold">Channel-ready content</h3>
                      <p className="text-[12px] text-[var(--text-muted)]">Review and edit the copy written for each channel.</p>
                    </div>
                  </div>
                )}
                <div className={`grid items-start gap-3 ${tab === "all" ? "[grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr))]" : ""}`}>{channelCards}</div>
              </section>
            )}
          </div>
        </div>

        {/* hand-off column */}
        <aside className="space-y-4 xl:sticky xl:top-[88px]" aria-label="Hand-off">
          {tab === "instagram" && <InstagramPostPreview pack={pack} />}
          {tab === "whatsapp" && <WhatsAppMessagePreview pack={pack} />}
          {tab === "email" && <EmailMessagePreview pack={pack} />}
          {!channelTab && (
          <section className="card p-4 sm:p-5">
            {selectedPreview && (
              <button
                type="button"
                className="mb-4 block w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[#0a0c12] text-left transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ai-primary)]"
                aria-label="Open full-size preview of selected visual"
                onClick={() => {
                  if (selectedPreview.image) setPreviewLightbox(selectedPreview.image);
                }}
              >
                <div className="relative aspect-square w-full">
                  <SlideArt slide={selectedPreview} label="Selected visual preview" />
                </div>
                {selectedPreview.image && (
                  <p className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1.5 text-center text-[10px] font-semibold text-[var(--text-muted)]">
                    Tap to view full size
                  </p>
                )}
              </button>
            )}
            <ImageLightbox
              url={previewLightbox}
              urls={previewUrls}
              title="Selected visual"
              onClose={() => setPreviewLightbox(null)}
              onChange={(url, index) => {
                setPreviewLightbox(url);
                if (pack.carousel?.length) p.setActive("carousel", index);
                else if (pack.image) {
                  p.update((current) => {
                    if (!current.image) return current;
                    const slide = current.image.options[index];
                    const next = { ...current, image: { ...current.image, selected: index } };
                    return next.whatsapp && slide?.image
                      ? { ...next, whatsapp: { ...next.whatsapp, header: { ...next.whatsapp.header, source: slide.image } } }
                      : next;
                  });
                }
              }}
            />
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]">
                <CheckCircle2 size={19} />
              </span>
              <div>
                <h3 className="text-[14px] font-extrabold leading-tight">Use your content</h3>
                <p className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">Choose a channel to continue.</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {handoffs
                .filter((h) => h.show)
                .map((h) => (
                  <li key={h.channel}>
                    <button
                      type="button"
                      onClick={() => p.onHandoff(h.channel)}
                      className="group flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-3 text-left transition-all hover:border-[var(--ai-primary-ring)] hover:bg-[var(--surface-subtle)]"
                    >
                      <ChannelIcon channel={h.channel} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold leading-tight">{h.title}</span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-[var(--text-muted)]">{h.desc}</span>
                      </span>
                      {pack.handedOff[h.channel] ? (
                        <span className="pill bg-[var(--success-soft)] text-[var(--success)]">
                          <Check size={11} strokeWidth={3.5} /> Added
                        </span>
                      ) : (
                        <ArrowRight size={16} className="flex-none text-[var(--text-soft)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ai-primary)]" />
                      )}
                    </button>
                  </li>
                ))}
            </ul>
            <p className="mt-3 rounded-lg bg-[var(--surface-subtle)] px-3 py-2 text-[11.5px] leading-snug text-[var(--text-muted)]">
              Choose a channel to continue.
            </p>
          </section>
          )}

          <section className="card p-4 sm:p-5">
            <h3 className="text-[14px] font-extrabold">Save this content pack</h3>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">Save as a draft to reuse or make changes later.</p>
            <label htmlFor="draft-name" className="field-label mt-3">
              Draft name
            </label>
            <input id="draft-name" className="input" value={nameDraft} maxLength={80} onChange={(e) => setNameDraft(e.target.value)} onBlur={commitName} />
            <button
              type="button"
              className="btn btn-primary mt-3 w-full"
              onClick={() => p.onSaveDraft(commitName())}
            >
              <Bookmark size={15} /> {p.saved ? "Update Draft" : "Save as Draft"}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
