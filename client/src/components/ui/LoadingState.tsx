interface LoadingStateProps {
  label?: string;
  className?: string;
}

export default function LoadingState({ label = 'Loading...', className = '' }: LoadingStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-14 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-whatsapp-500/25 border-t-whatsapp-600" />
      <p className="mt-3 text-label font-medium text-theme-secondary">{label}</p>
    </div>
  );
}
