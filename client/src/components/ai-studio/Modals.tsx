import { useState } from "react";
import { AlertCircle, Loader2, Settings, Sparkles } from "lucide-react";
import type { Channel, HandoffPayload } from "./data/types";
import { REFINE_SUGGESTIONS } from "./data/mock";
import { ChannelIcon } from "./brand";
import { Modal } from "./Overlays";

export interface HandoffState {
  channel: Channel;
  phase: "warning" | "opening";
  payload: HandoffPayload;
  openingText: string;
}

const CONNECT_NAME: Record<Channel, string> = { instagram: "Instagram", whatsapp: "WhatsApp", email: "Gmail" };

export function HandoffModal({
  state,
  onClose,
  onConnect,
}: {
  state: HandoffState | null;
  onClose: () => void;
  onConnect: (c: Channel) => void;
}) {
  if (!state) return null;
  const { channel, phase, payload } = state;
  return (
    <Modal open title={phase === "warning" ? `${CONNECT_NAME[channel]} isn't connected` : payload.destination} onClose={onClose} width={440}>
      {phase === "warning" && (
        <div className="text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--warning-soft)] text-[var(--warning)]">
            <AlertCircle size={24} />
          </span>
          <p className="text-[14px] font-bold" role="alert">
            {CONNECT_NAME[channel]} isn't connected.
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">Connect {CONNECT_NAME[channel]} in Settings to use this content there. Your content pack stays here in Studio.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn" onClick={onClose}>
              Not now
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onConnect(channel)} data-autofocus>
              <Settings size={15} /> Connect {CONNECT_NAME[channel]} in Settings
            </button>
          </div>
        </div>
      )}
      {phase === "opening" && (
        <div className="flex flex-col items-center py-4 text-center" role="status">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-subtle)]">
            <ChannelIcon channel={channel} size={32} />
          </span>
          <p className="flex items-center gap-2 text-[14px] font-bold">
            <Loader2 size={16} className="spin text-[var(--ai-primary)]" /> {state.openingText}
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">Preparing your content — taking you there…</p>
        </div>
      )}
    </Modal>
  );
}

export function RefineModal({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (instruction: string) => void }) {
  const [text, setText] = useState("");
  return (
    <Modal open={open} title="Refine with AI" onClose={onClose} width={480}>
      <p className="text-[13px] text-[var(--text-muted)]">Tell us what to change. We'll rewrite the copy for each channel and keep your visuals as they are.</p>
      <label htmlFor="refine-input" className="field-label mt-4">
        What would you like to change?
      </label>
      <textarea id="refine-input" data-autofocus className="input !min-h-[84px]" placeholder="e.g. Make it shorter and add urgency" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REFINE_SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-[12px] font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--ai-primary)] hover:bg-[var(--ai-primary-soft)] hover:text-[var(--ai-primary)]" onClick={() => setText(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            onApply(text.trim() || "Warmer and friendlier");
            setText("");
          }}
        >
          <Sparkles size={15} /> Refine copy
        </button>
      </div>
    </Modal>
  );
}

export function NewPackModal({
  open,
  onClose,
  onDiscard,
  onSaveAndNew,
}: {
  open: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSaveAndNew: () => void;
}) {
  return (
    <Modal open={open} title="Start a new content pack?" onClose={onClose}>
      <p className="text-[13px] text-[var(--text-muted)]">This content pack isn't saved yet. Save it as a draft to keep your edits.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={onDiscard}>
          Discard &amp; start new
        </button>
        <button type="button" className="btn btn-primary" onClick={onSaveAndNew} data-autofocus>
          Save draft &amp; start new
        </button>
      </div>
    </Modal>
  );
}
