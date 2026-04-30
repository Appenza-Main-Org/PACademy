import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ar: ['Noto Sans Arabic', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        en: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          50: '#F0F5FB',
          100: '#DDE7F2',
          200: '#B4CCE5',
          300: '#7BA0D0',
          400: '#4A78BD',
          500: '#2D5BA0',
          600: '#234A85',
          700: '#142C50',
          DEFAULT: '#1B3A6B',
        },
        accent: {
          50: '#FAF6E8',
          100: '#F5EDD4',
          200: '#E8D9A8',
          600: '#A8893F',
          DEFAULT: '#C9A961',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
