import type { ReactNode } from 'react';
import AppButton from '../ui/AppButton';

interface AuthButtonProps {
  loading?: boolean;
  loadingText: string;
  children: ReactNode;
  className?: string;
}

export default function AuthButton({ loading, loadingText, children, className }: AuthButtonProps) {
  return (
    <AppButton
      type="submit"
      variant="primary"
      size="xl"
      fullWidth
      loading={loading}
      className={className}
    >
      {loading ? loadingText : children}
    </AppButton>
  );
}
