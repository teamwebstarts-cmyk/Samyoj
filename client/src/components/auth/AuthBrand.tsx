import { PlatformBrand } from '../layout/PlatformBrand';

interface AuthBrandProps {
  variant?: 'light' | 'dark';
  compact?: boolean;
}

/** Auth pages — real Samyoj wordmark logo */
export default function AuthBrand({ compact = false }: AuthBrandProps) {
  return <PlatformBrand wordmark size={compact ? 'sm' : 'md'} />;
}

export { PlatformBrand };
