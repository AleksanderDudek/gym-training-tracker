import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
  // Bez tego Vitest podstawia pusty tekst pod każdy import arkusza — także pod
  // `styles.css?raw`, na którym stoi test kontrastu tokenów.
  test: { css: true },
});
