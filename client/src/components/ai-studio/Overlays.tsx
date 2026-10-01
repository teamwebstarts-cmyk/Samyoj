import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, Bookmark, Check, FileText, FolderOpen, History, Info, Plus, Search, Trash2, X } from "lucide-react";
import type { Channel, Draft, OutputId, Pack } from "./data/types";
import type { HistoryEntry } from "../../utils/aiStudioStore";
import { outputSummary, timeAgo } from "./data/mock";
import { ChannelIcon } from "./brand";
import { SlideArt } from "./SlideArt";

/* ------------------------------ Toast ------------------------------ */

export interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "info" | "error";
}

export function ToastHost({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="anim-fade-up pointer-events-auto flex max-w-[460px] items-center gap-3 rounded-xl border border-[var(--border)] bg-white py-2.5 pl-3 pr-2 text-[13px] font-semibold text-[var(--text)] shadow-[var(--shadow-pop)]"
        >
          <span
            className="grid h-6 w-6 flex-none place-items-center rounded-full text-white"
            style={{ background: t.tone === "success" ? "var(--success)" : t.tone === "error" ? "var(--danger)" : "var(--ai-primary)" }}
          >
            {t.tone === "success" ? <Check size={14} strokeWidth={3} /> : t.tone === "error" ? <AlertCircle size={14} /> : <Info size={14} />}
          </span>
          <span className="flex-1">{t.message}</span>
          <button type="button" className="icon-btn !h-7 !w-7" aria-label="Dismiss notification" onClick={() => onDismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

const CHANNEL_ORDER: Channel[] = ["instagram", "whatsapp", "email"];

function channelsForPack(pack: Pack): Channel[] {
  const ids = new Set(pack.outputs ?? []);
  const present = new Set<Channel>();
  const add = (id: OutputId, channel: Channel) => {
    if (ids.has(id)) present.add(channel);
  };
  add("ig_image", "instagram");
  add("ig_carousel", "instagram");
  add("whatsapp", "whatsapp");
  add("email", "email");
  return CHANNEL_ORDER.filter((channel) => present.has(channel));
}

function ChannelMarks({ pack }: { pack: Pack }) {
  const channels = channelsForPack(pack);
  if (!channels.length) {
    return (
      <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-white text-[var(--ai-primary)]">
        <Bookmark size={14} />
      </span>
    );
  }
  return (
    <span className="flex flex-none items-center -space-x-1.5" aria-hidden="true">
      {channels.map((channel, index) => (
        <span
          key={channel}
          className="relative grid h-6 w-6 place-items-center"
          style={{ zIndex: channels.length - index }}
        >
          <ChannelIcon channel={channel} size={18} />
        </span>
      ))}
    </span>
  );
}

export function SessionShelf({
  drafts,
  history,
  onOpenDraft,
  onOpenHistory,
  onViewAll,
}: {
  drafts: Draft[];
  history: HistoryEntry[];
  onOpenDraft: (draft: Draft) => void;
  onOpenHistory: (entry: HistoryEntry) => void;
  onViewAll: () => void;
}) {
  const recent = [
    ...drafts.map((draft) => ({ kind: "draft" as const, id: draft.id, name: draft.name, savedAt: draft.savedAt, draft })),
    ...history.map((entry) => ({ kind: "history" as const, id: entry.id, name: entry.name, savedAt: entry.savedAt, entry })),
  ]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, 4);

  return (
    <section className="card mb-4 overflow-hidden !border-[#e6defb] !bg-white" aria-label="Saved AI Studio sessions">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--ai-primary-soft)] text-[var(--ai-primary)] ring-1 ring-[#e4d8ff]">
            <Bookmark size={16} strokeWidth={2.4} />
          </span>
          <div>
            <h2 className="text-[14px] font-extrabold">Saved sessions</h2>
            <p className="text-[11.5px] text-[var(--text-muted)]">
              Continue a previous generation without losing its copy or images.
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-sm" onClick={onViewAll}>
          <FolderOpen size={14} /> View all
        </button>
      </div>
      {recent.length > 0 ? (
        <div className="space-y-2 p-3 sm:p-4">
          {recent.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              className="flex w-full min-w-0 items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-left transition-colors hover:border-[var(--ai-primary-ring)] hover:bg-[var(--ai-primary-soft)]"
              onClick={() => item.kind === "draft" ? onOpenDraft(item.draft) : onOpenHistory(item.entry)}
            >
              <span className="mt-0.5">
                <ChannelMarks pack={item.kind === "draft" ? item.draft.pack : item.entry.pack} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block line-clamp-2 text-[12.5px] font-bold leading-snug text-[var(--text)]">{item.name}</span>
                <span className="mt-1 block text-[11px] leading-tight text-[var(--text-soft)]">
                  {item.kind === "draft" ? "Draft" : "Generated"} · Saved {timeAgo(item.savedAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-4 text-[12px] text-[var(--text-muted)] sm:px-5">
          <FileText size={16} className="text-[var(--text-soft)]" />
          Your generated sessions will appear here. Save a pack as a draft to keep it ready for later.
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Focus helpers ------------------------------ */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useOverlayFocus(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && node) {
        const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const a = items[0];
        const b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener("keydown", h);
    return () => {
      document.removeEventListener("keydown", h);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/* ------------------------------ Modal ------------------------------ */

export function Modal({
  open,
  title,
  onClose,
  children,
  width = 460,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlayFocus(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="anim-fade-in fixed inset-0 z-[80] grid place-items-center bg-[#0f1535]/45 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-fade-up thin-scroll max-h-[90dvh] w-full overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-5 text-[var(--text)] shadow-[var(--shadow-pop)]"
        style={{ maxWidth: width }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-[16px] font-extrabold tracking-tight">{title}</h2>
          <button type="button" className="icon-btn -mr-1 -mt-1" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------ Drafts ------------------------------ */

function historyThumb(pack: Draft["pack"]) {
  return pack.carousel?.[0] ?? pack.image?.options[pack.image.selected] ?? null;
}

function PackThumb({ pack }: { pack: Draft["pack"] }) {
  const thumb = historyThumb(pack);
  return (
    <div className="h-14 w-14 flex-none overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)]">
      {thumb ? (
        <SlideArt slide={thumb} />
      ) : (
        <div className="grid h-full w-full place-items-center text-[var(--text-soft)]">
          <FileText size={20} />
        </div>
      )}
    </div>
  );
}

function PackMeta({ pack }: { pack: Draft["pack"] }) {
  return (
    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-soft)]">
      <span className="flex -space-x-1">
        {pack.instagram && <ChannelIcon channel="instagram" size={14} />}
        {pack.whatsapp && <ChannelIcon channel="whatsapp" size={14} />}
        {pack.email && <ChannelIcon channel="email" size={14} />}
      </span>
      {outputSummary(pack.outputs)}
    </p>
  );
}

export function DraftDrawer({
  open,
  drafts,
  history,
  onClose,
  onOpenDraft,
  onDeleteDraft,
  onOpenHistory,
  onDeleteHistory,
  onClearHistory,
  onNew,
}: {
  open: boolean;
  drafts: Draft[];
  history: HistoryEntry[];
  onClose: () => void;
  onOpenDraft: (d: Draft) => void;
  onDeleteDraft: (d: Draft) => void;
  onOpenHistory: (h: HistoryEntry) => void;
  onDeleteHistory: (h: HistoryEntry) => void;
  onClearHistory: () => void;
  onNew: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"drafts" | "history">("drafts");
  const [q, setQ] = useState("");
  useOverlayFocus(open, onClose, ref);
  if (!open) return null;
  const list = drafts.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()));
  const historyList = history.filter((h) => h.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="anim-fade-in fixed inset-0 z-[70] bg-[#0f1535]/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Saved AI Studio sessions"
        className="anim-slide-right absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-white text-[var(--text)] shadow-[var(--shadow-pop)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-[17px] font-extrabold tracking-tight">Saved sessions</h2>
            <p className="text-[12px] text-[var(--text-muted)]">Saved packs and every generation — pick up where you left off.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close drafts and history" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-subtle)] p-1" role="tablist" aria-label="Drafts and history">
            {(["drafts", "history"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`h-8 rounded-lg text-[12.5px] font-bold transition-colors ${tab === t ? "bg-white text-[var(--ai-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
              >
                {t === "drafts" ? `Drafts (${drafts.length})` : `History (${history.length})`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 px-5 pt-3">
          <div className="relative flex-1">
            <label htmlFor="draft-search" className="sr-only">
              Search
            </label>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" />
            <input id="draft-search" className="input !pl-9" placeholder={tab === "drafts" ? "Search drafts..." : "Search history..."} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button type="button" className="btn btn-primary" onClick={onNew}>
            <Plus size={16} /> New
          </button>
        </div>
        {tab === "drafts" ? (
          <ul className="thin-scroll mt-3 flex-1 space-y-2 overflow-y-auto px-5 pb-5">
            {list.length === 0 && (
              <li className="mt-10 text-center text-[13px] text-[var(--text-muted)]">
                <FileText className="mx-auto mb-2 text-[var(--text-soft)]" />
                {drafts.length === 0 ? "No drafts yet. Save a content pack to see it here." : "No drafts match your search."}
              </li>
            )}
            {list.map((d) => (
              <li key={d.id} className="group flex items-center gap-1 rounded-xl border border-[var(--border)] bg-white pr-1 transition-colors hover:border-[var(--ai-primary-ring)]">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left" onClick={() => onOpenDraft(d)} aria-label={`Open draft ${d.name}`}>
                  <PackThumb pack={d.pack} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{d.name}</p>
                    <PackMeta pack={d.pack} />
                    <p className="mt-0.5 text-[11px] text-[var(--text-soft)]">{timeAgo(d.savedAt)}</p>
                  </div>
                  <span className="pill bg-[var(--warning-soft)] text-[var(--warning)]">Draft</span>
                </button>
                <button type="button" className="icon-btn" aria-label={`Delete draft ${d.name}`} onClick={() => onDeleteDraft(d)}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {history.length > 0 && (
              <div className="flex justify-end px-5 pt-2">
                <button type="button" className="text-[11.5px] font-bold text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]" onClick={onClearHistory}>
                  Clear history
                </button>
              </div>
            )}
            <ul className="thin-scroll mt-1 flex-1 space-y-2 overflow-y-auto px-5 pb-5">
              {historyList.length === 0 && (
                <li className="mt-10 text-center text-[13px] text-[var(--text-muted)]">
                  <History className="mx-auto mb-2 text-[var(--text-soft)]" />
                  {history.length === 0 ? "Every generation is kept here automatically." : "Nothing matches your search."}
                </li>
              )}
              {historyList.map((h) => (
                <li key={h.id} className="group flex items-center gap-1 rounded-xl border border-[var(--border)] bg-white pr-1 transition-colors hover:border-[var(--ai-primary-ring)]">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left" onClick={() => onOpenHistory(h)} aria-label={`Open history entry ${h.name}`}>
                    <PackThumb pack={h.pack} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{h.name}</p>
                      <PackMeta pack={h.pack} />
                      <p className="mt-0.5 text-[11px] text-[var(--text-soft)]">{timeAgo(h.savedAt)}</p>
                    </div>
                    <span className="pill bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]">{h.origin === "handoff" ? "Handed off" : "Generated"}</span>
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Remove ${h.name} from history`} onClick={() => onDeleteHistory(h)}>
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
