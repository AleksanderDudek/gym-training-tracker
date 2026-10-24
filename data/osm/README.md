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
miejsca. Za granicą, przy granicy i gdy danych aplikacji nie da się odczytać z jej serwera, dalej
pyta serwery Overpass.

## Odświeżanie

Lokalnie, z [osmium-tool](https://osmcode.org/osmium-tool/):

```bash
brew install osmium-tool    # Debian/Ubuntu: sudo apt-get install osmium-tool
npm run food:osm            # pobiera wyciąg (ok. 2 GB), filtruje go i zapisuje oba pliki
```

Opcje po `--` (dokładny opis w nagłówku skryptu): `--pbf=…` — wyciąg już pobrany, `--filtered=…` —
wyciąg już przefiltrowany (`osmium tags-filter`), `--poly=…` — granica (plik `.poly`) z dysku,
`--keep-pbf` — pobrany wyciąg zostaje na następny raz, `--force` — zapisuje mimo niezaliczonych
kontroli (liczba miejsc, rodzaje, Warszawa, hale, data, granice — `gates` w `scripts/food/lib/osm.ts` —
i kompletność eksportu, niżej), które najpierw wypisuje; bez niego skrypt przy niezaliczonej kontroli
nie zapisuje niczego.
`OSM_CACHE_DIR` — katalog na pobrane pliki. Na GitHubie: Actions → **Dane OSM** → Run workflow —
odświeża dane, które mają co najmniej 156 h (opcja `force` workflow pomija tylko ten próg wieku,
nigdy kontroli skryptu), sprawdza je testami, zapisuje commitem do `main` i wdraża stronę.

**Kompletność eksportu.** osmium pomija obiekty, których geometrii nie umie zbudować (zepsuty
multipoligon, multipoligon ze składową spoza wyciągu, zamknięta droga z `area=yes` z trzech punktów
albo przecinająca samą siebie), często bez żadnego komunikatu; jego błędy geometrii zwykle nie mają
identyfikatorów i dotyczą też obiektów, które w kopii są (zamknięta droga bez `area=yes`, której
obszar się nie składa, zostaje jako linia). Dlatego skrypt wypisuje osobno (`osmium tags-filter -R`)
obiekty przefiltrowanego wyciągu, które same pasują do filtra (bez punktów i składowych dobranych do
nich), ocenia je tą samą regułą co wiersze kopii (`rowTags`) i porównuje z kopią: podaje, ilu brakuje,
i do 20 brakujących z nazwą i linkiem do openstreetmap.org. Ponad 50 brakujących zatrzymuje
odświeżenie, 1–50 to ostrzeżenie (w GitHub Actions także adnotacja przebiegu); błędy geometrii osmium
skrypt tylko liczy.

**Relacje, z których osmium nie robi obszarów.** Z relacji osmium export buduje obszary tylko
z multipoligonów i granic (`type=multipolygon`, `type=boundary`); o innych (`type=site`,
`type=building`, bez `type`) nie pisze nic. Overpass podaje je ze środkiem (`out center`), więc skrypt
robi to samo: bierze ich składowe z przefiltrowanego wyciągu (`osmium getid -r`) i stawia każdą taką
relację w środku prostokąta obejmującego jej punkty i wszystkie punkty jej dróg — jak Overpass, który
też pomija składowe będące relacjami (relacja z samych relacji nie ma u niego środka). W kontroli
kompletności liczą się jak każdy wiersz. Poza kopią zostaje tylko relacja, której nie ma po czym
ustawić: żadnej z jej składowych nie ma w wyciągu (np. wszystkie są za granicą) albo wszystkie są
relacjami — skrypt liczy takie osobno, wierszem „known gap”. W październiku 2026 takich nie było:
wszystkie 4 (3 relacje `type=building` i hala Makro w Sosnowcu jako `type=site`) są w kopii.

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
searched place. Abroad, near the border and when the app's data cannot be read from its server, it
still asks Overpass servers.

**Refresh:** locally with osmium-tool (Homebrew or apt, as above) and `npm run food:osm` with the
options above (details in the script's header), downloads in `OSM_CACHE_DIR`. The script checks the
new copy against the previous one (row counts, kinds, Warsaw, the wholesale halls, the data date, the
border box), checks the export's completeness (below) and writes nothing when a check fails, unless
`--force` (it prints the failures first).
On GitHub the **Dane OSM** workflow (run by hand) refreshes data at least 156 h old (its `force` only
skips that age check, never the script's checks), tests it, commits it to `main` and deploys the site.

**Export completeness.** osmium leaves out objects whose geometry it cannot build (a broken
multipolygon, one with a member outside the extract, a closed `area=yes` way of three nodes or one that
crosses itself), often without a message; its geometry errors mostly carry no ids and also concern
objects that are in the copy (a closed way without `area=yes` whose area does not build stays as a
line). So the script lists separately (`osmium tags-filter -R`) the objects of the filtered extract
that match the filter themselves (not the nodes and members pulled in for them), judges them by the
same rule as the copy's rows (`rowTags`) and compares: it prints how many are missing and up to 20 of
them with their name and an openstreetmap.org link. More than 50 missing stop the refresh, 1–50 are a
warning (on GitHub Actions also an annotation on the run); osmium's geometry errors are only counted.

**Relations osmium makes no area of.** Of relations, osmium export builds areas only from
multipolygons and boundaries (`type=multipolygon`, `type=boundary`) and writes nothing for the others
(`type=site`, `type=building`, no `type`). Overpass returns them with a centre (`out center`), so the
script does the same: it takes their members from the filtered extract (`osmium getid -r`) and places
each such relation at the centre of the bounding box of its member nodes and every node of its member
ways — as Overpass does, which also leaves member relations out (a relation of relations gets no centre
there). The completeness check counts them like any other row. Only a relation with nothing to place
it by stays out — none of its members is in the extract (all beyond the border, say), or all are
relations; the script counts those apart, on its "known gap" line. In October 2026 there were none: all
4 (3 `type=building` relations and the Makro hall in Sosnowiec mapped as `type=site`) are in the copy.
