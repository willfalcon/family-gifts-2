import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@convex': fileURLToPath(new URL('../../packages/backend/convex', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../packages/shared', import.meta.url)),
    },
  },
  // Better Auth ships ESM that must be bundled for SSR rather than externalized.
  ssr: {
    noExternal: ['@convex-dev/better-auth'],
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
});
