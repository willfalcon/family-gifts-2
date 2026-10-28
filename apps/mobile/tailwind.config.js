const { hairlineWidth } = require('nativewind/theme');
const { colors, fontFamily, borderRadius, boxShadow } = require('@family-gifts/design-tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      fontFamily,
      borderRadius,
      boxShadow,
      fontSize: {
        // '4xl': 36,
        // '3xl': 30,
        // '2xl': 28,
        // xl: 26,
        // lg: 20,
        // md: 18,
        // base: 17,
        sm: 15,
        // xs: 14,
        // '2xs': 13,
        // '3xs': 10,
        greeting: 36,
        title: 30,
        detail: 28,
        name: 26,
        headline: 20,
        body: 17,
        'button-lg': 17,
        callout: 15,
        label: 15,
        subhead: 14,
        footnote: 13,
        'tab-label': 10,
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require('tailwindcss-animate')],
};
