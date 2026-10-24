# Aplikacja na zegarek Garmin

Mała aplikacja Connect IQ, która co pół godziny wysyła do serwera GYM TRACKER zaszyfrowany
tydzień danych z zegarka: kroki, drogę, piętra, minuty intensywności, aktywności, tętno, stres,
Body Battery i średnie tętno spoczynkowe.

Wyniku snu nie ma: Connect IQ podaje go tylko przez Complications, a te może subskrybować
wyłącznie tarcza zegarka (`ComplicationSubscriber` jest niedozwolone dla `watch-app`). Miejsce
w paczce zostaje puste.

## Dlaczego własna aplikacja na zegarek

- **Oficjalne API Garmina (Health API) jest zamknięte.** Przyjmuje tylko firmy, a od wiosny 2026
  roku formularz zgłoszeń stoi „w przebudowie”, bez daty.
- **Logowanie do Garmin Connect cudzym hasłem odpada.** Serwer musiałby trzymać hasło,
  łamałoby to regulamin Garmina, a każda zmiana logowania by to psuła.
- **Strona nie czyta Apple Health ani Health Connect.** Potrzebna byłaby aplikacja natywna
  w sklepach zamiast strony na GitHub Pages.

Aplikacja Connect IQ nie potrzebuje zgody Garmina na dostęp do danych. Czyta je na zegarku
i wysyła przez aplikację Garmin Connect na telefonie.

## Jak to działa

1. W aplikacji GYM TRACKER (Ustawienia → Zegarek Garmin) powstaje klucz: 32 losowe bajty,
   pokazane jako 64 znaki hex. Klucz leży tylko w tej przeglądarce i nie trafia do eksportu danych.
2. Klucz wkleja się w ustawieniach aplikacji na zegarku, w Garmin Connect na telefonie
   (zegarek → Aktywności i aplikacje → GYM TRACKER → Ustawienia).
3. Co 30 minut przebieg w tle (`SyncService`) zbiera dane (`Collect`) i pieczętuje je (`Seal`):
   AES-256-CBC i HMAC-SHA256, kluczami wyprowadzonymi z klucza. Potem wysyła paczkę na
   `POST /garmin/push`.
4. Serwer trzyma tylko najnowszą paczkę i nie zna klucza. Aplikacja odbiera ją przy otwarciu,
   sprawdza podpis, odszyfrowuje i scala.

## Ekran na zegarku

Ekran aplikacji mówi, jak poszła ostatnia wysyłka i kiedy następna — to pierwsze miejsce, w które
ktoś patrzy, gdy w aplikacji brakuje danych:

- **ostatnia wysyłka** — „Sent 14:32” / „Wysłane 14:32”, „No phone - Bluetooth?” / „Brak
  telefonu - Bluetooth?” (zegarek nie dogadał się z telefonem — najczęściej wyłączony Bluetooth
  albo telefon za daleko), „Wrong key” / „Zły klucz”, „Paste the key in Garmin Connect”, gdy
  klucza nie ma. Ten sam tekst stoi w podglądzie (glance) na liście aplikacji;
- **następna wysyłka** — „Next ~15:02” / „Następna ok. 15:02”: ostatni przebieg w tle plus pół
  godziny; „Next soon” / „Następna wkrótce”, gdy ta pora już minęła, i „Next within 30 min” /
  „Następna w ciągu 30 min”, gdy przebiegu jeszcze nie było (rusza pół godziny po pierwszym
  otwarciu). Czas ostatniego przebiegu zapisuje sam przebieg w `Storage` (`Sync.LAST_RUN`), bo
  `Background.getLastTemporalEventTime()` zwraca `null` po każdym otwarciu aplikacji — czyli
  właśnie wtedy, gdy ktoś patrzy na ten ekran. Podgląd tej linii nie ma: ma osobną, małą pulę
  pamięci;
- **START** (albo stuknięcie) wysyła od razu.

Myślnik w tekstach to zwykły „-”: nie każdy zegarek ma w czcionce systemowej długą pauzę.
Karta „Zegarek Garmin” w aplikacji cytuje te same teksty w liście „Dane nie przychodzą?”.

