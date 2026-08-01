interface AuthDividerProps {
  label?: string;
}

export default function AuthDivider({ label = 'or continue with email' }: AuthDividerProps) {
  return (
    <div className="my-5 flex items-center gap-3" role="separator" aria-label={label}>
      <div className="h-px flex-1 bg-slate-200" />
      <span className="shrink-0 text-[13px] font-medium lowercase tracking-[0.04em] text-slate-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
