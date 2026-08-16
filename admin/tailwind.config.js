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
        paper: '#F3EFE8',
        ink: '#1B1D20',
        graphite: '#2A2E33',
        sage: {
          DEFAULT: '#2F6F5E',
          muted: '#4C8A76',
          faint: '#E4EFEA',
        },
        dust: '#D6CFC4',
        signal: '#B86A2A',
      },
    },
  },
  plugins: [],
};
