# Dane OpenStreetMap · OpenStreetMap data

**`places-pl.tsv`** — nazwane (nazwą albo marką) lokale i sklepy spożywcze w Polsce wycięte
z OpenStreetMap: fast food, restauracje, kawiarnie, stacje paliw, food courty, lodziarnie, sklepy
spożywcze, piekarnie, cukiernie, sklepy z kawą oraz hale Selgros i Makro (reguły wyboru:
`src/food/nearby/osmTags.ts`). Z każdego obiektu tylko jego środek i tagi `amenity`, `shop`, `name`,
`brand`, `opening_hours`, `cuisine`, `addr:street`, `addr:place`, `addr:housenumber`.
**`meta.json`** — data danych OSM (`dataAsOf`) i liczby obiektów.

**Źródło:** [wyciąg OpenStreetMap dla Polski z Geofabrik](https://download.geofabrik.de/europe/poland.html).

**Licencja:** © autorzy OpenStreetMap (OpenStreetMap contributors), dane na licencji
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/), zob.
<https://www.openstreetmap.org/copyright>. Ten katalog to baza pochodna: udostępniamy ją na ODbL
razem z metodą, którą powstała — skryptem `scripts/food/osm-places.ts` (`npm run food:osm`).

**W aplikacji:** build tnie plik na małe kawałki (`data/osm/v1/…`: indeks i pliki JSON spakowane
gzipem, drobniejsze tam, gdzie lokali gęsto), a „W pobliżu” pobiera tylko te z okolicy szukanego
miejsca. Za granicą i przy granicy dalej pyta serwery Overpass.

## Odświeżanie

Lokalnie, z [osmium-tool](https://osmcode.org/osmium-tool/):

```bash
brew install osmium-tool    # Debian/Ubuntu: sudo apt-get install osmium-tool
npm run food:osm            # pobiera wyciąg (ok. 2 GB), filtruje go i zapisuje oba pliki
```

Opcje po `--` (dokładny opis w nagłówku skryptu): `--pbf=…` — wyciąg już pobrany, `--filtered=…` —
wyciąg już przefiltrowany (`osmium tags-filter`), `--poly=…` — granica (plik `.poly`) z dysku,
`--keep-pbf` — pobrany wyciąg zostaje na następny raz, `--force` — zapisuje mimo niezaliczonych
kontroli (liczba miejsc, rodzaje, Warszawa, hale, data, granice — `gates` w `scripts/food/lib/osm.ts`),
które najpierw wypisuje; bez niego skrypt przy niezaliczonej kontroli nie zapisuje niczego.
`OSM_CACHE_DIR` — katalog na pobrane pliki. Na GitHubie: Actions → **Dane OSM** → Run workflow —
odświeża dane, które mają co najmniej 156 h (opcja `force` workflow pomija tylko ten próg wieku,
nigdy kontroli skryptu), sprawdza je testami, zapisuje commitem do `main` i wdraża stronę.

Znana różnica wobec zapytań Overpass: kopia ma tylko relacje-multipoligony (budynki jako `type=building`
osmium pomija) — w całej Polsce to kilka obiektów.

## In English

**`places-pl.tsv`** — named (by name or brand) food places and grocery shops in Poland cut from
OpenStreetMap: fast food, restaurants, cafés, fuel stations, food courts, ice cream parlours, grocery
shops, bakeries, pastry and coffee shops, and Selgros and Makro halls (selection rules:
`src/food/nearby/osmTags.ts`). Each object keeps only its centre and the tags `amenity`, `shop`,
`name`, `brand`, `opening_hours`, `cuisine`, `addr:street`, `addr:place`, `addr:housenumber`.
**`meta.json`** — the OSM data date (`dataAsOf`) and object counts.

**Source:** [the Geofabrik extract of OpenStreetMap for Poland](https://download.geofabrik.de/europe/poland.html).

**Licence:** © OpenStreetMap contributors, data available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/); see
<https://www.openstreetmap.org/copyright>. This folder is a derived database, offered under the ODbL
together with the method that produced it: `scripts/food/osm-places.ts` (`npm run food:osm`).

**In the app:** the build cuts the file into small pieces (`data/osm/v1/…`: an index and gzipped
JSON files, finer where places are dense), and "W pobliżu" (Nearby) downloads only those around the
searched place. Abroad and near the border it still asks Overpass servers.

**Refresh:** locally with osmium-tool (Homebrew or apt, as above) and `npm run food:osm` with the
options above (details in the script's header), downloads in `OSM_CACHE_DIR`. The script checks the
new copy against the previous one (row counts, kinds, Warsaw, the wholesale halls, the data date, the
border box) and writes nothing when a check fails, unless `--force` (it prints the failures first).
On GitHub the **Dane OSM** workflow (run by hand) refreshes data at least 156 h old (its `force` only
skips that age check, never the script's checks), tests it, commits it to `main` and deploys the site.

Known difference from the Overpass queries: the copy holds only multipolygon relations (osmium skips
`type=building` relations) — a handful of objects in all of Poland.
