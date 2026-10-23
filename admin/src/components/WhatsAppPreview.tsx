import type { Draft } from '../lib/library-catalog';

/**
 * Live WhatsApp chat mock fed by a template draft.
 * Shared by the editor page (sticky aside) and the catalog "View" drawer.
 */
export function WhatsAppPreview({ draft }: { draft: Draft }) {
  const hindi = draft.language === 'hi_IN';
  const body = ((hindi ? draft.bodyHi : draft.body) || '').replace(/\{\{(\d+)\}\}/g, (_m, index: string) => {
    const sample = draft.bodyExamples[Number.parseInt(index, 10) - 1];
    return sample || `{{${index}}}`;
  });
  return (
    <div className="overflow-hidden rounded-xl bg-[#efeae2] shadow-sm ring-1 ring-slate-900/10">
      <div className="flex items-center gap-2.5 bg-[#0b7d6f] px-3 py-2.5 text-white">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
          {(draft.title || 'S').slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="flex items-center gap-1 truncate text-[13px] font-semibold">
            <span className="truncate">{draft.title || 'Samyoj Business'}</span>
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-sky-300" aria-hidden />
          </p>
          <p className="text-[10px] text-white/75">Business Account</p>
        </div>
        <span className="text-base leading-none" aria-hidden>⋮</span>
      </div>
      <div className="p-3">
        <div className="min-h-40 space-y-2 rounded-lg bg-[#efeae2] p-3">
          {body ? (
            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-slate-800">{body}</p>
              {draft.footer ? <p className="mt-1.5 text-[11px] text-slate-400">{draft.footer}</p> : null}
            </div>
          ) : (
            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white/70 px-3 py-2.5 text-[13px] italic text-slate-400 shadow-sm">
              Your message will appear here…
            </div>
          )}
          {draft.buttonText && draft.buttonUrl ? (
            <div className="max-w-[85%] rounded-lg bg-white px-3 py-2 text-center text-[12px] font-semibold text-sky-700 shadow-sm">
              {draft.buttonText} ↗
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
