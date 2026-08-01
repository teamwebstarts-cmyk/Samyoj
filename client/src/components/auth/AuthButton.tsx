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
      className="auth-btn-primary inline-flex h-[52px] w-full min-h-[52px] items-center justify-center rounded-[16px] px-5 text-[15px] font-semibold tracking-[-0.01em] text-white antialiased transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2.5">
          <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/25 border-t-white" />
          {loadingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
