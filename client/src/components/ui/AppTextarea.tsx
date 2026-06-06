import type { TextareaHTMLAttributes } from 'react';

interface AppTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export default function AppTextarea({ label, hint, className = '', id, ...props }: AppTextareaProps) {
  return (
    <div className="space-y-1.5">
      {(label || hint) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={id} className="text-[13px] font-semibold text-neutral-700">
              {label}
            </label>
          )}
          {hint && <span className="text-[11px] font-medium text-neutral-500">{hint}</span>}
        </div>
      )}
      <textarea
        id={id}
        className={`w-full rounded-xl border border-neutral-200/90 bg-white px-3.5 py-2.5 text-[14px] text-neutral-900 shadow-input transition placeholder:text-neutral-400 focus:border-whatsapp-600 focus:outline-none focus:shadow-input-focus disabled:opacity-60 ${className}`}
        {...props}
      />
    </div>
  );
}
