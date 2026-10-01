import { useState } from "react";
import type { KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Check, CheckCircle2, FileText, FolderOpen, Plus, RefreshCw, Sparkles } from "lucide-react";
import type { Channel, Pack, VisualSet } from "./data/types";
import { outputSummary } from "./data/mock";
import { ChannelIcon } from "./brand";
import { EmailCopyCard, InstagramCopyCard, WhatsAppTemplateCard } from "./ChannelCards";
import { VisualGallery } from "./VisualGallery";

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
  onRegenerateAll: () => void;
  onRefine: () => void;
  onSaveDraft: (name: string) => void;
  onViewDrafts: () => void;
  onNew: () => void;
  onEditBrief: () => void;
  onHandoff: (c: Channel) => void;
  onToast: (m: string, tone?: "success" | "info" | "error") => void;
}

const STEPS = ["Describe", "Generate", "Review & Edit", "Use in your channels"];

function StepBar({ handedOff }: { handedOff: boolean }) {
  const current = handedOff ? 3 : 2;
  return (
    <ol className="hidden items-center gap-2 lg:flex" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={s} className="flex items-center gap-2" aria-current={on ? "step" : undefined}>
            <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-extrabold ${done ? "bg-[var(--ai-primary)] text-white" : on ? "bg-[var(--ai-primary)] text-white ring-4 ring-[var(--ai-primary-soft)]" : "border border-[var(--border-strong)] bg-white text-[var(--text-soft)]"}`}>
              {done ? <Check size={12} strokeWidth={3.5} /> : i + 1}
            </span>
            <span className={`text-[12.5px] font-bold ${on || done ? "text-[var(--text)]" : "text-[var(--text-soft)]"}`}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-[var(--border-strong)]" />}
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

  const tabs: { id: PackTab; label: string; show: boolean }[] = [
    { id: "all", label: "Overview", show: true },
    { id: "visuals", label: `Visuals (${visualCount})`, show: hasVisuals },
    { id: "instagram", label: "Instagram Copy", show: hasIg },
    { id: "whatsapp", label: "WhatsApp Template", show: !!pack.whatsapp },
    { id: "email", label: "Email Copy", show: !!pack.email },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const tab = visibleTabs.some((t) => t.id === p.tab) ? p.tab : "all";

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = visibleTabs.findIndex((t) => t.id === tab);
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
    p.setTab(visibleTabs[n].id);
    (e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[n])?.focus();
  };

  const cardProps = { pack, update: p.update, onHandoff: p.onHandoff, onToast: p.onToast };
  const showVisuals = hasVisuals && (tab === "all" || tab === "visuals");
  const channelCards = [
    hasIg && (tab === "all" || tab === "instagram") && <InstagramCopyCard key="ig" {...cardProps} />,
    pack.whatsapp && (tab === "all" || tab === "whatsapp") && <WhatsAppTemplateCard key="wa" {...cardProps} />,
    pack.email && (tab === "all" || tab === "email") && <EmailCopyCard key="em" {...cardProps} />,
  ].filter(Boolean);

  const handoffs: { channel: Channel; title: string; desc: string; show: boolean }[] = [
    { channel: "instagram", title: "Use in Instagram Posts", desc: "Take this content to Instagram Posts.", show: hasIg },
    { channel: "whatsapp", title: "Open in WhatsApp Templates", desc: "Use this template in your Templates page.", show: !!pack.whatsapp },
    { channel: "email", title: "Insert in Email Compose", desc: "Use this content in Email Compose.", show: !!pack.email },
  ];

  const commitName = () => {
    const n = nameDraft.trim() || pack.name;
    setNameDraft(n);
    if (n !== pack.name) p.update((x) => ({ ...x, name: n }));
    return n;
  };

  return (
    <div className="anim-fade-up space-y-4" aria-busy={p.busy}>
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-sm" onClick={p.onNew}>
          <ArrowLeft size={14} /> Start new
        </button>
        <div className="mx-auto hidden lg:block">
          <StepBar handedOff={anyHandoff} />
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn btn-sm" onClick={p.onViewDrafts}>
            <FolderOpen size={14} /> My Drafts
          </button>
          {!p.saved && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => p.onSaveDraft(commitName())}
            >
              <Bookmark size={14} /> Save as Draft
            </button>
          )}
        </div>
      </div>

      {/* banner */}
      <section className={`card flex flex-wrap items-center gap-4 px-4 py-3.5 sm:px-5 ${p.saved ? "!border-[#bfe8d3] !bg-[#f3fbf7]" : "!bg-[#f6fbf8]"}`} aria-live="polite">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--success)] text-white">
          <Check size={20} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-extrabold tracking-tight">{p.saved ? "Content pack saved!" : "Your content pack is ready!"}</h2>
          <p className="truncate text-[12.5px] text-[var(--text-muted)]">
            {p.saved ? (
              <>
                Saved as <strong className="text-[var(--text)]">{pack.name}</strong> — you can continue anytime from My Drafts.
              </>
            ) : (
              "Review, edit and use this content in your channels."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.saved ? (
            <>
              <button type="button" className="btn btn-sm" onClick={p.onNew}>
                <Plus size={14} /> Create New
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={p.onViewDrafts}>
                <FolderOpen size={14} /> View My Drafts
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-sm" onClick={p.onRegenerateAll} disabled={p.busy}>
                <RefreshCw size={14} className={p.busy ? "spin" : ""} /> Regenerate All
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={p.onRefine}>
                <Sparkles size={14} /> Refine with AI
              </button>
            </>
          )}
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* main workspace */}
        <div className={`min-w-0 space-y-4 transition-opacity ${p.busy ? "pointer-events-none opacity-50" : ""}`}>
          {/* brief summary */}
          <section className="card flex flex-wrap items-center gap-3 px-4 py-3" aria-label="Your brief">
            <FileText size={16} className="flex-none text-[var(--ai-primary)]" />
            <p className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-muted)]" title={pack.brief}>
              <span className="font-bold text-[var(--text)]">One brief → {outputSummary(pack.outputs)} · {pack.language}</span> · “{pack.brief}”
            </p>
            <button type="button" className="btn btn-sm" onClick={p.onEditBrief}>
              Edit brief
            </button>
          </section>

          {/* tabs */}
          <div className="thin-scroll -mx-1 overflow-x-auto px-1" onKeyDown={onTabKey}>
            <div role="tablist" aria-label="Content pack sections" className="flex w-max gap-1 rounded-xl border border-[var(--border)] bg-white p-1">
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => p.setTab(t.id)}
                  className={`h-9 whitespace-nowrap rounded-lg px-3.5 text-[12.5px] font-bold transition-colors ${tab === t.id ? "bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-4">
            {showVisuals && pack.carousel && (
              <VisualGallery pack={pack} set="carousel" active={p.active.carousel} setActive={(i) => p.setActive("carousel", i)} update={p.update} onToast={p.onToast} />
            )}
            {showVisuals && pack.image && (
              <VisualGallery pack={pack} set="image" active={p.active.image} setActive={(i) => p.setActive("image", i)} update={p.update} onToast={p.onToast} />
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
                <div className={`grid items-start gap-3 ${tab === "all" ? "[grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr))]" : "max-w-[640px]"}`}>{channelCards}</div>
              </section>
            )}
          </div>
        </div>

        {/* hand-off column */}
        <aside className="space-y-4 xl:sticky xl:top-[88px]" aria-label="Hand-off">
          <section className="card p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]">
                <CheckCircle2 size={19} />
              </span>
              <div>
                <h3 className="text-[14px] font-extrabold leading-tight">Ready to use in your channels</h3>
                <p className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">Your content pack is ready. Use it in the respective channel pages.</p>
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
                          <Check size={11} strokeWidth={3.5} /> Handed off
                        </span>
                      ) : (
                        <ArrowRight size={16} className="flex-none text-[var(--text-soft)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ai-primary)]" />
                      )}
                    </button>
                  </li>
                ))}
            </ul>
            <p className="mt-3 rounded-lg bg-[var(--surface-subtle)] px-3 py-2 text-[11.5px] leading-snug text-[var(--text-muted)]">
              AI Studio prepares your content. Each channel page handles the rest.
            </p>
          </section>

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
