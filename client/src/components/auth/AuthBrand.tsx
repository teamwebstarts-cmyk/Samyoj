import { PlatformBrand } from '../layout/PlatformBrand';

interface AuthBrandProps {
  variant?: 'light' | 'dark';
  compact?: boolean;
}

/** Auth pages — always shows platform branding */
export default function AuthBrand({ variant = 'dark', compact = false }: AuthBrandProps) {
  return <PlatformBrand variant={variant} size={compact ? 'sm' : 'md'} />;
}

export { PlatformBrand };
