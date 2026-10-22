/** @type {import('tailwindcss').Config} */
// Theme source: samyoj-homepage tokens (--sy-*). Emerald/purple/rose/sky ramps are
// overridden so existing JSX utilities restyle without touching any component.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand accent ramp (base #4B2EEB, hover #3B22C7) — replaces emerald usages
        emerald: {
          50: '#EEF2FF',
          100: '#EEF2FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#4B2EEB',
          600: '#3B22C7',
          700: '#32239F',
          800: '#2A1E7E',
          900: '#231A63',
          950: '#140D38',
        },
        // Bright/secondary accent #7A3BFF — highlights, purple badges
        purple: {
          50: '#F5F0FF',
          100: '#EDE4FF',
          200: '#DCCEFE',
          300: '#C4A9FD',
          400: '#A87FFD',
          500: '#7A3BFF',
          600: '#682EEB',
          700: '#5421BE',
          800: '#3F1A8E',
          900: '#2A115E',
          950: '#170A33',
        },
        // Danger — base #EF4444
        rose: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#450A0A',
        },
        // Info — base #3B82F6
        sky: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        // Named tokens (legacy names kept: only BrandMark consumes them)
        paper: '#F8FAFF',
        ink: '#0F172A',
        graphite: '#0F172A',
        dust: '#E2E8F0',
        signal: '#F59E0B',
        sage: {
          DEFAULT: '#4B2EEB',
          muted: '#7A3BFF',
          faint: '#EEF2FF',
          bright: '#7A3BFF',
        },
      },
      boxShadow: {
        panel: '0 4px 16px rgba(15, 23, 42, 0.03)',
        input: '0 0 0 1px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        card: '20px',
      },
    },
  },
  plugins: [],
};
