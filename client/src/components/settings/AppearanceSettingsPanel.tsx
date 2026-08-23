import { Palette } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import PageGutterSlider from '../ui/PageGutterSlider';
import SettingsPanel from './SettingsPanel';

export default function AppearanceSettingsPanel() {
  return (
    <SettingsPanel
      title="Appearance"
      description="Theme and page side space."
      icon={Palette}
    >
      <div className="space-y-5">
        <div>
          <p className="text-[13px] font-semibold text-theme-fg">Theme</p>
          <div className="mt-2 max-w-sm">
            <ThemeToggle flat />
          </div>
        </div>

        <div className="border-t border-theme-border pt-5">
          <p className="text-[13px] font-semibold text-theme-fg">Page side space</p>
          <p className="mt-1 text-[11px] text-theme-muted">
            Left and right margin around page content.
          </p>
          <div className="mt-2">
            <PageGutterSlider />
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