**Nową wersję trzeba wgrać.** Zmiany ekranu działają dopiero po nowym buildzie
w sklepie: najpierw `./build.sh beta` i nowa wersja bety, a po publikacji także `./build.sh store`
i nowa wersja aplikacji publicznej (kroki niżej). Zegarek ze starą wersją dalej wysyła paczki —
pokazuje tylko stary tekst („No phone nearby”) i nie mówi, kiedy następna.

Format koperty i paczki opisują `src/watchseal.ts` i `src/engine/watch.ts`. Plik `SealTest.mc`
sprawdza ten sam wektor co testy aplikacji: jeśli zegarek i przeglądarka się rozjadą, test
nie przejdzie.

## Build i publikacja

Potrzebne: [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/) — SDK Manager, konto
Garmin, najnowsze SDK i urządzenia z `manifest.xml` (co najmniej twój zegarek) — oraz Java 17+.
Adres serwera (`api` w `resources/settings/properties.xml`) jest już wpisany.

```bash
cd garmin
./build.sh test fr265     # testy w symulatorze: wektor koperty i czytanie klucza
./build.sh run fr265      # aplikacja w symulatorze (ustawienia: File → Edit Persistent Storage)
./build.sh store          # bin/gymtracker.iq — publikacja w sklepie (wszystkie zegarki z manifestu)
./build.sh beta           # bin/gymtracker-beta.iq — ta sama paczka z identyfikatorem bety
                          # (store i beta najpierw sprawdzają listę zegarków — niżej „Lista zegarków”)
./build.sh shots fr265    # symulator z jednorazowym kluczem — zrzuty do sklepu
./build.sh prg fr265      # bin/gymtracker-fr265.prg — do wgrania przez USB
```

Przy pierwszym buildzie skrypt tworzy klucz dewelopera w `~/.garmin/developer_key.der` (albo
bierze ten z `CIQ_KEY`). **Zrób jego kopię** — każdą kolejną wersję w sklepie trzeba podpisać
tym samym kluczem, inaczej to będzie nowa aplikacja.

**Najpierw beta, potem sklep.** Od 2026 roku wgrywa się na nowym panelu
**apps-developer.garmin.com**, a instaluje wyłącznie przez aplikację **Connect IQ Store** na
telefonie — strona sklepu już nie instaluje.

