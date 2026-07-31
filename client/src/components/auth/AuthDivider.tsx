interface AuthDividerProps {
  label?: string;
}

export default function AuthDivider({ label = 'or continue with email' }: AuthDividerProps) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-theme-border/70" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3 text-xs text-theme-muted">
          {label}
        </span>
      </div>
    </div>
  );
}
