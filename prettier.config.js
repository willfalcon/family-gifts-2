/** @type {import('prettier').Config} */
export default {
  tabWidth: 2,
  singleQuote: true,
  printWidth: 120,
  arrowParens: 'avoid',
  plugins: ['prettier-plugin-tailwindcss'],
  // Sort Tailwind classes inside these calls too, not just className="".
  tailwindFunctions: ['cn', 'cva', 'clsx'],
  overrides: [
    {
      // Mobile is on Tailwind 3 (NativeWind) with a JS config.
      files: 'apps/mobile/**',
      options: { tailwindConfig: './apps/mobile/tailwind.config.js' },
    },
    {
      // Web is on Tailwind 4, configured in CSS.
      files: 'apps/web/**',
      options: { tailwindStylesheet: './apps/web/src/styles.css' },
    },
  ],
};
