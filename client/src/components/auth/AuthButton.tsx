import type { ReactNode } from 'react';
import AppButton from '../ui/AppButton';

interface AuthButtonProps {
  loading?: boolean;
  loadingText: string;
  children: ReactNode;
}

export default function AuthButton({ loading, loadingText, children }: AuthButtonProps) {
  return (
    <AppButton
      type="submit"
      variant="primary"
      size="xl"
      fullWidth
      loading={loading}
    >
      {loading ? loadingText : children}
    </AppButton>
  );
}
