import { configDefaults, defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// Z rozszerzeniem: tak czyta je też natywny loader konfiguracji (`configLoader: 'native'`), który
// ma zostać domyślnym w kolejnej wersji Vite — bez niego build ostrzega przy każdym starcie.
import { cspPlugin } from './vite/csp.ts';
import { foodData } from './vite/foodData.ts';

/** Skrót na ekranie głównym: ta sama ikona dla wszystkich, jak dotąd. */
const shortcut = (name: string, url: string, shortName?: string) => ({
  name,
  ...(shortName ? { short_name: shortName } : {}),
  url,
  icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
});

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Adres serwera aplikacji z tego samego źródła, z którego Vite wpisuje go do kodu (`.env*` i
    // zmienne środowiska) — polityka przepuszcza dokładnie ten serwer, z którym aplikacja rozmawia.
    cspPlugin(loadEnv(mode, '.', 'VITE_').VITE_API_URL),
    // Baza produktów (`data/food/products.json.gz`) jako plik z wersją w nazwie i `virtual:food-data`.
    foodData(),
    VitePWA({
      // Własny service worker (`src/sw.ts`); build dopisuje do niego tylko listę plików powłoki.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Nowa wersja czeka na „Odśwież” (`UpdateBar`); rejestruje ją `main.tsx` przez `src/pwa.ts`,
      // poza Reactem, żeby i wywracająca się wersja mogła zostać zastąpiona (`RootBoundary`).
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'GYM TRACKER',
        short_name: 'Gym Tracker',
        description: 'Trening siłowy z automatyczną progresją: plan, terminy, przekąski ruchowe i osiągnięcia.',
        lang: 'pl',
        dir: 'ltr',
        // Adresy względne, jak cała aplikacja (`base: './'`): działa pod dowolną ścieżką na Pages.
        id: './',
        start_url: './#/sesja',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#D7D9D3',
        theme_color: '#FAFAF8',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          shortcut('Przekąska ruchowa', './#/przekaski/dodaj', 'Przekąska'),
          shortcut('Jedzenie dziś', './#/jedzenie', 'Jedzenie'),
          shortcut('Przepisy', './#/przepisy'),
          shortcut('Sklepy w pobliżu', './#/w-poblizu', 'Sklepy'),
          shortcut('Osiągnięcia', './#/osiagniecia'),
        ],
      },
      // Ikony łapie już wzorzec niżej, a manifest wtyczka dopisuje do listy sama — inaczej każde
      // z nich stałoby na liście dwa razy.
      includeManifestIcons: false,
      injectManifest: {
        // Powłoka i kroje pisma w alfabecie łacińskim (z polskimi znakami). Pozostałe alfabety
        // przeglądarka pobiera dopiero, gdy trafi na taki znak; baza produktów ma własną kopię.
        globPatterns: ['**/*.{js,css,html,svg,png}', 'assets/*latin*.woff2'],
        // Bazy jedzenia nie idą do instalacji: produkty i dane sklepów internetowych service worker
        // zapisuje dopiero przy pierwszym wejściu w Jedzenie (`src/sw.ts`), po jednej kopii.
        globIgnores: ['data/**', 'assets/shopData-*.js'],
      },
      // W trybie deweloperskim bez service workera: trzymałby stare pliki i każda zmiana
      // wymagałaby twardego odświeżenia.
      devOptions: { enabled: false },
    }),
  ],
  base: './',
  build: { outDir: 'dist' },
  // Bez tego Vitest podstawia pusty tekst pod każdy import arkusza — także pod
  // `styles.css?raw`, na którym stoi test kontrastu tokenów.
  // `setupFiles`: dopasowania jest-dom, IndexedDB w pamięci (dziennik jedzenia na Dexie) i sprzątanie
  // po Testing Library w testach z `@vitest-environment jsdom`.
  // `.claude/**`: robocze kopie repozytorium (git worktree) leżą w katalogu projektu — ich testy
  // to cudza gałąź, nie ta.
  test: { css: true, setupFiles: ['src/test/setup.ts'], exclude: [...configDefaults.exclude, '.claude/**'] },
}));
