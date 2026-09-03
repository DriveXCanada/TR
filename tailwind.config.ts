import type { Config } from 'tailwindcss';

/**
 * Theme tokens. Two layers, deliberately separated:
 *
 * - Brand tokens (`tr-*`) carry the Team Rubicon Canada identity: red, charcoal,
 *   greyshirt grey. Dark-first, because that is the bolder read and because a
 *   screen in a field kitchen is often the brightest thing in the room.
 *
 * - Functional severity tokens (`severe`, `intolerance`, `preference`) encode
 *   MEANING, not brand, and must survive any rebrand.
 *
 * The tension worth knowing about: brand red and "danger" red are the same
 * colour. If red is used as general decoration, a severe-allergy warning stops
 * standing out — the one thing on this screen that must never be missed. So
 * brand red is confined to chrome (active nav, primary actions, rules), and
 * large solid red fills are reserved exclusively for severity.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tr: {
          // Surfaces, darkest to lightest.
          black: '#0A0B0C',      // app chrome
          charcoal: '#131518',   // page ground
          slate: '#1C1F23',      // cards
          raised: '#252A30',     // hover / raised
          line: '#343B43',       // borders

          // Text.
          grey: '#98A1AB',       // secondary — the greyshirt grey
          silver: '#CBD2DA',     // body
          white: '#F4F7FA',      // headings, used sparingly

          // Brand.
          red: '#CE1126',
          'red-bright': '#E8253C',
          'red-deep': '#8E0C1A',
        },
        drivex: { accent: '#3D8BFD' },

        // --- Functional severity. Never rebrand these. ---
        severe: {
          DEFAULT: '#FF4D5E',
          bg: '#3A0D14',
          border: '#C62334',
          solid: '#D91F33',
        },
        intolerance: {
          DEFAULT: '#F2B13C',
          bg: '#33260B',
          border: '#A87C22',
        },
        preference: {
          DEFAULT: '#A8B0B9',
          bg: '#22262B',
          border: '#3C434B',
        },
        ok: { DEFAULT: '#3FBF7F', bg: '#0E2A1D', border: '#2A7D55' },
      },
      borderRadius: { card: '0.5rem' },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      letterSpacing: { headline: '-0.02em' },
    },
  },
  plugins: [],
};
export default config;
