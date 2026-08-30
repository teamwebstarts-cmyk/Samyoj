import { useMemo, useState, type CSSProperties } from 'react';
import AppButton from '../ui/AppButton';
import InfoTip from '../ui/InfoTip';
import type { AiCreditsResponse } from '../../types';
import {
  AI_CALLING_FLEX_SKU_ID,
  AI_CHAT_FLEX_SKU_ID,
  FLEX_CALLING_PACK_INR,
  FLEX_CHAT_PACK_INR,
  FLEX_TOPUP_MAX_INR,
  FLEX_TOPUP_MIN_INR,
  quoteFlexTopup,
  type FlexAiPool,
} from '../../utils/flexAiTopup';

interface AiAddonGridProps {
  aiCredits: AiCreditsResponse | null;
  canManage: boolean;
  razorpayConfigured: boolean;
  purchasingSku: string | null;
  onPurchase: (pool: FlexAiPool, spendInr: number) => void;
  canPurchaseChat?: boolean;
  canPurchaseCalling?: boolean;
}

const SPEND_MARKS = [10, 250, 500, 750, 1000] as const;

function ChatCreditMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5.2 7.1A3.8 3.8 0 0 1 9 3.4h6.2A3.8 3.8 0 0 1 19 7.1v5.6A3.8 3.8 0 0 1 15.2 16.5H12.1L8.2 19.4c-.65.48-1.6.02-1.6-.78v-2.12H9A3.8 3.8 0 0 1 5.2 12.7V7.1Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 8.4h6.6M8.6 11.7h4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M17.05 3.35 17.7 4.85 19.2 5.5 17.7 6.15 17.05 7.65 16.4 6.15 14.9 5.5 16.4 4.85Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CallingMinuteMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M8.05 4.15c.38-.52 1.08-.68 1.64-.38l1.72 0.94c.52.28.76.9.56 1.46l-.7 1.92c-.14.38-.04.8.26 1.08 1.08 1.05 2.32 1.98 3.62 2.72.36.2.8.24 1.2.1l2.04-.7c.56-.2 1.2.08 1.48.6l.94 1.72c.3.56.16 1.26-.34 1.64l-1.42 1.08c-.86.66-2.04.82-3.08.4-3.4-1.38-6.28-3.92-8.22-7.42C6.4 7.7 6 5.7 6.28 4.55c.16-.66.64-1.2 1.28-1.4Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M15.85 4.35c1.55 1.05 2.72 2.55 3.28 4.28M17.35 6.05c.92.78 1.6 1.82 1.95 2.98"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FlexTopupCard({
  pool,
  minInr,
  maxInr,
  packUnits,
  packInclGstInr,
  canManage,
  razorpayConfigured,
  canPurchase,
  loading,
  onPurchase,
}: {
  pool: FlexAiPool;
  minInr: number;
  maxInr: number;
  packUnits: number;
  packInclGstInr: number;
  canManage: boolean;
  razorpayConfigured: boolean;
  canPurchase: boolean;
  loading: boolean;
  onPurchase: (spendInr: number) => void;
}) {
  const isCalling = pool === 'calling';
  const [spendInr, setSpendInr] = useState(isCalling ? FLEX_CALLING_PACK_INR : FLEX_CHAT_PACK_INR);
  const quote = useMemo(
    () => quoteFlexTopup(pool, spendInr, { packUnits, packInclGstInr, minInr, maxInr }),
    [pool, spendInr, packUnits, packInclGstInr, minInr, maxInr]
  );
  const fillPct = ((quote.spendInr - minInr) / (maxInr - minInr)) * 100;
  const unitLabel = isCalling ? (quote.units === 1 ? 'minute' : 'minutes') : 'credits';
  const Icon = isCalling ? CallingMinuteMark : ChatCreditMark;

  return (
    <article
      className={
        isCalling
          ? 'ai-flex-card ai-flex-card--calling flex h-full flex-col overflow-hidden rounded-[28px] border border-[#c9ddd6] bg-[linear-gradient(165deg,#f3faf7_0%,#ffffff_42%,#eef6f3_100%)] p-5 shadow-[0_18px_40px_-28px_rgba(18,53,47,0.55)] dark:border-[#1f4a43] dark:bg-[linear-gradient(165deg,#0f2a27_0%,#102826_48%,#0c1f1d_100%)]'
          : 'ai-flex-card ai-flex-card--chat flex h-full flex-col overflow-hidden rounded-[28px] border border-[#e4d6a8] bg-[linear-gradient(165deg,#fbf6ea_0%,#ffffff_42%,#f7f1e2_100%)] p-5 shadow-[0_18px_40px_-28px_rgba(27,22,51,0.5)] dark:border-[#3d3558] dark:bg-[linear-gradient(165deg,#1b1633_0%,#221c3d_48%,#16122b_100%)]'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={
              isCalling
                ? 'text-[11px] font-bold uppercase tracking-[0.22em] text-[#2f6f64] dark:text-[#9ad4c8]'
                : 'text-[11px] font-bold uppercase tracking-[0.22em] text-[#8a6a16] dark:text-[#e4c15a]'
            }
          >
            {isCalling ? 'AI Calling' : 'AI Chat Agent'}
          </p>
          <p className="mt-1 text-lg font-extrabold tracking-tight text-theme-fg">
            {isCalling ? 'Calling minutes' : 'Chat credits'}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 dark:bg-emerald-500">
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-6 flex items-end gap-2">
        <p className="font-black tabular-nums leading-none tracking-tight text-theme-fg text-[2.65rem] sm:text-5xl">
          {quote.units.toLocaleString('en-IN')}
        </p>
        <p className="mb-1 text-sm font-semibold text-theme-muted">{unitLabel}</p>
      </div>
      <p className="mt-2 text-[13px] font-medium leading-snug text-theme-muted">
        {isCalling
          ? 'Extra calling minutes added after payment. Unused minutes stay until you use them.'
          : 'Extra chat credits added after payment. Unused credits stay until you use them.'}
      </p>

      <div className="mt-7">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-theme-muted">
            You pay
          </p>
          <p className="text-xl font-black tabular-nums text-theme-fg">
            ₹{quote.spendInr.toLocaleString('en-IN')}
            <span className="ml-1.5 text-[11px] font-semibold text-theme-muted">incl. GST</span>
          </p>
        </div>

        <div
          className="ai-flex-rail-wrap relative h-8"
          style={
            {
              '--ai-flex-fill': `${fillPct}%`,
              '--ai-flex-ink': isCalling ? '#d4784a' : '#e4c15a',
              '--ai-flex-track': isCalling ? '#d7ebe4' : '#efe4c4',
            } as CSSProperties
          }
        >
          <input
            type="range"
            min={minInr}
            max={maxInr}
            step={1}
            value={quote.spendInr}
            aria-valuemin={minInr}
            aria-valuemax={maxInr}
            aria-valuenow={quote.spendInr}
            aria-label={
              isCalling
                ? `Spend rupees on AI calling minutes, currently ₹${quote.spendInr}`
                : `Spend rupees on AI chat credits, currently ₹${quote.spendInr}`
            }
            className="ai-flex-rail absolute inset-0 z-10 w-full cursor-pointer"
            onChange={(event) => setSpendInr(Number(event.target.value))}
          />
        </div>

        <div className="mt-2 flex justify-between">
          {SPEND_MARKS.map((mark) => (
            <button
              key={mark}
              type="button"
              className="rounded-md px-0.5 text-[11px] font-semibold tabular-nums text-theme-muted transition hover:text-theme-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              onClick={() => setSpendInr(mark)}
            >
              ₹{mark.toLocaleString('en-IN')}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[12px] font-medium leading-snug text-theme-muted">
        {isCalling
          ? `₹${packInclGstInr.toLocaleString('en-IN')} buys ${packUnits.toLocaleString('en-IN')} minutes. Same rate at every rupee.`
          : `₹${packInclGstInr.toLocaleString('en-IN')} buys ${packUnits.toLocaleString('en-IN')} credits. Same rate at every rupee.`}
      </p>

      <div className="mt-5">
        <AppButton
          size="sm"
          variant="secondary"
          fullWidth
          disabled={!canManage || !razorpayConfigured || !canPurchase}
          title={!canPurchase ? 'This AI capability is not included on your plan.' : undefined}
          loading={loading}
          onClick={() => onPurchase(quote.spendInr)}
        >
          Buy add-on
        </AppButton>
      </div>
    </article>
  );
}

export default function AiAddonGrid({
  aiCredits,
  canManage,
  razorpayConfigured,
  purchasingSku,
  onPurchase,
  canPurchaseChat = true,
  canPurchaseCalling = true,
}: AiAddonGridProps) {
  const flex = aiCredits?.flexTopup;
  const minInr = flex?.minInr ?? FLEX_TOPUP_MIN_INR;
  const maxInr = flex?.maxInr ?? FLEX_TOPUP_MAX_INR;

  return (
    <div id="ai-addons" className="space-y-5 scroll-mt-24">
      <div>
        <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
          Need more credits or minutes?
        </h3>
        <div className="mt-1 flex max-w-2xl items-start gap-1.5 text-[12px] font-medium text-theme-muted">
          <p>
            Included chat credits and calling minutes reset each billing cycle. Slide to the amount
            you want to spend — one-time manual purchases stay on your account until used.
          </p>
          <InfoTip
            label="About manual AI top-ups"
            content="Top-ups are one-time manual purchases. They do not renew automatically, and customers cannot subscribe to or cancel a recurring AI add-on."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FlexTopupCard
          pool="chat"
          minInr={minInr}
          maxInr={maxInr}
          packUnits={flex?.chat.packUnits ?? 1_000}
          packInclGstInr={flex?.chat.packInclGstInr ?? FLEX_CHAT_PACK_INR}
          canManage={canManage}
          razorpayConfigured={razorpayConfigured}
          canPurchase={canPurchaseChat}
          loading={purchasingSku === AI_CHAT_FLEX_SKU_ID}
          onPurchase={(spendInr) => onPurchase('chat', spendInr)}
        />
        <FlexTopupCard
          pool="calling"
          minInr={minInr}
          maxInr={maxInr}
          packUnits={flex?.calling.packUnits ?? 30}
          packInclGstInr={flex?.calling.packInclGstInr ?? FLEX_CALLING_PACK_INR}
          canManage={canManage}
          razorpayConfigured={razorpayConfigured}
          canPurchase={canPurchaseCalling}
          loading={purchasingSku === AI_CALLING_FLEX_SKU_ID}
          onPurchase={(spendInr) => onPurchase('calling', spendInr)}
        />
      </div>

      <style>{`
        .ai-flex-rail-wrap {
          --ai-flex-fill: 0%;
          --ai-flex-ink: #e4c15a;
          --ai-flex-track: #efe4c4;
        }
        .dark .ai-flex-card--chat {
          --tw-shadow-color: rgba(228, 193, 90, 0.12);
        }
        .ai-flex-rail {
          -webkit-appearance: none;
          appearance: none;
          height: 14px;
          margin: auto 0;
          border-radius: 999px;
          background: linear-gradient(
            to right,
            var(--ai-flex-ink) 0%,
            var(--ai-flex-ink) var(--ai-flex-fill),
            var(--ai-flex-track) var(--ai-flex-fill),
            var(--ai-flex-track) 100%
          );
          outline: none;
        }
        .dark .ai-flex-card--calling .ai-flex-rail {
          --ai-flex-track: #1d3f3a;
        }
        .dark .ai-flex-card--chat .ai-flex-rail {
          --ai-flex-track: #2c2548;
        }
        .ai-flex-rail:focus-visible {
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.35);
        }
        .ai-flex-rail::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #fffaf0;
          border: 3px solid var(--ai-flex-ink);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
          cursor: pointer;
        }
        .ai-flex-rail::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #fffaf0;
          border: 3px solid var(--ai-flex-ink);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
          cursor: pointer;
        }
        .ai-flex-rail::-moz-range-track {
          height: 14px;
          background: transparent;
        }
        @media (prefers-reduced-motion: reduce) {
          .ai-flex-rail::-webkit-slider-thumb,
          .ai-flex-rail::-moz-range-thumb {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
