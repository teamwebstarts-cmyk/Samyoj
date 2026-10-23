import { useEffect, useState } from "react";
import { Check, Lightbulb } from "lucide-react";
import { GENERATION_STEPS } from "./data/mock";
import { CreativeHub3d } from "./CreativeHub3d";

export function GenerationProgress({
  step,
  hasVisuals,
  onCancel,
  liveImages,
}: {
  step: number;
  hasVisuals: boolean;
  onCancel: () => void;
  liveImages?: boolean;
}) {
  const labels = GENERATION_STEPS.map((l, i) => (i === 1 && !hasVisuals ? "Structuring your templates" : l));
  const [animatedStep, setAnimatedStep] = useState(step);

  useEffect(() => {
    setAnimatedStep(step);
  }, [step]);

  useEffect(() => {
    if (!liveImages) return;
    const timer = window.setInterval(() => {
      setAnimatedStep((current) => Math.min(current + 1, labels.length - 1));
    }, 4200);
    return () => window.clearInterval(timer);
  }, [labels.length, liveImages]);

  const visibleStep = Math.min(Math.max(step, animatedStep), labels.length - 1);
  const details = [
    "Reading your brief and channels…",
    hasVisuals ? "Creating images and slides…" : "Shaping channel templates…",
    "Writing captions and copy…",
    "Almost ready…",
  ];
  const progress = Math.round(((visibleStep + 0.65) / labels.length) * 100);
  return (
    <div className="anim-fade-in mx-auto flex w-full max-w-[520px] flex-col items-center px-2 py-2 text-center">
      <CreativeHub3d />

      <h2 className="text-[22px] font-extrabold tracking-[-0.03em] text-[#15112e] sm:text-[26px]">
        Creating your <span className="bg-[linear-gradient(90deg,#7b46ea,#a06bff)] bg-clip-text text-transparent">content pack</span>
      </h2>
      <p className="mt-1.5 max-w-[360px] text-[13px] leading-snug text-[#6b628f]">
        Usually under a minute. You can stay here or come back later.
      </p>

      <ol className="mt-4 w-full max-w-[400px] text-left" aria-label="Generation progress" aria-valuenow={progress}>
        {labels.map((label, i) => {
          const done = i < visibleStep;
          const current = i === visibleStep;
          return (
            <li key={label} className="relative flex gap-2.5 pb-3.5 last:pb-0" aria-current={current ? "step" : undefined}>
              {i < labels.length - 1 && (
                <span className={`absolute left-[11px] top-7 h-[calc(100%-22px)] w-[2px] ${done ? "bg-[#7b46ea]" : "bg-[#e4dcf5]"}`} aria-hidden="true" />
              )}
              <span
                className={`relative z-10 mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full border-2 ${
                  done ? "border-[#7b46ea] bg-[#7b46ea] text-white" : current ? "border-[#7b46ea] bg-white shadow-[0_0_0_4px_rgba(123,70,234,0.12)]" : "border-[#ddd4ef] bg-white"
                }`}
              >
                {done ? <Check size={13} strokeWidth={3.5} /> : current ? <span className="anim-pulse h-2.5 w-2.5 rounded-full bg-[#7b46ea]" /> : null}
              </span>
              <span className="min-w-0">
                <span className={`block text-[13.5px] ${current || done ? "font-extrabold text-[#15112e]" : "font-bold text-[#9a93b3]"}`}>{label}</span>
                {current ? (
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-[#6b628f]">{details[i]}</span>
                ) : null}
              </span>
              <span className="sr-only">{done ? " — done" : current ? " — in progress" : " — waiting"}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-2 flex w-full max-w-[400px] items-start gap-2 rounded-xl border border-[#efe6c8] bg-[#fffaf0] px-3 py-2 text-left">
        <Lightbulb size={15} className="mt-0.5 flex-none text-[#e0a100]" />
        <p className="text-[11.5px] leading-snug text-[#6d6450]">
          <strong className="font-extrabold text-[#3d3420]">Tip:</strong> Safe to leave — we keep working in the background.
        </p>
      </div>

      <button type="button" className="btn btn-sm mt-3" onClick={onCancel}>
        Cancel and edit brief
      </button>
    </div>
  );
}
