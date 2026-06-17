import type { GroupBase, StylesConfig } from 'react-select';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectSize = 'default' | 'compact';

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function createSelectStyles(
  isDark: boolean,
  size: SelectSize = 'default',
): StylesConfig<SelectOption, false, GroupBase<SelectOption>> {
  const isCompact = size === 'compact';
  const controlHeight = isCompact ? 36 : 44;
  const fontSize = isCompact ? 12 : 14;
  const surface = cssVar('--color-surface', isDark ? '#151d2b' : '#ffffff');
  const text = cssVar('--color-text', isDark ? '#f1f5f9' : '#0f172a');
  const muted = cssVar('--color-text-muted', isDark ? '#64748b' : '#64748b');
  const border = cssVar('--color-border', isDark ? 'rgba(51, 65, 85, 0.65)' : 'rgba(226, 232, 240, 0.85)');
  const borderHover = cssVar('--color-border-strong', isDark ? '#475569' : '#d1d5db');
  const focusBorder = '#128C7E';
  const focusRing = isDark ? '0 0 0 3px rgba(37, 211, 102, 0.2)' : '0 0 0 3px rgba(37, 211, 102, 0.15)';
  const menuShadow = cssVar('--shadow-panel', isDark
    ? '0 12px 32px rgba(0, 0, 0, 0.45)'
    : '0 12px 32px rgba(15, 23, 42, 0.12)');
  const selectedBg = isDark ? 'rgba(6, 78, 59, 0.45)' : 'rgba(209, 250, 229, 0.95)';
  const focusedBg = isDark ? 'rgba(6, 78, 59, 0.25)' : 'rgba(240, 253, 244, 0.95)';
  const selectedText = isDark ? '#6ee7b7' : '#065f46';

  return {
    control: (base, state) => ({
      ...base,
      minHeight: controlHeight,
      height: isCompact ? controlHeight : base.height,
      borderRadius: isCompact ? 10 : 12,
      borderColor: state.isFocused ? focusBorder : border,
      boxShadow: state.isFocused ? focusRing : isCompact ? '0 1px 2px rgba(15, 23, 42, 0.04)' : 'none',
      backgroundColor: surface,
      fontSize,
      cursor: 'pointer',
      transition: 'border-color 150ms ease, box-shadow 150ms ease',
      '&:hover': {
        borderColor: state.isFocused ? focusBorder : borderHover,
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: isCompact ? '0 8px' : '0 12px',
    }),
    placeholder: (base) => ({ ...base, color: muted, fontSize, fontWeight: isCompact ? 600 : 400 }),
    singleValue: (base) => ({ ...base, color: text, fontSize, fontWeight: isCompact ? 600 : 500 }),
    input: (base) => ({ ...base, color: text, fontSize }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: state.isFocused ? focusBorder : muted,
      paddingRight: isCompact ? 8 : 12,
      paddingLeft: isCompact ? 2 : base.paddingLeft,
      '&:hover': { color: focusBorder },
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid ${border}`,
      boxShadow: menuShadow,
      backgroundColor: surface,
    }),
    menuList: (base) => ({ ...base, padding: 6 }),
    option: (base, state) => ({
      ...base,
      borderRadius: 8,
      fontSize,
      fontWeight: state.isSelected ? 600 : 500,
      color: state.isSelected ? selectedText : text,
      backgroundColor: state.isSelected ? selectedBg : state.isFocused ? focusedBg : 'transparent',
      cursor: state.isDisabled ? 'not-allowed' : 'pointer',
      '&:active': {
        backgroundColor: isDark ? 'rgba(6, 78, 59, 0.55)' : 'rgba(209, 250, 229, 0.85)',
      },
    }),
  };
}
