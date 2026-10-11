import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { RootBoundary } from './components/RootBoundary';
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

const root = document.getElementById('root');
if (!root) throw new Error('Brak elementu #root w index.html');

createRoot(root).render(
  <StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </StrictMode>,
);
