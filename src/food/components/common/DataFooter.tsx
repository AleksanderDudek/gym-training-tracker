import foodData from 'virtual:food-data';
import type { ReactNode } from 'react';
import { text } from '../../../i18n';
import { formatDate } from '../../lib/format';
import { DATA_CHAINS } from '../../chains/chains';
import { ONLINE_SHOPS } from '../../online/shops';
import type { Dataset } from '../../lib/types';
import './common.css';

const T = text({
  pl: {
    sources: (off: ReactNode, prices: ReactNode, osm: ReactNode): ReactNode => (
      <>
        Dane produktów: {off} (licencja ODbL), zdjęcia na licencji CC BY-SA. Ceny: {prices}. Mapa i sklepy: © {osm} (ODbL).
      </>
    ),
    online: (shops: string) =>
      `Produkty sklepów internetowych (${shops}): nazwy, wartości odżywcze, ceny i odnośniki ze stron sklepów i producentów, sprawdzone w dniu podanym przy produkcie — w sklepie mogą być już inne.`,
    chains: (chains: string) =>
      `Produkty sieci ${chains}: nazwy, EAN, wartości odżywcze, alergeny i ceny regularne z wyszukiwarki produktów na stronie sieci (jedna hala), sprawdzone w dniu podanym przy cenie — w hali mogą być inne.`,
    prepared: (date: string) => `Dane przygotowane ${date}`,
    prices: (date: string) => `, ceny pobrane ${date}`,
    users: 'Dane tworzą użytkownicy, więc mogą być niepełne lub błędne.',
  },
  en: {
    sources: (off: ReactNode, prices: ReactNode, osm: ReactNode): ReactNode => (
      <>
        Product data: {off} (ODbL licence), photos under the CC BY-SA licence. Prices: {prices}. Map and shops: © {osm} (ODbL).
      </>
    ),
    online: (shops: string) =>
      `Online shop products (${shops}): names, nutrition facts, prices and links from the shops’ and producers’ sites, checked on the date shown with the product — the shop may have changed them since.`,
    chains: (chains: string) =>
      `${chains} products: names, EAN, nutrition facts, allergens and regular prices from the product search on the chain’s site (one store), checked on the date shown with the price — in store they may differ.`,
    prepared: (date: string) => `Data prepared on ${date}`,
    prices: (date: string) => `, prices fetched on ${date}`,
    users: 'The data is added by users, so it may be incomplete or wrong.',
  },
});

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
        {T.sources(
          <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">
            Open Food Facts
          </a>,
          <a href="https://prices.openfoodfacts.org" target="_blank" rel="noopener noreferrer">
            Open Prices
          </a>,
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>,
        )}
      </p>
      {ONLINE_SHOPS.length > 0 && (
        <p>{T.online(ONLINE_SHOPS.map((s) => s.name).join(', '))}</p>
      )}
      {DATA_CHAINS.length > 0 && (
        <p>{T.chains(DATA_CHAINS.map((c) => c.name).join(', '))}</p>
      )}
      <p>
        {generatedAt && (
          <>
            {T.prepared(formatDate(generatedAt))}
            {prices && T.prices(formatDate(prices))}.{' '}
          </>
        )}
        {T.users}
      </p>
    </footer>
  );
}
