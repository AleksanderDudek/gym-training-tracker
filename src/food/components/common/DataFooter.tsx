import foodData from 'virtual:food-data';
import { formatDate } from '../../lib/format';
import { ONLINE_SHOPS } from '../../online/shops';
import type { Dataset } from '../../lib/types';
import './common.css';

/**
 * Źródła i licencje danych pod ekranami jedzenia. ODbL i CC BY-SA wymagają podania źródła tam,
 * gdzie dane się pokazuje. Data bazy przychodzi z wczytanej bazy, a zanim ta się wczyta (albo na
 * ekranie, który bazy nie potrzebuje) — z `virtual:food-data`, który zna ją od chwili builda.
 */
export function DataFooter({ dataset }: { dataset?: Dataset }) {
  const generatedAt = dataset?.generatedAt ?? foodData.generatedAt;
  const prices = dataset?.sources.prices;
  return (
    <footer className="fd-foot">
      <p>
        Dane produktów:{' '}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">
          Open Food Facts
        </a>{' '}
        (licencja ODbL), zdjęcia na licencji CC BY-SA. Ceny:{' '}
        <a href="https://prices.openfoodfacts.org" target="_blank" rel="noopener noreferrer">
          Open Prices
        </a>
        . Mapa i sklepy: ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>{' '}
        (ODbL).
      </p>
      {ONLINE_SHOPS.length > 0 && (
        <p>
          Produkty sklepów internetowych ({ONLINE_SHOPS.map((s) => s.name).join(', ')}): nazwy, wartości odżywcze, ceny
          i odnośniki ze stron sklepów i producentów, sprawdzone w dniu podanym przy produkcie — w sklepie mogą być już
          inne.
        </p>
      )}
      <p>
        {generatedAt && (
          <>
            Dane przygotowane {formatDate(generatedAt)}
            {prices && <>, ceny pobrane {formatDate(prices)}</>}.{' '}
          </>
        )}
        Dane tworzą użytkownicy, więc mogą być niepełne lub błędne.
      </p>
    </footer>
  );
}
