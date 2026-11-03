import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './styles.css';
import { LANG } from '@gt/i18n';
import { App } from './App';

document.documentElement.lang = LANG;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