1. `./build.sh beta`, potem [apps-developer.garmin.com](https://apps-developer.garmin.com)
   (konto Garmin, to samo co w Garmin Connect) → wgraj `bin/gymtracker-beta.iq`, zaznacz
   **Beta App** (kolejna wersja: nowa wersja tej samej bety). Beta widzisz tylko ty
   i nie przechodzi recenzji. Na liście „Uploaded Apps” bety stoją na samym dole.
2. Skopiuj identyfikator aplikacji z panelu i otwórz na telefonie
   `https://apps.garmin.com/apps/<identyfikator>` — link otworzy aplikację Connect IQ Store
   z przyciskiem instalacji. (Linki z nowego panelu jeszcze jej nie otwierają — błąd zgłoszony
   Garminowi, CIQQA-3722.)
3. Karta „Zegarek Garmin”, w której powstaje klucz, jest w GYM TRACKER zawsze, gdy build zna
   serwer. Jej link do sklepu prowadzi do wersji publicznej — adres stoi w kodzie
   (`GARMIN_STORE_URL` w `src/garmin.ts`). Żeby na czas testów link prowadził do bety, nadpisz go
   zmienną w GitHubie i wdroż stronę (pusta zmienna niczego nie zmienia):

   ```bash
   gh variable set GARMIN_APP_URL --body "https://apps.garmin.com/apps/<identyfikator>"
   gh workflow run Deploy
   ```

4. Klucz z karty wklej w ustawieniach aplikacji na zegarku. Ustawień bety **nie ma w Garmin
   Connect** — są w aplikacji **Connect IQ Store** na telefonie (urządzenie → GYM TRACKER →
   Ustawienia). Po publikacji są także w Garmin Connect.
5. Otwórz GYM TRACKER na zegarku, START („Wyślij teraz”), a w karcie „Sprawdź teraz” — dane
   powinny przyjść.
6. Publikacja dla wszystkich: przewodnik po angielsku w `store/README.md` — teksty do formularza,
   notatka dla recenzentów, obraz hero, zrzuty, lista kontrolna. Wersja publiczna ma **inny
   identyfikator** niż beta (Garmin nie zamienia bety w aplikację publiczną): `./build.sh store`
   bierze go z `manifest.xml`, `./build.sh beta` podmienia na identyfikator bety. Adres wersji
   publicznej jest już w kodzie, więc po testach bety wystarczy usunąć nadpisanie:
   `gh variable delete GARMIN_APP_URL`.

Bez sklepu, tylko na swój zegarek: `./build.sh prg <zegarek>` i plik do `GARMIN/APPS/` przez USB.
Ustawień takiej aplikacji nie zmienisz w Garmin Connect, więc do testów lepsza jest beta.

## Lista zegarków w GYM TRACKER

„Czy mój zegarek jest obsługiwany?” (Ustawienia → Zegarek Garmin, `#/zegarek`) czyta
`src/watches/garmin.json`: obsługiwane zegarki, to, co każdy z nich wysyła (stres, Body Battery,
przejazdy — według API i wersji Connect IQ jego oprogramowania), wersje azjatyckie (APAC), pamięć
na pracę w tle i zegarki z SDK, na których aplikacja nie działa, z powodem. Ten plik powstaje
skryptem, nie ręcznie:

```bash
npm run garmin:watches               # z manifest.xml i urządzeń z SDK Managera → src/watches/garmin.json
npm run garmin:watches -- --check    # tylko sprawdza, czy zapisana lista jest aktualna (robi to build.sh store i beta)
npm run garmin:watches -- --store    # najpierw odświeża garmin/store-devices.json z katalogu Connect IQ Store
```

- **Źródła:** `manifest.xml`, pliki urządzeń z SDK Managera (`compiler.json` i `<id>.api.debug.xml`
  w `~/Library/Application Support/Garmin/ConnectIQ/Devices`, inny katalog: `CIQ_DEVICES`) oraz
  przycięty katalog urządzeń sklepu `garmin/store-devices.json` (inne nazwy tych samych zegarków,
  np. „Forerunner® 158”). Wersja SDK w liście bierze się z `current-sdk.cfg` (albo z `CIQ_SDK`).
- **Ręczna część** jest w `src/watches/extra.ts`: zegarki bez Connect IQ (Instinct 1. generacji,
  vívomove, Lily…), opaski, wagi i liczniki, zegarki nowsze niż SDK („jeszcze nie”: MARQ Gen 3),
  odrzucone wersje azjatyckie i inne marki.
- **CI nie ma SDK**, więc `src/watches/garmin.test.ts` sprawdza tylko, że manifest i lista mają
  te same zegarki, ten sam identyfikator aplikacji i to samo minimum Connect IQ. Pełne
  sprawdzenie (`--check`) robi `./build.sh store` i `./build.sh beta` przed kompilacją.

**Nowy zegarek Garmina:**

1. Pobierz go w SDK Managerze (Devices) i uruchom `npm run garmin:watches -- --store`.
2. Skrypt ostrzega: „… spełnia warunki listy … a nie ma go w manifest.xml” — dopisz
   `<iq:product id="…"/>` do `manifest.xml` (lista jest alfabetyczna) i zmień liczbę zegarków
   w komentarzu na górze manifestu.
3. Jeszcze raz `npm run garmin:watches`, potem `npm test` i commit `manifest.xml` razem
   z `src/watches/garmin.json` (i `garmin/store-devices.json`, jeśli się zmienił).
4. `./build.sh store` i nowa wersja w sklepie — dopiero ona dochodzi do nowych zegarków.

Zegarek, który sklep już ma, a SDK Manager jeszcze nie (ostrzeżenie przy `--store`: „nowy
w sklepie, a nie ma go w SDK”), dostaje wpis `notYet` w `src/watches/extra.ts` — sprawdzenie
odpowie „Jeszcze nieobsługiwany”, dopóki nie przejdzie kroków wyżej.

## Do sprawdzenia przy pierwszym buildzie

Stan na 21.10.2026 — Connect IQ SDK 9.2.0 z urządzeniami z SDK Managera:

- [x] **Kompilacja z urządzeniami z SDK Managera** — `./build.sh store`: 118 zegarków (195 z 195 wariantów).
- [x] **`SealTest` przechodzi** w symulatorze (fr265, fēnix 6, vívoactive 3 Music z API 3.2.0, Instinct 2): zegarek pieczętuje bajt w bajt
      jak przeglądarka.
- [x] **Paczka z danych symulatora otwiera się kodem strony** (`open` i `parsePayload`):
      dni, zdrowie i koperta z testowym kluczem. Przy tym wyszły i są poprawione dwa błędy:
  - dni z historii (`ActivityMonitor.getHistory`) miały **rok 2046**: zegarek dolicza epokę FIT
    do początku dnia drugi raz, a sekundy roku 2046 nie mieszczą się w 32-bitowym `Number`
    (`Collect.days` liczy to na `Long`). Strona i tak odrzuca dni późniejsze niż jutro;
  - `getStressHistory` z okresem krótszym niż ok. 2 minuty kończył przebieg błędem „Invalid
    Value”, którego `try/catch` nie łapie — np. „Wyślij teraz” tuż po wysyłce w tle. Okres
    zapytania ma teraz co najmniej 10 minut.
- [ ] **Przebieg w tle na zegarku** (`ActivityMonitor`, `SensorHistory`, `UserProfile` w tle,
      pamięć 32 kB na fēnix 6). Symulator odpala go z menu Simulation → Background Events →
      Temporal Event — z terminala się nie da, więc to sprawdzi wersja beta na zegarku.
- [ ] **`UserActivity.startTime`** z prawdziwą aktywnością (symulator nie ma aktywności):
      przejazd z dziś ma mieć w aplikacji dzisiejszą datę.
- [ ] **Polskie znaki na ekranie zegarka** i **odpowiedź serwera** („Wysłane HH:MM”) — na zegarku.
- [x] **Linia „następna wysyłka”** (22.10.2026): `./build.sh store` i `./build.sh beta` — 195 z 195
      wariantów, `NextSendTest` przechodzi w symulatorze (fr265).
- [ ] **Następna wysyłka na zegarku**: po pierwszym przebiegu w tle z nową wersją ekran ma pokazać
      „Następna ok. HH:MM” pół godziny po nim, a dwuliniowy stan („Zły klucz - wklej go jeszcze
      raz”) ma się mieścić na najmniejszych ekranach (Instinct 2, vívoactive 3).

## Pliki

| Plik | Co robi |
| --- | --- |
| `source/GymTrackerApp.mc` | wejście: rejestruje przebieg w tle co 30 min, podgląd, wynik z tła |
| `source/SyncService.mc` | przebieg w tle: zapisuje swój czas (`Sync.LAST_RUN`), `Sync.run` i `Background.exit(kod)` |
| `source/Sync.mc` | jedna wysyłka: paczka v1, koperta, `POST /garmin/push` |
| `source/Collect.mc` | dane z zegarka w kształcie paczki v1; kubełki zdrowia w `Storage` |
| `source/Seal.mc` | klucz z ustawień, klucze pochodne, AES-256-CBC + HMAC-SHA256 |
| `source/Status.mc` | stan wysyłki słowami (ekran i podgląd) |
| `source/MainView.mc` | ekran aplikacji: stan, następna wysyłka (`NextSend`); START albo stuknięcie wysyła od razu |
| `source/SyncGlance.mc` | podgląd na liście aplikacji |
| `source/SealTest.mc` | testy: wspólny wektor koperty, czytanie klucza |
| `source/NextSendTest.mc` | test: następna wysyłka pół godziny po ostatnim przebiegu, „wkrótce”, „w ciągu 30 min” |
| `resources/settings/` | `key` (dla użytkownika) i `api` (ukryty adres serwera) |
| `build.sh` | testy, symulator, `.prg` na jeden zegarek, `.iq` do sklepu; klucz dewelopera |
| `store-devices.json` | przycięty katalog urządzeń Connect IQ Store: inne nazwy zegarków dla listy w GYM TRACKER (`npm run garmin:watches -- --store`) |
| `store/listing.md` | opis do sklepu po polsku i angielsku, wyjaśnienie uprawnień |
