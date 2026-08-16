import {
  FONT_FAMILIES,
  fontFamilyOptionLabel,
  getFontFamily,
  type FontFamilyId,
} from '../../lib/density/typographyStore';
import { useTypography } from '../../contexts/TypographyContext';

export default function FontFamilySelect() {
  const { fontFamily, setFontFamily } = useTypography();
  const selected = getFontFamily(fontFamily);

  return (
    <div className="max-w-md">
      <label className="sr-only" htmlFor="appearance-font-family">
        Font family
      </label>
      <select
        id="appearance-font-family"
        value={fontFamily}
        onChange={(e) => setFontFamily(e.target.value as FontFamilyId)}
        className="w-full rounded-xl border border-theme-border bg-theme-surface px-3 py-2.5 text-[13px] font-semibold text-theme-fg shadow-theme outline-none transition focus:border-emerald-500/50"
        style={{ fontFamily: selected.stack }}
      >
        {FONT_FAMILIES.map((font) => (
          <option key={font.id} value={font.id} style={{ fontFamily: font.stack }}>
            {fontFamilyOptionLabel(font)}
          </option>
        ))}
      </select>
      <p
        className="mt-2.5 text-[13px] font-medium leading-snug text-theme-secondary"
        style={{ fontFamily: selected.stack }}
      >
        {selected.hint}. The quick brown fox jumps over the lazy dog.
      </p>
    </div>
  );
}
