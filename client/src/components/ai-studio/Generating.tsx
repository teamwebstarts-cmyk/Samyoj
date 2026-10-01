import { AlertTriangle, Check, RefreshCw, Sparkles, Pencil } from "lucide-react";
import { GENERATION_STEPS } from "./data/mock";
import { GmailIcon, InstagramIcon, WhatsAppIcon } from "./brand";

export function GenerationProgress({ step, hasVisuals, onCancel }: { step: number; hasVisuals: boolean; onCancel: () => void }) {
  const labels = GENERATION_STEPS.map((l, i) => (i === 1 && !hasVisuals ? "Structuring your templates" : l));
  return (
    <div className="anim-fade-in mx-auto flex max-w-[560px] flex-col items-center px-2 pb-6 pt-6 text-center sm:pt-12">
      <div className="relative mb-6 h-[170px] w-[240px]" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ece3ff]" />
        <div className="anim-pulse absolute left-1/2 top-1/2 grid h-[84px] w-[84px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#7a4af5,#a67cff)" }}>
          <Sparkles size={34} />
        </div>
        <div className="absolute left-[24px] top-[22px] grid h-11 w-11 -rotate-6 place-items-center rounded-xl bg-white shadow-[0_8px_20px_rgba(15,21,53,0.14)]">
          <InstagramIcon size={26} />
        </div>
        <div className="absolute right-[24px] top-[14px] grid h-11 w-11 rotate-6 place-items-center rounded-xl bg-white shadow-[0_8px_20px_rgba(15,21,53,0.14)]">
          <WhatsAppIcon size={26} />
        </div>
        <div className="absolute bottom-[14px] right-[34px] grid h-11 w-11 rotate-3 place-items-center rounded-xl bg-white shadow-[0_8px_20px_rgba(15,21,53,0.14)]">
          <GmailIcon size={26} />
        </div>
      </div>

      <h2 className="text-[26px] font-extrabold tracking-tight">Creating your content pack...</h2>
      <p className="mt-2 max-w-[400px] text-[14px] leading-relaxed text-[var(--text-muted)]">
        This may take a few moments. We're generating visuals and channel-ready copy for you.
      </p>

      <ol className="card mt-7 w-full max-w-[400px] space-y-0 p-5 text-left" aria-label="Generation progress">
        {labels.map((l, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={l} className="relative flex items-center gap-3 pb-5 last:pb-0" aria-current={current ? "step" : undefined}>
              {i < labels.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-18px)] w-[2px] ${done ? "bg-[var(--ai-primary)]" : "bg-[var(--border)]"}`} aria-hidden="true" />}
              <span
                className={`relative z-10 grid h-6 w-6 flex-none place-items-center rounded-full border-2 transition-colors duration-200 ${
                  done ? "border-[var(--ai-primary)] bg-[var(--ai-primary)] text-white" : current ? "border-[var(--ai-primary)] bg-white" : "border-[var(--border-strong)] bg-white"
                }`}
              >
                {done ? <Check size={13} strokeWidth={3.5} /> : current ? <span className="anim-pulse h-2.5 w-2.5 rounded-full bg-[var(--ai-primary)]" /> : null}
              </span>
              <span className={`text-[14px] transition-colors ${current ? "font-bold text-[var(--text)]" : done ? "font-semibold text-[var(--text)]" : "text-[var(--text-soft)]"}`}>{l}</span>
              <span className="sr-only">{done ? " — done" : current ? " — in progress" : " — waiting"}</span>
            </li>
          );
        })}
      </ol>

      <button type="button" className="btn btn-sm mt-6" onClick={onCancel}>
        Cancel and edit brief
      </button>
    </div>
  );
}

export function GenerationError({ onRetry, onEdit, hint }: { onRetry: () => void; onEdit: () => void; hint?: string }) {
  return (
    <div className="anim-fade-up mx-auto flex max-w-[460px] flex-col items-center px-2 pt-12 text-center">
      <span className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
        <AlertTriangle size={28} />
      </span>
      <h2 className="text-[22px] font-extrabold tracking-tight" role="alert">
        We couldn't create the content pack.
      </h2>
      <p className="mt-2 text-[14px] text-[var(--text-muted)]">Try generating again. Your idea, photos and selections are still here.</p>
      {hint && <p className="mt-3 rounded-xl bg-[var(--surface-subtle)] px-3 py-2 text-[12.5px] leading-snug text-[var(--text-muted)]">{hint}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn btn-primary btn-lg" onClick={onRetry} data-autofocus>
          <RefreshCw size={16} /> Try again
        </button>
        <button type="button" className="btn btn-lg" onClick={onEdit}>
          <Pencil size={16} /> Edit brief
        </button>
      </div>
    </div>
  );
}
