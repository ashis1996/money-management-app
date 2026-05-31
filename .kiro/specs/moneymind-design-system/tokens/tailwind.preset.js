/**
 * MoneyMind Tailwind preset.
 *
 * Web app's `tailwind.config.ts` should:
 *   import preset from '@/.kiro/specs/moneymind-design-system/tokens/tailwind.preset'
 *   export default { presets: [preset], content: [...] }
 *
 * (or the file is copied into `web/tailwind.preset.js` once Phase 5 lands.)
 *
 * Tokens come from CSS custom properties defined in `theme.web.css` so the
 * runtime can swap them later (e.g. for a future light theme) without a
 * rebuild.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // future-proof for light mode
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-dim': 'var(--surface-dim)',
        'surface-bright': 'var(--surface-bright)',
        'surface-container-lowest': 'var(--surface-container-lowest)',
        'surface-container-low': 'var(--surface-container-low)',
        'surface-container': 'var(--surface-container)',
        'surface-container-high': 'var(--surface-container-high)',
        'surface-container-highest': 'var(--surface-container-highest)',
        'surface-variant': 'var(--surface-variant)',

        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        'inverse-surface': 'var(--inverse-surface)',
        'inverse-on-surface': 'var(--inverse-on-surface)',

        outline: 'var(--outline)',
        'outline-variant': 'var(--outline-variant)',

        primary: 'var(--primary)',
        'on-primary': 'var(--on-primary)',
        secondary: 'var(--secondary)',
        'on-secondary': 'var(--on-secondary)',
        tertiary: 'var(--tertiary)',
        'on-tertiary': 'var(--on-tertiary)',

        // Brand accents — these are what most consumers reach for.
        'accent-primary': 'var(--accent-primary)',
        'accent-ai': 'var(--accent-ai)',
        'accent-success': 'var(--accent-success)',
        'accent-warning': 'var(--accent-warning)',
        'accent-error': 'var(--accent-error)',

        background: 'var(--background)',
        'on-background': 'var(--on-background)',
      },

      backgroundImage: {
        'gradient-ai': 'var(--gradient-ai)',
        'gradient-hero-card': 'var(--gradient-hero-card)',
      },

      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },

      // Custom font sizes mapped to the type scale.
      // Each entry is [size, { lineHeight, letterSpacing, fontWeight }]
      fontSize: {
        'display-xl': ['64px', { lineHeight: '70px', letterSpacing: '-0.04em', fontWeight: '700' }],
        'display-lg': ['48px', { lineHeight: '52px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '31px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '29px', letterSpacing: '0', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '26px', letterSpacing: '0', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '21px', letterSpacing: '0', fontWeight: '400' }],
        'label-md': ['14px', { lineHeight: '14px', letterSpacing: '0.02em', fontWeight: '500' }],
        'label-sm': ['12px', { lineHeight: '12px', letterSpacing: '0.04em', fontWeight: '500' }],
        'mono-data': ['14px', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '500' }],
      },

      spacing: {
        '1.': '4px',
        '2.': '8px',
        '3.': '12px',
        '4.': '16px',
        '5.': '20px',
        '6.': '24px',
        '8.': '32px',
        '10.': '40px',
        '12.': '48px',
        '16.': '64px',
      },

      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '8px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },

      boxShadow: {
        modal:
          '0 30px 40px -10px rgba(59, 130, 246, 0.20), 0 12px 20px -8px rgba(0, 0, 0, 0.50)',
        'focus-ai': '0 0 0 4px rgba(34, 211, 238, 0.15)',
        'glow-cyan': '0 0 40px 4px rgba(34, 211, 238, 0.40)',
      },

      backdropBlur: {
        glass: '30px',
        nav: '40px',
        topbar: '24px',
      },

      transitionTimingFunction: {
        snappy: 'cubic-bezier(0.4, 0, 0.2, 1)',
        soft: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      transitionDuration: {
        tap: '80ms',
        'tap-out': '200ms',
        snappy: '200ms',
        soft: '320ms',
      },

      keyframes: {
        'orb-pulse': {
          '0%, 100%': { transform: 'scale(1.00)' },
          '50%': { transform: 'scale(1.04)' },
        },
        'border-ai-spin': {
          to: { transform: 'rotate(360deg)' },
        },
        'skeleton-shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },

      animation: {
        'orb-pulse': 'orb-pulse 1200ms ease-in-out infinite',
        'border-ai-spin': 'border-ai-spin 4s linear infinite',
        'skeleton-shimmer': 'skeleton-shimmer 1.4s linear infinite',
      },

      zIndex: {
        base: '0',
        raised: '10',
        sticky: '50',
        drawer: '100',
        modal: '200',
        toast: '300',
        'ai-orb': '400',
      },
    },
  },
  plugins: [],
};
