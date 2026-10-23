import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    {
      pattern: /(bg|text|border)-(emerald|cyan|teal|blue|sky|indigo|purple|violet|fuchsia|rose|amber|yellow|slate|red|orange|lime)-(300|400|500)(\/(10|15|20|30))?/,
    },
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-ui)',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'var(--font-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1.05rem', letterSpacing: '0.01em' }],     // 12px
        'xs': ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '0.005em' }],   // 13px (increased from 12px for readability)
        'sm': ['0.9375rem', { lineHeight: '1.375rem', letterSpacing: '0' }],        // 15px (increased from 14px for UI controls & labels)
        'base': ['1rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em' }],     // 16px standard body
        'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }],    // 18px
        'xl': ['1.25rem', { lineHeight: '1.875rem', letterSpacing: '-0.015em' }],   // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],        // 24px
        '3xl': ['1.875rem', { lineHeight: '2.375rem', letterSpacing: '-0.025em' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.03em' }],    // 36px
        '5xl': ['3rem', { lineHeight: '3.5rem', letterSpacing: '-0.035em' }],        // 48px
      },
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
        },
        admin: {
          50: '#f8fafc',
          900: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};
export default config;
