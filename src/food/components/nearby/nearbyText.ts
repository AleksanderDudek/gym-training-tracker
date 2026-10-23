import { LOCALE, text } from '../../../i18n';

const DATE = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });

/** „22 października 2026” from the data's ISO date; nothing when it is unknown or unreadable. */
export function dataDate(iso: string | null): string | null {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? DATE.format(ms) : null;
}

/** Words both „W pobliżu” views share: where the data comes from and where the position goes. */
export const NT = text({
  pl: {
    privacy:
      'W Polsce lokale i sklepy pochodzą z kopii danych OpenStreetMap dołączonej do aplikacji: telefon pobiera z serwera aplikacji (GitHub Pages) tylko pliki z fragmentami mapy wokół Twojej pozycji zaokrąglonej do ok. 100 m (w mieście kawałki od ok. 0,6 km, poza miastem do kilkudziesięciu km) i zapamiętuje je na tym urządzeniu. Za granicą, przy granicy i wtedy, gdy danych aplikacji nie da się odczytać z jej serwera, pozycja zaokrąglona do ok. 100 m trafia do serwera Overpass z danymi OpenStreetMap (overpass-api.de, zapasowo overpass.private.coffee). Oglądany fragment mapy idzie do tile.openstreetmap.org. Pozycji nie ma w adresie strony, a ostatnie miejsce zostaje tylko na tym urządzeniu.',
    credit: 'Lokale i sklepy:',
    authors: '© autorzy OpenStreetMap',
    license: 'licencja ODbL',
    asOf: (date: string) => `stan z ${date}`,
    live: 'na żywo z serwera Overpass',
    border: 'przy granicy na żywo z serwera Overpass',
  },
  en: {
    privacy:
      'In Poland, places and shops come from a copy of OpenStreetMap data shipped with the app: your phone downloads from the app’s server (GitHub Pages) only the files with parts of the map around your position rounded to about 100 m (pieces from about 0.6 km in a city, up to a few dozen km outside) and keeps them on this device. Abroad, near the border, and when the app’s data can’t be read from its server, your position rounded to about 100 m goes to the Overpass server with OpenStreetMap data (overpass-api.de, with overpass.private.coffee as a backup). The part of the map you’re viewing goes to tile.openstreetmap.org. Your position isn’t in the page address, and the last place stays only on this device.',
    credit: 'Places and shops:',
    authors: '© OpenStreetMap contributors',
    license: 'ODbL licence',
    asOf: (date: string) => `data as of ${date}`,
    live: 'live from the Overpass server',
    border: 'near the border live from the Overpass server',
  },
});
