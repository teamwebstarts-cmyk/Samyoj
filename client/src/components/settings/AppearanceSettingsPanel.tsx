import { Palette } from 'lucide-react';
import DensityToggle from '../ui/DensityToggle';
import ThemeToggle from '../ui/ThemeToggle';
import SettingsPanel from './SettingsPanel';

export default function AppearanceSettingsPanel() {
  return (
    <SettingsPanel
      title="Appearance"
      description="Theme and how much fits on your screen."
      icon={Palette}
      accent="violet"
    >
      <div className="space-y-6">
        <div>
          <p className="text-[13px] font-bold text-theme-fg">Theme</p>
          <p className="mt-1 text-[12px] font-medium text-theme-secondary">
            Light, dark, or follow your system setting.
          </p>
          <div className="mt-3 max-w-md">
            <ThemeToggle />
          </div>
        </div>

        <div className="border-t border-theme-border pt-6">
          <p className="text-[13px] font-bold text-theme-fg">Display density</p>
          <p className="mt-1 text-[12px] font-medium text-theme-secondary">
            Compact tightens the sidebar, top bar, and list pages so more rows fit without zooming.
          </p>
          <div className="mt-3 max-w-sm">
            <DensityToggle />
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
