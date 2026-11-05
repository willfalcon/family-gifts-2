// Tailwind reads the Ledger design tokens straight from
// @family-gifts/design-tokens, the same module apps/mobile/tailwind.config.js
// uses, so both apps share one source of colors, type scale and radii.
// Loaded from src/styles.css with `@config`.
const { colors, fontSize, borderRadius, boxShadow } = require('@family-gifts/design-tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors,
      // Mobile bakes the weight into the family name (Inter_600SemiBold).
      // CSS composes family + weight instead, so these are plain families and
      // styles.css adds the `font-body-semibold`-style utilities mobile uses.
      fontFamily: {
        body: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      fontSize: {
        ...fontSize,
        sm: ['15px', { lineHeight: '20px' }],
      },
      borderRadius,
      boxShadow,
    },
  },
};
