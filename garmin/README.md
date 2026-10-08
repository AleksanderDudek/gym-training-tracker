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

Format koperty i paczki opisują `src/watchseal.ts` i `src/engine/watch.ts`. Plik `SealTest.mc`
sprawdza ten sam wektor co testy aplikacji: jeśli zegarek i przeglądarka się rozjadą, test
nie przejdzie.

## Build

Potrzebne: [Connect IQ SDK](https://developer.garmin.com/connect-iq/sdk/) (SDK Manager, konto
Garmin, urządzenia z listy w `manifest.xml`), Java 17+ i klucz dewelopera.

```bash
cd garmin

# 1. Adres serwera: wpisz adres Workera (z `wrangler deploy`) w resources/settings/properties.xml,
#    właściwość `api`, bez ukośnika na końcu.

# 2. Klucz dewelopera — raz, poza gitem.
openssl genrsa -out developer_key.pem 4096
openssl pkcs8 -topk8 -inform PEM -outform DER -in developer_key.pem -out developer_key.der -nocrypt

# 3. Build na jedno urządzenie i symulator.
monkeyc -f monkey.jungle -o bin/gymtracker.prg -y developer_key.der -d fr265
connectiq &
monkeydo bin/gymtracker.prg fr265

# 4. Testy w symulatorze (wektor koperty i czytanie klucza).
monkeyc -f monkey.jungle -o bin/test.prg -y developer_key.der -d fr265 --unit-test
monkeydo bin/test.prg fr265 -t

# 5. Paczka do sklepu: wszystkie urządzenia z manifestu.
monkeyc -f monkey.jungle -o bin/gymtracker.iq -y developer_key.der -e -r
```

Plik `.iq` wgrywa się w [Connect IQ Developer Dashboard](https://apps.garmin.com/developer/).
Po publikacji adres aplikacji w sklepie trzeba wpisać w GitHubie jako zmienną `GARMIN_APP_URL`
(Settings → Secrets and variables → Actions → Variables). Dopiero wtedy aplikacja pokaże kartę
„Zegarek Garmin”. Bez tej zmiennej karty nie ma, a reszta działa jak dotąd.

Bez sklepu (na własny zegarek): skopiuj `bin/gymtracker.prg` przez USB do `GARMIN/APPS/`.
Ustawienia aplikacji wgranej w ten sposób edytuje się w Connect IQ na telefonie albo
w symulatorze (File → Edit Persistent Storage / App Settings).

## Do sprawdzenia przy pierwszym buildzie

Kod skompilował się kompilatorem z Connect IQ SDK 9.2.0 na wszystkie 11 urządzeń z manifestu
(domyślny poziom sprawdzania typów), razem z buildem testów i paczką do sklepu (`-e -r`).
Definicje urządzeń pochodziły jednak spoza SDK Managera, a symulatora nie dało się uruchomić —
testy nie były puszczone. Przed publikacją:

- [ ] **Kompilacja z urządzeniami z SDK Managera** — tymi właściwymi, nie zastępczymi.
- [ ] **`SealTest` przechodzi.** To jedyny dowód, że zegarek pieczętuje jak przeglądarka:
      wielkość liter hex, base64 bez łamania linii, dopełnienie PKCS#7.
- [ ] **Przebieg w tle ma dostęp do `ActivityMonitor`, `SensorHistory` i `UserProfile`.**
      W symulatorze: Simulation → Background Events → Temporal Event, potem log serwera.
- [ ] **`UserActivity.startTime`.** Część oprogramowania podaje go od epoki FIT (1989), nie od 1970
      (błąd zgłoszony Garminowi); `Collect.acts` przelicza czas sprzed 2000 roku. Sprawdź, czy
      przejazd z dziś ma w aplikacji dzisiejszą datę.
- [ ] **Pamięć w tle na fēnix 6** (32 kB): paczka, AES, HMAC i base64 mieszczą się z zapasem
      według obliczeń, ale sprawdź w widoku pamięci symulatora.
- [ ] **Polskie znaki na ekranie zegarka.** Czcionki systemowe zwykle je mają, ale nie wszędzie.
- [ ] **Odpowiedź serwera.** Serwer odpowiada JSON-em także przy błędach (`429 {"error":…}`),
      bo inną treść Connect IQ zgłasza jako −400. Status na zegarku: „Wysłane HH:MM”.

## Pliki

| Plik | Co robi |
| --- | --- |
| `source/GymTrackerApp.mc` | wejście: rejestruje przebieg w tle co 30 min, podgląd, wynik z tła |
| `source/SyncService.mc` | przebieg w tle: `Sync.run` i `Background.exit(kod)` |
| `source/Sync.mc` | jedna wysyłka: paczka v1, koperta, `POST /garmin/push` |
| `source/Collect.mc` | dane z zegarka w kształcie paczki v1; kubełki zdrowia w `Storage` |
| `source/Seal.mc` | klucz z ustawień, klucze pochodne, AES-256-CBC + HMAC-SHA256 |
| `source/Status.mc` | stan wysyłki słowami (ekran i podgląd) |
| `source/MainView.mc` | ekran aplikacji; START albo stuknięcie wysyła od razu |
| `source/SyncGlance.mc` | podgląd na liście aplikacji |
| `source/SealTest.mc` | testy: wspólny wektor koperty, czytanie klucza |
| `resources/settings/` | `key` (dla użytkownika) i `api` (ukryty adres serwera) |
