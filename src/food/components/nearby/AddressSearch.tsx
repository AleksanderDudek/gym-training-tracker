import { MapPin, Search } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import { text } from '../../../i18n';
import { GeocodeUnavailable, geocode, type GeoHit } from '../../nearby/geocode';
import type { LatLon } from '../../nearby/types';

const T = text({
  pl: {
    open: 'Wpisz adres zamiast lokalizacji',
    label: 'Adres albo miejsce',
    placeholder: 'np. Długa 1, Gdańsk',
    search: 'Szukaj',
    searching: 'Szukam…',
    none: 'Nic nie znalazłem. Dopisz miasto albo sprawdź pisownię.',
    failed: 'Nie udało się wyszukać. Sprawdź połączenie z internetem.',
    results: 'Wyniki wyszukiwania',
    privacy: 'Wpisany adres trafia do wyszukiwarki Nominatim (OpenStreetMap).',
  },
  en: {
    open: 'Type an address instead of your location',
    label: 'Address or place',
    placeholder: 'e.g. 10 Downing Street, London',
    search: 'Search',
    searching: 'Searching…',
    none: 'Nothing found. Add the city or check the spelling.',
    failed: 'Couldn’t search. Check your internet connection.',
    results: 'Search results',
    privacy: 'The address you type goes to the Nominatim search (OpenStreetMap).',
  },
});

/**
 * „Wpisz adres”: a hotel, a meeting point, a street in a city you do not know. Nominatim is asked
 * only when the form is sent - its usage policy forbids searching while typing - and the chosen
 * result becomes the position, like a tap on the map.
 */
export function AddressSearch({ onPick }: { onPick: (position: LatLon) => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<GeoHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const inputId = useId();

  const search = async (e: FormEvent) => {
    e.preventDefault();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      const found = await geocode(query, { signal: controller.signal });
      setHits(found);
      if (!found.length) setError(T.none);
    } catch (err) {
      if (controller.signal.aborted) return;
      setHits(null);
      setError(err instanceof GeocodeUnavailable ? err.message : T.failed);
    } finally {
      if (request.current === controller) setBusy(false);
    }
  };

  return (
    <details className="fd-near-address">
      <summary>{T.open}</summary>
      <form className="fd-near-address-form" onSubmit={(e) => void search(e)}>
        <label htmlFor={inputId}>{T.label}</label>
        <div className="fd-near-address-row">
          <input
            id={inputId}
            type="search"
            enterKeyHint="search"
            autoComplete="street-address"
            value={query}
            placeholder={T.placeholder}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn sm" disabled={busy || query.trim().length < 3}>
            <Search size={18} strokeWidth={2} aria-hidden />
            {busy ? T.searching : T.search}
          </button>
        </div>
      </form>
      <p role="status" className="fd-near-address-status">
        {error}
      </p>
      {hits && hits.length > 0 && (
        <ul className="fd-near-address-hits" aria-label={T.results}>
          {hits.map((hit) => (
            <li key={`${hit.lat},${hit.lon}`}>
              <button
                type="button"
                className="fd-near-address-hit"
                onClick={() => {
                  onPick({ lat: hit.lat, lon: hit.lon });
                  setHits(null);
                }}
              >
                <MapPin size={18} strokeWidth={2} aria-hidden />
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">{T.privacy}</p>
    </details>
  );
}
