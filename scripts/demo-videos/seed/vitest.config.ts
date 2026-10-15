// The seed generator runs as a vitest file: the app's own Vite config (the food catalogs use
// `import.meta.glob`) and its test setup (in-memory IndexedDB for the check of the diet half).
// The app's test run leaves it out (`scripts/demo-videos/**` is excluded in vite.config.ts).
import { configDefaults, defineConfig } from 'vitest/config';
import app from '../../../vite.config.ts';

export default defineConfig((env) => {
  const base = app(env);
  return {
    ...base,
    test: { ...base.test, include: ['scripts/demo-videos/seed/*.seed.ts'], exclude: configDefaults.exclude },
  };
});
