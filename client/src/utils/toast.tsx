import type { CSSProperties } from 'react';
import toast, { Toaster, type ToastOptions } from 'react-hot-toast';
import { Bot, Star } from 'lucide-react';
import { sanitizeUserErrorMessage } from './errors';

function isDark() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

function baseStyle(): CSSProperties {
  const dark = isDark();
  return {
    borderRadius: '10px',
    padding: '7px 12px',
    fontSize: '12.5px',
    fontWeight: 600,
    lineHeight: 1.35,
    boxShadow: dark ? '0 8px 24px rgba(0, 0, 0, 0.4)' : '0 8px 22px rgba(15, 23, 42, 0.1)',
    maxWidth: 'min(360px, calc(100vw - 32px))',
    whiteSpace: 'nowrap',
  };
}

const sharedOptions: ToastOptions = {
  duration: 2800,
};

function getToastPosition(): ToastOptions['position'] {
  return 'top-center';
}

function toastContainerStyle(): CSSProperties {
  return {
    top: 20,
    zIndex: 10050,
  };
}

export function toastSuccess(message: string, options?: Partial<ToastOptions>) {
  const dark = isDark();
  return toast.success(message, {
    ...sharedOptions,
    position: getToastPosition(),
    ...options,
    style: {
      ...baseStyle(),
      background: dark ? 'rgba(6, 78, 59, 0.95)' : 'rgba(236, 253, 245, 0.98)',
      color: dark ? '#a7f3d0' : '#065f46',
      border: dark ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(167, 243, 208, 0.9)',
      ...options?.style,
    },
    iconTheme: {
      primary: '#059669',
      secondary: dark ? '#064e3b' : '#ecfdf5',
    },
  });
}

/** Meta refused a feature. Wraps so the reason is readable, unlike the one-line error toast. */
export function toastMetaBlock(message: string) {
  return toastError(message, {
    duration: 9000,
    style: {
      whiteSpace: 'normal',
      maxWidth: 'min(440px, calc(100vw - 32px))',
    },
  });
}

export function toastError(message: string, options?: Partial<ToastOptions>) {
  const dark = isDark();
  return toast.error(sanitizeUserErrorMessage(message), {
    ...sharedOptions,
    position: getToastPosition(),
    duration: 4500,
    ...options,
    style: {
      ...baseStyle(),
      background: dark ? 'rgba(127, 29, 29, 0.95)' : 'rgba(254, 242, 242, 0.98)',
      color: dark ? '#fecaca' : '#b91c1c',
      border: dark ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(254, 202, 202, 0.9)',
      ...options?.style,
    },
    iconTheme: {
      primary: '#dc2626',
      secondary: dark ? '#450a0a' : '#fef2f2',
    },
  });
}

export function toastInfo(message: string) {
  const dark = isDark();
  return toast(message, {
    ...sharedOptions,
    position: getToastPosition(),
    style: {
      ...baseStyle(),
      background: dark ? 'rgba(12, 74, 110, 0.95)' : 'rgba(240, 249, 255, 0.98)',
      color: dark ? '#bae6fd' : '#0c4a6e',
      border: dark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(186, 230, 253, 0.9)',
    },
    icon: 'ℹ️',
  });
}

export function toastWarning(message: string) {
  const dark = isDark();
  return toast(sanitizeUserErrorMessage(message), {
    ...sharedOptions,
    position: getToastPosition(),
    duration: 4500,
    style: {
      ...baseStyle(),
      background: dark ? 'rgba(120, 53, 15, 0.95)' : 'rgba(255, 251, 235, 0.98)',
      color: dark ? '#fde68a' : '#92400e',
      border: dark ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(253, 230, 138, 0.9)',
    },
    icon: '⚠️',
  });
}

/**
 * M10 — animated count-up toast: 0 → target over ~400ms.
 * Used for "N new messages" style announcements. Falls back to a plain
 * info toast when reduced-motion is requested or target <= 1.
 */
export function toastCountUp(target: number, prefix: string, suffix: string) {
  const fullText = `${target} ${suffix}`;
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || target <= 1) {
    return toastInfo(`${prefix ? prefix + ' ' : ''}${fullText}`);
  }
  let rafId = 0;
  const toastId = toast(
    (t: { visible: boolean }) => {
      if (!t.visible) return <span>{`0 ${suffix}`}</span>;
      const start = performance.now();
      const tick = () => {
        const elapsed = performance.now() - start;
        const progress = Math.min(1, elapsed / 400);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(eased * target);
        const node = document.querySelector(`[data-toast-count="${toastId}"]`);
        if (node) node.textContent = `${value} ${suffix}`;
        if (progress < 1) rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
      return (
        <span>
          {prefix ? `${prefix} ` : ''}
          <span data-toast-count={toastId}>{`0 ${suffix}`}</span>
        </span>
      );
    },
    {
      ...sharedOptions,
      position: getToastPosition(),
      style: baseStyle(),
      duration: 3500,
    }
  );
  return () => {
    cancelAnimationFrame(rafId);
    toast.dismiss(toastId);
  };
}

export function toastValidationErrors(errors: string[]) {
  if (!errors.length) return;
  const message =
    errors.length === 1
      ? errors[0]
      : `Please fix the following:\n${errors.map((e) => `• ${e}`).join('\n')}`;
  return toastError(message, { duration: 6000, style: { whiteSpace: 'pre-line', maxWidth: '420px' } });
}

export type InboxToastIcon = 'bot' | 'star';

/**
 * Soft lavender Inbox toast matching the mock AI banner (icon tile + short copy).
 * Auto-dismisses in ~2.5s. Optional action (e.g. "View flow") only when provided.
 */
export function toastInbox(
  message: string,
  options?: {
    icon?: InboxToastIcon;
    actionLabel?: string;
    onAction?: () => void;
    duration?: number;
  }
) {
  const iconKind = options?.icon ?? 'bot';
  const Icon = iconKind === 'star' ? Star : Bot;

  return toast.custom(
    (t) => (
      <div
        role="status"
        className={`pointer-events-auto flex max-w-[360px] items-center gap-2.5 rounded-xl border border-violet-200/70 bg-gradient-to-r from-violet-50 to-purple-50/90 px-3 py-2.5 shadow-[0_10px_28px_rgba(109,40,217,0.12)] transition dark:border-violet-800/50 dark:from-violet-950/80 dark:to-purple-950/70 ${
          t.visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 ring-1 ring-violet-200/70 dark:bg-violet-900/60 dark:text-violet-200 dark:ring-violet-700/50">
          <Icon
            className="h-4 w-4"
            strokeWidth={2.2}
            fill={iconKind === 'star' ? 'currentColor' : 'none'}
            aria-hidden
          />
        </span>
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-violet-950 dark:text-violet-100">
          {message}
        </p>
        {options?.actionLabel && options.onAction ? (
          <button
            type="button"
            onClick={() => {
              options.onAction?.();
              toast.dismiss(t.id);
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-[12px] font-bold text-violet-700 transition hover:bg-violet-100/80 dark:text-violet-200 dark:hover:bg-violet-900/50"
          >
            {options.actionLabel}
          </button>
        ) : null}
      </div>
    ),
    {
      duration: options?.duration ?? 2500,
      position: getToastPosition(),
    }
  );
}

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      gutter={6}
      containerStyle={toastContainerStyle()}
      toastOptions={{
        ...sharedOptions,
      }}
    />
  );
}
