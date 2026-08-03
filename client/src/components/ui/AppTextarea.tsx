import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface AppTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

const AppTextarea = forwardRef<HTMLTextAreaElement, AppTextareaProps>(
  function AppTextarea({ label, hint, className = '', id, ...props }, ref) {
    return (
      <div className="space-y-1.5">
        {(label || hint) && (
          <div className="flex items-center justify-between gap-2">
            {label && (
              <label htmlFor={id} className="text-[13px] font-semibold text-theme-secondary">
                {label}
              </label>
            )}
            {hint && <span className="text-[11px] font-medium text-theme-muted">{hint}</span>}
          </div>
        )}
        <textarea
          ref={ref}
          id={id}
          className={`w-full rounded-xl border border-theme-border bg-theme-surface px-3.5 py-2.5 text-[14px] text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-slate-400 focus:outline-none focus:shadow-input-focus disabled:opacity-60 dark:focus:border-slate-500 ${className}`}
          {...props}
        />
      </div>
    );
  }
);

export default AppTextarea;
