interface AuthDividerProps {
  label?: string;
}

export default function AuthDivider({ label = 'or continue with email' }: AuthDividerProps) {
  return (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-slate-200/90" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-3.5 text-[12.5px] font-medium text-slate-400">{label}</span>
      </div>
    </div>
  );
}
