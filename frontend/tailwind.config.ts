import type { Config } from 'tailwindcss';

/**
 * Tailwind theme — strict mirror of Tasks/DESIGN_SYSTEM.md §2.
 * All scales (color/spacing/font/radius/shadow/duration/easing) are replaced
 * (not extended) to keep Tailwind defaults from leaking back in.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    /* Replace defaults — only the ramps from §2.1 + the per-app accent var */
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#FFFFFF',
      black: '#000000',
      ink: {
        50:  '#F4F2ED',
        100: '#ECE7DC',
        200: '#D8CFB8',
        300: '#B5A88A',
        400: '#8C7E5E',
        500: '#5C5238',
        600: '#3D3624',
        700: '#2A2517',
        800: '#1C190F',
        900: '#0E0C07',
      },
      teal: {
        50:  '#E6F0F0',
        100: '#BFD8D8',
        200: '#95BDBD',
        300: '#6AA1A1',
        400: '#3F8585',
        500: '#1A6868',
        600: '#155454',
        700: '#103F3F',
        800: '#0A2B2B',
        900: '#051818',
      },
      gold: {
        50:  '#FBF5E8',
        100: '#F4E5BD',
        200: '#ECD18C',
        300: '#E2BC5C',
        400: '#D4A445',
        500: '#B8862C',
        600: '#8E6620',
        700: '#674916',
        800: '#432F0D',
        900: '#221706',
      },
      terra: {
        50:  '#FDF0EB',
        100: '#F8D6CC',
        200: '#F1B19F',
        300: '#E68870',
        400: '#D85F44',
        500: '#C8462C',
        600: '#A53620',
        700: '#7B2718',
        800: '#501810',
        900: '#280B07',
      },
      success:    { DEFAULT: '#2D7A4A', bg: '#E8F3EC' },
      warning:    { DEFAULT: '#B8862C', bg: '#FBF5E8' },
      danger:     { DEFAULT: '#C8462C', bg: '#FDF0EB' },
      info:       { DEFAULT: '#1A6868', bg: '#E6F0F0' },
      /* Per-app accent — components use bg-accent-500 etc. */
      accent: {
        50:  'var(--accent-50)',
        500: 'var(--accent-500)',
        600: 'var(--accent-600)',
        700: 'var(--accent-700)',
      },
      surface: {
        page:     'var(--surface-page)',
        card:     'var(--surface-card)',
        elevated: 'var(--surface-elevated)',
        sunken:   'var(--surface-sunken)',
      },
      border: {
        subtle:  'var(--border-subtle)',
        default: 'var(--border-default)',
        strong:  'var(--border-strong)',
        focus:   'var(--border-focus)',
      },
      text: {
        primary:   'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary:  'var(--text-tertiary)',
        inverse:   'var(--text-inverse)',
      },
    },

    spacing: {
      0:  '0',
      1:  '4px',
      2:  '8px',
      3:  '12px',
      4:  '16px',
      5:  '20px',
      6:  '24px',
      7:  '32px',
      8:  '40px',
      9:  '48px',
      10: '64px',
      11: '80px',
      12: '96px',
      px: '1px',
    },

    fontFamily: {
      ar:        ['Cairo', '"Noto Sans Arabic"', 'system-ui', 'sans-serif'],
      'ar-display': ['Cairo', '"Noto Sans Arabic"', 'system-ui', 'sans-serif'],
      en:        ['Cairo', 'system-ui', 'sans-serif'],
      mono:      ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      numeric:   ['Cairo', 'sans-serif'],
    },

    fontSize: {
      '2xs': ['11px', { lineHeight: '16px' }],
      xs:    ['12px', { lineHeight: '18px' }],
      sm:    ['13px', { lineHeight: '20px' }],
      base:  ['15px', { lineHeight: '24px' }],
      md:    ['17px', { lineHeight: '26px' }],
      lg:    ['20px', { lineHeight: '28px' }],
      xl:    ['24px', { lineHeight: '32px' }],
      '2xl': ['30px', { lineHeight: '38px' }],
      '3xl': ['38px', { lineHeight: '46px' }],
      '4xl': ['48px', { lineHeight: '54px' }],
    },

    fontWeight: {
      regular: '400',
      medium:  '500',
      bold:    '700',
    },

    letterSpacing: {
      tight:  '-0.01em',
      normal: '0',
      wide:   '0.04em',
    },

    lineHeight: {
      tight:   '1.25',
      snug:    '1.4',
      normal:  '1.6',
      relaxed: '1.75',
    },

    borderRadius: {
      none: '0',
      sm:   '4px',
      md:   '6px',
      lg:   '10px',
      xl:   '14px',
      '2xl': '20px',
      pill: '999px',
      full: '999px',
    },

    boxShadow: {
      none: 'none',
      xs:   '0 1px 2px rgba(28, 25, 15, 0.04)',
      sm:   '0 1px 3px rgba(28, 25, 15, 0.06), 0 1px 2px rgba(28, 25, 15, 0.04)',
      md:   '0 4px 8px rgba(28, 25, 15, 0.06), 0 2px 4px rgba(28, 25, 15, 0.04)',
      lg:   '0 12px 24px rgba(28, 25, 15, 0.08), 0 4px 8px rgba(28, 25, 15, 0.04)',
      xl:   '0 24px 48px rgba(28, 25, 15, 0.12)',
      'focus-teal':  '0 0 0 3px rgba(26, 104, 104, 0.18)',
      'focus-terra': '0 0 0 3px rgba(200, 70, 44, 0.18)',
      'focus-gold':  '0 0 0 3px rgba(212, 164, 69, 0.24)',
    },

    transitionDuration: {
      instant: '80ms',
      fast:    '120ms',
      base:    '180ms',
      slow:    '240ms',
      slower:  '320ms',
    },

    transitionTimingFunction: {
      standard:    'cubic-bezier(0.2, 0, 0, 1)',
      emphasized:  'cubic-bezier(0.3, 0, 0, 1)',
      decelerate:  'cubic-bezier(0, 0, 0, 1)',
      accelerate:  'cubic-bezier(0.3, 0, 1, 1)',
    },

    zIndex: {
      base:           '0',
      raised:         '10',
      sticky:         '100',
      dropdown:       '200',
      'modal-backdrop': '900',
      modal:          '1000',
      toast:          '1100',
      tooltip:        '1200',
    },

    extend: {
      maxWidth: { content: '1440px' },
      animation: {
        'page-enter':   'pageEnter var(--duration-slow) var(--ease-standard)',
        shimmer:        'skeletonShimmer 1.5s ease-in-out infinite',
        'toast-in':     'toastSlideIn var(--duration-base) var(--ease-emphasized)',
        'modal-enter':  'modalEnter var(--duration-slow) var(--ease-standard)',
        'drawer-enter': 'drawerEnterEnd var(--duration-slow) var(--ease-emphasized)',
        'pulse-stage':  'stageStepperPulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
