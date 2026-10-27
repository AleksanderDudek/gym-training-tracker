import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { RootBoundary } from './components/RootBoundary';
import { downloadModelInBackground } from './food/photo/background';
import { LANG, text } from './i18n';
import { startPwa } from './pwa';
// Kroje pisma z paczki, nie z Google Fonts: działają offline od pierwszej wizyty, nie wysyłają
// nikogo do cudzego serwera, a obrazki do udostępnienia dostają prawdziwe litery.
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './styles.css';

// Service worker rusza tu, poza Reactem: także wersja, która wywróci się przy pierwszym renderze,
// zapyta o nowszą, a ekran awarii (`RootBoundary`) ją wpuści. W trybie deweloperskim
// `virtual:pwa-register` jest pusty — bez service workera.
startPwa(registerSW);
// Model rozpoznawania dań ze zdjęcia pobiera się sam, w wolnej chwili po starcie — pierwsze zdjęcie
// posiłku działa wtedy od razu, także bez sieci (`src/food/photo/background.ts`).
downloadModelInBackground();

// Język strony dla czytników ekranu, dzielenia wyrazów i tłumacza przeglądarki — `index.html` ma
// polski na sztywno, a wizyta może być po angielsku.
document.documentElement.lang = LANG;
document
  .querySelector('meta[name="description"]')
  ?.setAttribute(
    'content',
    text({
      pl: 'Trening siłowy z automatyczną progresją: plan, terminy, przekąski ruchowe i osiągnięcia.',
      en: 'Strength training with automatic progression: a plan, deadlines, exercise snacks and achievements.',
    }),
  );

const root = document.getElementById('root');
if (!root) throw new Error('Brak elementu #root w index.html');

createRoot(root).render(
  <StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </StrictMode>,
);
