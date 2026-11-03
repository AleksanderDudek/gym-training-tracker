import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GYM TRACKER Sztab. Atlas, treningi, plany i silnik bierze wprost z aplikacji podopiecznego
// (`@gt` → `../../src`), więc prowadzący liczy tymi samymi wzorami, które widzi podopieczny.
const gt = fileURLToPath(new URL('../../src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@gt': gt } },
  server: { port: 5190, strictPort: true, fs: { allow: ['../..'] } },
  preview: { port: 5191 },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    environment: 'jsdom',
    css: false,
    setupFiles: ['test/setup.ts'],
    // Testy bazy biegną tylko z lokalnym Supabase (`npm run test:db`).
    exclude: [...configDefaults.exclude, ...(process.env.SZTAB_DB_TESTS ? [] : ['test/db/**'])],
  },
});
