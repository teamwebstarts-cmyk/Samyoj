import { useState } from "react";
import type { ReactNode } from "react";
import { Bookmark, Check, ChevronRight, Copy, ExternalLink, Image as ImageIcon, Link2, Pencil, RefreshCw } from "lucide-react";
import type { Channel, Pack } from "./data/types";
import { IG_LIMIT, regenerateCopy } from "./data/mock";
import { copyToClipboard } from "../../utils/aiStudioClipboard";
import { ChannelIcon } from "./brand";
import { SlideArt } from "./SlideArt";

interface Props {
  pack: Pack;
  update: (fn: (p: Pack) => Pack) => void;
  onHandoff: (c: Channel) => void;
  onToast: (m: string, tone?: "success" | "info" | "error") => void;
}

function CardShell({
  channel,
  title,
  badge,
  subtitle,
  editing,
  onToggleEdit,
  onRegen,
  regenLabel,
  children,
  footer,
}: {
  channel: Channel;
  title: string;
  badge?: string;
  subtitle?: string;
  editing: boolean;
  onToggleEdit: () => void;
  onRegen: () => void;
  regenLabel: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const [spin, setSpin] = useState(false);
  return (
    <section className="card flex min-w-0 flex-col p-4" aria-label={title}>
      <header className="mb-3 flex items-center gap-2.5">
        <ChannelIcon channel={channel} size={26} />
        <div className="min-w-0 flex-1 leading-tight">
          <h3 className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-extrabold">
            {title}
            {badge && <span className="pill !h-[18px] bg-[var(--surface-subtle)] !text-[10px] text-[var(--text-muted)]">{badge}</span>}
          </h3>
          {subtitle && <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={regenLabel}
          title="Regenerate copy"
          onClick={() => {
            setSpin(true);
            window.setTimeout(() => {
              onRegen();
              setSpin(false);
            }, 600);
          }}
        >
          <RefreshCw size={15} className={spin ? "spin" : ""} />
        </button>
        <button type="button" className={`btn btn-sm ${editing ? "btn-soft" : ""}`} aria-pressed={editing} onClick={onToggleEdit}>
          {editing ? <Check size={13} /> : <Pencil size={13} />} {editing ? "Done" : "Edit"}
        </button>
      </header>
      <div className={`flex-1 transition-opacity ${spin ? "opacity-40" : ""}`}>{children}</div>
      <footer className="mt-3 flex gap-2">{footer}</footer>
    </section>
  );
}

async function copyWithToast(text: string, onToast: Props["onToast"]) {
  const ok = await copyToClipboard(text);
  onToast(ok ? "Copied to clipboard" : "Couldn't copy. Select the text and copy manually.", ok ? "success" : "error");
}

const readBox = "whitespace-pre-wrap break-words rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5 text-[12.5px] leading-[1.55]";

/* ------------------------------ Instagram ------------------------------ */

export function InstagramCopyCard({ pack, update, onHandoff, onToast }: Props) {
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"caption" | "hashtags">("caption");
  const ig = pack.instagram!;
  const total = ig.caption.length + (ig.hashtags ? 2 + ig.hashtags.length : 0);
  const over = total > IG_LIMIT;
  const kind = pack.carousel && pack.image ? "Carousel + Image" : pack.carousel ? "Carousel" : "Image";

  const set = (patch: Partial<typeof ig>) => update((p) => ({ ...p, instagram: { ...p.instagram!, ...patch } }));

  return (
    <CardShell
      channel="instagram"
      title="Instagram"
      subtitle={`Post Copy (${kind})`}
      editing={editing}
      onToggleEdit={() => setEditing((e) => !e)}
      regenLabel="Regenerate Instagram copy"
      onRegen={() => {
        update((p) => regenerateCopy(p, "instagram"));
        onToast("Instagram copy regenerated");
      }}
      footer={
        <>
          <button type="button" className="btn btn-primary flex-1" onClick={() => onHandoff("instagram")}>
            <ExternalLink size={14} /> Use in Posts
          </button>
          <button
            type="button"
            className="btn flex-1"
            onClick={() => void copyWithToast(`${ig.caption}\n\n${ig.hashtags}`.trim(), onToast)}
          >
            <Copy size={14} /> Copy
          </button>
        </>
      }
    >
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-[var(--surface-subtle)] p-1" role="tablist" aria-label="Instagram copy sections">
        {(["caption", "hashtags"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-7 rounded-md text-[12px] font-bold capitalize transition-colors ${tab === t ? "bg-white text-[var(--ai-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {t}
          </button>
        ))}
      </div>
      {editing ? (
        <textarea
          className="input !min-h-[190px]"
          aria-label={tab === "caption" ? "Instagram caption" : "Instagram hashtags"}
          value={tab === "caption" ? ig.caption : ig.hashtags}
          onChange={(e) => set(tab === "caption" ? { caption: e.target.value } : { hashtags: e.target.value })}
        />
      ) : (
        <div className={`${readBox} min-h-[190px]`}>{(tab === "caption" ? ig.caption : ig.hashtags) || <span className="text-[var(--text-soft)]">Nothing here yet.</span>}</div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-[var(--text-muted)]">Starting caption — refine with Magic in Instagram Posts.</span>
        <span className={`flex-none font-semibold ${over ? "text-[var(--danger)]" : "text-[var(--text-soft)]"}`}>
          {total}/{IG_LIMIT}
        </span>
      </div>
    </CardShell>
  );
}

/* ------------------------------ WhatsApp ------------------------------ */

function waHeaderSlide(pack: Pack) {
  return pack.carousel?.[0] ?? pack.image?.options[pack.image.selected] ?? null;
}

export function WhatsAppTemplateCard({ pack, update, onHandoff, onToast }: Props) {
  const [editing, setEditing] = useState(false);
  const t = pack.whatsapp!;
  const thumb = waHeaderSlide(pack);
  const vars = Array.from(new Set(Array.from(t.body.matchAll(/\{\{(\d+)\}\}/g)).map((m) => m[1])));
  const set = (patch: Partial<typeof t>) => update((p) => ({ ...p, whatsapp: { ...p.whatsapp!, ...patch } }));
  const row = "grid grid-cols-[62px_minmax(0,1fr)] gap-2 border-t border-[var(--border)] py-2.5 first:border-t-0";
  const lbl = "pt-0.5 text-[11.5px] font-bold text-[var(--text-muted)]";

  const asText = () =>
    [`[Header] ${t.header.source}`, t.body, t.footer && `— ${t.footer}`, t.buttons.map((b) => `[Button] ${b.label} → ${b.url}`).join("\n")].filter(Boolean).join("\n\n");

  return (
    <CardShell
      channel="whatsapp"
      title="WhatsApp Template"
      badge={t.category}
      subtitle="Draft structure — finalise in Templates"
      editing={editing}
      onToggleEdit={() => setEditing((e) => !e)}
      regenLabel="Regenerate WhatsApp template copy"
      onRegen={() => {
        update((p) => regenerateCopy(p, "whatsapp"));
        onToast("WhatsApp template regenerated");
      }}
      footer={
        <>
          <button type="button" className="btn btn-primary flex-1" onClick={() => onHandoff("whatsapp")}>
            <ExternalLink size={14} /> Open in Templates
          </button>
          <button type="button" className="btn flex-1" onClick={() => void copyWithToast(asText(), onToast)}>
            <Copy size={14} /> Copy
          </button>
        </>
      }
    >
      <div>
        <div className={row}>
          <span className={lbl}>Header</span>
          <div className="flex items-center gap-2 text-[12.5px]">
            <div className="h-9 w-9 flex-none overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)]">
              {thumb ? <SlideArt slide={thumb} label="Header image" /> : <ImageIcon size={16} className="m-2.5 text-[var(--text-soft)]" />}
            </div>
            <span className="min-w-0 truncate font-semibold">{t.header.source}</span>
          </div>
        </div>
        <div className={row}>
          <span className={lbl}>Body</span>
          <div>
            {editing ? (
              <>
                <textarea className="input !min-h-[130px]" aria-label="WhatsApp body" maxLength={1024} value={t.body} onChange={(e) => set({ body: e.target.value })} />
                <p className="mt-1 text-right text-[11px] text-[var(--text-soft)]">{t.body.length}/1024</p>
              </>
            ) : (
              <div className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.55]">{t.body}</div>
            )}
            {vars.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                <span className="text-[var(--text-muted)]">Example values:</span>
                {vars.map((v) =>
                  editing ? (
                    <label key={v} className="inline-flex items-center gap-1">
                      <span className="rounded bg-[var(--ai-primary-soft)] px-1.5 py-0.5 font-bold text-[var(--ai-primary)]">{`{{${v}}}`}</span>
                      <input className="input !h-7 !w-[90px] !text-[12px]" aria-label={`Example value for {{${v}}}`} value={t.examples[v] ?? ""} onChange={(e) => set({ examples: { ...t.examples, [v]: e.target.value } })} />
                    </label>
                  ) : (
                    <span key={v} className="inline-flex items-center gap-1 rounded-md bg-[var(--ai-primary-soft)] px-1.5 py-0.5 font-semibold text-[var(--ai-primary)]">
                      {`{{${v}}}`} = {t.examples[v] || "—"}
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
        <div className={row}>
          <span className={lbl}>
            Footer
            <br />
            <span className="font-medium text-[var(--text-soft)]">(optional)</span>
          </span>
          {editing ? (
            <div>
              <input className="input" aria-label="WhatsApp footer" maxLength={60} value={t.footer} onChange={(e) => set({ footer: e.target.value })} />
              <p className="mt-1 text-right text-[11px] text-[var(--text-soft)]">{t.footer.length}/60</p>
            </div>
          ) : (
            <span className="text-[12.5px] text-[var(--text-muted)]">{t.footer || "—"}</span>
          )}
        </div>
        <div className={row}>
          <span className={lbl}>Buttons</span>
          <ul className="space-y-1.5">
            {t.buttons.map((b, i) => (
              <li key={b.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12.5px] font-semibold">
                <Link2 size={14} className="flex-none text-[var(--ai-primary)]" />
                {editing ? (
                  <input
                    className="input !h-7 min-w-0 flex-1 !border-transparent !bg-transparent !px-1 !text-[12.5px]"
                    aria-label={`Button ${i + 1} label`}
                    maxLength={25}
                    value={b.label}
                    onChange={(e) => set({ buttons: t.buttons.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)) })}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate">{b.label}</span>
                )}
                <span className="rounded bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">URL</span>
                <ChevronRight size={14} className="flex-none text-[var(--text-soft)]" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CardShell>
  );
}

/* ------------------------------ Email ------------------------------ */

export function EmailCopyCard({ pack, update, onHandoff, onToast }: Props) {
  const [editing, setEditing] = useState(false);
  const [tplSaved, setTplSaved] = useState(false);
  const e = pack.email!;
  const set = (patch: Partial<typeof e>) => {
    setTplSaved(false);
    update((p) => ({ ...p, email: { ...p.email!, ...patch } }));
  };

  return (
    <CardShell
      channel="email"
      title="Email Copy"
      subtitle="Subject + Body"
      editing={editing}
      onToggleEdit={() => setEditing((x) => !x)}
      regenLabel="Regenerate email copy"
      onRegen={() => {
        update((p) => regenerateCopy(p, "email"));
        setTplSaved(false);
        onToast("Email copy regenerated");
      }}
      footer={
        <>
          <button type="button" className="btn btn-primary flex-1" onClick={() => onHandoff("email")}>
            <ExternalLink size={14} /> Use in Email
          </button>
          <button type="button" className="btn flex-1" onClick={() => void copyWithToast(`Subject: ${e.subject}\n\n${e.body}`, onToast)}>
            <Copy size={14} /> Copy
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <span className="mb-1 block text-[11.5px] font-bold text-[var(--text-muted)]">Subject</span>
          {editing ? (
            <input className="input" aria-label="Email subject" value={e.subject} onChange={(ev) => set({ subject: ev.target.value })} />
          ) : (
            <p className="text-[12.5px] font-semibold leading-snug">{e.subject}</p>
          )}
        </div>
        <div>
          <span className="mb-1 block text-[11.5px] font-bold text-[var(--text-muted)]">Body</span>
          {editing ? (
            <textarea className="input !min-h-[210px]" aria-label="Email body" value={e.body} onChange={(ev) => set({ body: ev.target.value })} />
          ) : (
            <div className={`${readBox} thin-scroll max-h-[240px] min-h-[190px] overflow-y-auto`}>{e.body}</div>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--ai-primary)] hover:underline"
          onClick={() => {
            setTplSaved(true);
            onToast(`Saved as email template: “${pack.name}”`);
          }}
        >
          {tplSaved ? <Check size={14} /> : <Bookmark size={14} />} {tplSaved ? "Saved as email template" : "Save as email template"}
        </button>
      </div>
    </CardShell>
  );
}
