/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: '#F4FBF6',
        ink: '#0F172A',
        graphite: '#12241E',
        sage: {
          DEFAULT: '#087F5B',
          muted: '#0F9F6E',
          faint: '#ECFDF5',
          bright: '#25D366',
        },
        dust: '#E2E8F0',
        signal: '#B45309',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)',
        input: '0 0 0 1px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        card: '1rem',
      },
    },
  },
  plugins: [],
};
