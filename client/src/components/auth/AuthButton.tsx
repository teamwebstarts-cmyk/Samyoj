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
      className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-neutral-900 text-[14px] font-semibold text-white transition hover:bg-neutral-800 focus:outline-none focus:ring-4 focus:ring-neutral-900/15 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
      )}
      {loading ? loadingText : children}
    </button>
  );
}
