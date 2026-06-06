interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex rounded-xl border border-neutral-200/90 bg-neutral-50/80 p-1 shadow-input">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
            value === option.value
              ? 'bg-white text-whatsapp-700 shadow-sm ring-1 ring-emerald-100'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
