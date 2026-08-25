import { PenLine } from 'lucide-react';
import AppButton from '../ui/AppButton';

interface BuildFromScratchButtonProps {
  onClick: () => void;
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function BuildFromScratchButton({
  onClick,
  fullWidth,
  className = '',
  disabled = false,
}: BuildFromScratchButtonProps) {
  return (
    <AppButton
      fullWidth={fullWidth}
      variant="secondary"
      icon={<PenLine size={16} strokeWidth={2.25} />}
      onClick={onClick}
      disabled={disabled}
      className={`border-dashed border-violet-400/45 bg-gradient-to-br from-violet-500/[0.07] via-transparent to-indigo-500/[0.05] font-bold text-violet-700 shadow-none ring-0 hover:border-violet-500/70 hover:bg-violet-500/10 hover:text-violet-800 hover:shadow-[0_4px_14px_rgba(139,92,246,0.12)] focus:ring-violet-500/20 dark:text-violet-300 dark:hover:text-violet-200 ${className}`}
    >
      Build from scratch
    </AppButton>
  );
}
