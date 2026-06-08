import { resolveStatTone, settingsStatTones } from './settingsUi';

interface SettingsStatProps {
  label: string;
  value: string | number;
  tone?: string;
}

export default function SettingsStat({ label, value, tone }: SettingsStatProps) {
  const key = resolveStatTone(tone);
  const styles = settingsStatTones[key];

  return (
    <div
      className={`rounded-2xl border border-theme-border bg-gradient-to-br ${styles.bg} px-3 py-3.5 text-center transition hover:shadow-sm`}
    >
      <p className={`text-lg font-extrabold tabular-nums sm:text-xl ${styles.value}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
        {label}
      </p>
    </div>
  );
}
