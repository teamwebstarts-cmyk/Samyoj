import type { ReactNode } from 'react';

interface AuthButtonProps {
  loading?: boolean;
  loadingText: string;
  children: ReactNode;
}

export default function AuthButton({ loading, loadingText, children }: AuthButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="auth-btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
      )}
      {loading ? loadingText : children}
    </button>
  );
}
