import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Kroje pisma z paczki, nie z Google Fonts: działają offline od pierwszej wizyty, nie wysyłają
// nikogo do cudzego serwera, a obrazki do udostępnienia dostają prawdziwe litery.
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Brak elementu #root w index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/*
 * Praca offline. Tylko w wersji zbudowanej: w trybie deweloperskim service worker trzymałby
 * stare pliki i każda zmiana wymagałaby twardego odświeżenia. W osadzonym artefakcie
 * rejestracja bywa zablokowana — wtedy aplikacja po prostu działa jak dotąd, online.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
