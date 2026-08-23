import { Palette } from 'lucide-react';
import DensityToggle from '../ui/DensityToggle';
import ThemeToggle from '../ui/ThemeToggle';
import CardSpacingSlider from '../ui/CardSpacingSlider';
import PageGutterSlider from '../ui/PageGutterSlider';
import TextSizeToggle from '../ui/TextSizeToggle';
import FontFamilySelect from '../ui/FontFamilySelect';
import SettingsPanel from './SettingsPanel';

export default function AppearanceSettingsPanel() {
  return (
    <SettingsPanel
      title="Appearance"
      description="Theme, text size, font, density, card spacing, and page side space."
      icon={Palette}
    >
      <div className="space-y-6">
        <div>
          <p className="text-[13px] font-bold text-theme-fg">Theme</p>
          <p className="mt-1 text-[12px] font-medium text-theme-secondary">
            Light, dark, or follow your system setting.
          </p>
          <div className="mt-3 max-w-md">
            <ThemeToggle flat />
          </div>
        </div>

        <div className="border-t border-theme-border pt-6">
          <p className="text-[13px] font-bold text-theme-fg">Text size</p>
          <p className="mt-1 text-[12px] font-medium text-theme-secondary">
            One size for the whole app — Small, Default, or Large. Not a different size on each page.
          </p>
          <div className="mt-3 max-w-md">
            <TextSizeToggle flat />
          </div>
        </div>

        <div className="border-t border-theme-border pt-6">
          <p className="text-[13px] font-bold text-theme-fg">Font</p>
          <p className="mt-1 text-[12px] font-medium text-theme-secondary">
            Typeface for the whole app, including Inbox. These are the families used in CRMs and agent tools. Plus Jakarta Sans stays the default.
          </p>
          <div className="mt-3">
            <FontFamilySelect />
          </div>
        </div>

        <div className="border-t border-theme-border pt-6">
          <p className="text-[13px] font-bold text-theme-fg">Display density</p>
          <p className="mt-1 text-[12px] font-medium text-theme-secondary">
            Compact tightens the sidebar, top bar, and list pages so more rows fit without zooming.
          </p>
          <div className="mt-3 max-w-sm">
            <DensityToggle flat />
          </div>
        </div>

        <div className="border-t border-theme-border pt-6">
          <p className="text-[13px] font-bold text-theme-fg">Card spacing</p>
          <p className="mt-1 text-[12px] font-medium text-theme-secondary">
            How far apart cards sit on the dashboard and other card screens. Independent of density.
          </p>
          <div className="mt-3">
            <CardSpacingSlider />
          </div>
        </div>

        <div className="border-t border-theme-border pt-6">
          <p className="text-[13px] font-bold text-theme-fg">Page side space</p>
          <p className="mt-1 text-[12px] font-medium text-theme-secondary">
            Left and right inset around the middle cards. Slide toward Much wider for large empty edges. Does not change the top bar. Independent of card spacing.
          </p>
          <div className="mt-3">
            <PageGutterSlider />
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
