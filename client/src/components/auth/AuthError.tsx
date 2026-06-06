import { AlertCircle } from 'lucide-react';

interface AuthErrorProps {
  message: string;
}

export default function AuthError({ message }: AuthErrorProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <p>{message}</p>
    </div>
  );
}
