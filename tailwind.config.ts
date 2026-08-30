import type { Config } from 'tailwindcss';

// Kapila Medical Agencies design system tokens.
// Deliberately restrained palette: one brand color, one accent, neutrals,
// and the four semantic status colors used across order/payment/expense
// states. See docs/DESIGN_SYSTEM.md for usage rules.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6f4',
          100: '#d6e9e4',
          200: '#aed3c9',
          300: '#7fb8a9',
          400: '#4f9c86',
          500: '#2f7d68', // primary brand green — pharma / trust / growth
          600: '#256554',
          700: '#1e5344',
          800: '#193f34',
          900: '#12302a',
        },
        accent: {
          500: '#b9862f', // muted gold — offers, highlights, premium cues
          600: '#9a6d22',
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f6f7f8',
          muted: '#eceef0',
        },
        ink: {
          DEFAULT: '#111827',
          muted: '#4b5563',
          faint: '#9ca3af',
        },
        success: '#1a7f4e',
        warning: '#b3760a',
        danger: '#c0362c',
        info: '#1f5fa8',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
