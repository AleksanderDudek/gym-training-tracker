// Wspólne przygotowanie testów. Większość testów siłowni biegnie w środowisku node; te, które
// renderują albo dotykają `window` (część jedzenia), mają w pierwszej linijce
// `// @vitest-environment jsdom`.
import '@testing-library/jest-dom/vitest';
// IndexedDB w pamięci: dziennik jedzenia stoi na Dexie.
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

if (typeof window !== 'undefined') {
  // Testing Library tylko tam, gdzie jest DOM — testy w node nie płacą za wczytanie React DOM.
  const { cleanup, configure } = await import('@testing-library/react');

  // Ekrany jedzenia ładują się na żądanie (React.lazy): pierwszy render czeka na dynamiczny import,
  // co przy pełnym, równoległym przebiegu potrafi trwać dłużej niż domyślna 1 s.
  configure({ asyncUtilTimeout: 4000 });

  // Testing Library sprząta po teście sama tylko przy globalnym `afterEach`, a Vitest wystawia go
  // dopiero z `globals: true`.
  afterEach(() => cleanup());

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
