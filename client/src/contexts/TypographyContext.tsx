import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyFontFamily,
  applyTextSize,
  getStoredFontFamily,
  getStoredTextSize,
  saveFontFamily,
  saveTextSize,
  type FontFamilyId,
  type TextSize,
} from '../lib/density/typographyStore';

interface TypographyContextValue {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  fontFamily: FontFamilyId;
  setFontFamily: (id: FontFamilyId) => void;
}

const TypographyContext = createContext<TypographyContextValue | null>(null);

export function TypographyProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>(getStoredTextSize);
  const [fontFamily, setFontFamilyState] = useState<FontFamilyId>(getStoredFontFamily);

  const setTextSize = useCallback((next: TextSize) => {
    setTextSizeState(next);
    saveTextSize(next);
  }, []);

  const setFontFamily = useCallback((next: FontFamilyId) => {
    setFontFamilyState(next);
    saveFontFamily(next);
  }, []);

  useEffect(() => {
    applyTextSize(textSize);
    applyFontFamily(fontFamily);
  }, []);

  const value = useMemo(
    () => ({ textSize, setTextSize, fontFamily, setFontFamily }),
    [textSize, setTextSize, fontFamily, setFontFamily],
  );

  return <TypographyContext.Provider value={value}>{children}</TypographyContext.Provider>;
}

export function useTypography() {
  const ctx = useContext(TypographyContext);
  if (!ctx) throw new Error('useTypography must be used within TypographyProvider');
  return ctx;
}
