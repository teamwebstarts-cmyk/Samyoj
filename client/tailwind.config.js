/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        whatsapp: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#34d399',
          500: '#25D366',
          600: '#128C7E',
          700: '#075E54',
          800: '#064e45',
          900: '#022c22',
        },
      },
      boxShadow: {
        input: '0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'input-focus': '0 0 0 1px rgba(18,140,126,0.65), 0 0 0 4px rgba(18,140,126,0.18)',
        panel: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        showcase: '0 32px 64px -16px rgba(0,0,0,0.55)',
        'showcase-glow': '0 0 60px rgba(37,211,102,0.25)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out both',
        'fade-up-delay': 'fadeUp 0.5s ease-out 0.1s both',
        'fade-up-delay-2': 'fadeUp 0.5s ease-out 0.2s both',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        shimmer: 'shimmer 3s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
      },
    },
  },
  plugins: [],
};
