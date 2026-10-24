// Wspólne przygotowanie testów. Większość testów siłowni biegnie w środowisku node; te, które
// renderują albo dotykają `window` (część jedzenia), mają w pierwszej linijce
// `// @vitest-environment jsdom`.
// IndexedDB w pamięci: dziennik jedzenia stoi na Dexie (jego testy biegną też w node).
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
// Sam typ: deklaracja `__KB_LANG__` w `globalThis`, bez wczytania modułu języka przed testem.
import type {} from '../i18n';

// Testy piszą po polsku, więc język jest polski bez względu na język maszyny. Test po angielsku
// ustawia go sam, zanim cokolwiek zaimportuje: `vi.hoisted(() => { globalThis.__KB_LANG__ = 'en'; })`.
globalThis.__KB_LANG__ = 'pl';

if (typeof window !== 'undefined') {
  // Dopasowania jest-dom i Testing Library tylko tam, gdzie jest DOM: testy w node nie płacą
  // za ich wczytanie (jest-dom sam w sobie to około sekundy na pełny przebieg).
  await import('@testing-library/jest-dom/vitest');
  const { cleanup, configure } = await import('@testing-library/react');

  // Ekrany jedzenia ładują się na żądanie (React.lazy): pierwszy render czeka na dynamiczny import,
  // co przy pełnym, równoległym przebiegu potrafi trwać dłużej niż domyślna 1 s.
  configure({ asyncUtilTimeout: 4000 });

  // Testing Library sprząta po teście sama tylko przy globalnym `afterEach`, a Vitest wystawia go
  // dopiero z `globals: true`.
  afterEach(() => cleanup());

  // Każdy test to nowa karta: jej pamięć (`sessionStorage`, np. miejsce wybrane ręcznie, które
  // przetrwałoby przeładowanie) nie przechodzi do następnego.
  afterEach(() => window.sessionStorage.clear());

  // jsdom ma <dialog> bez jego metod. Komponenty wołają je jak w przeglądarce, więc zastępstwo
  // stoi tu, a nie w komponentach.
  if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
