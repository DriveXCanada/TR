import type { Config } from 'tailwindcss';

/**
 * Theme tokens. Two layers, deliberately separated:
 *
 * - Brand tokens (`tr-*`, `drivex-*`) carry the Team Rubicon Canada identity and
 *   are expected to change if this instance is re-themed for another partner.
 * - Functional severity tokens (`severe`, `intolerance`, `preference`) encode
 *   *meaning*, not brand. Severe is red because red means stop, everywhere.
 *   These must survive any rebrand — see README "Theming".
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- Brand (Team Rubicon Canada) ---
        tr: {
          red: '#CE1126',
          'red-dark': '#A10E1F',
          charcoal: '#1A1A1A',
          ink: '#2B2B2B',
          grey: '#6B7280',
          'greyshirt': '#8A8F98',
          mist: '#F4F5F7',
        },
        drivex: { accent: '#0F62FE' },

        // --- Functional severity (never rebrand these) ---
        severe: { DEFAULT: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' },
        intolerance: { DEFAULT: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
        preference: { DEFAULT: '#4B5563', bg: '#F9FAFB', border: '#D1D5DB' },
      },
      borderRadius: { card: '0.75rem' },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
