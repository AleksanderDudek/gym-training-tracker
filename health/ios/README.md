# GYM TRACKER Zdrowie na iPhone'a

Mała aplikacja, która czyta z Apple Zdrowia ostatnie dwa tygodnie — kroki, dystans, piętra,
minuty ćwiczeń, tętno (min, średnie, max), tętno spoczynkowe, sen, wagę i przejazdy rowerem
z dystansem — szyfruje je kluczem z GYM TRACKER i wysyła do tej samej skrzynki na serwerze,
której używa zegarek Garmin. GYM TRACKER odbiera paczkę, sprawdza podpis, odszyfrowuje i scala.

Do Zdrowia piszą też Garmin Connect, Fitbit, Withings, Oura i inne, więc jedna aplikacja na
telefonie przynosi dane z większości zegarków i wag, nie tylko z krokomierza iPhone'a. Decyzje
i format paczki: `docs/superpowers/specs/2026-10-21-zdrowie-telefon-design.md`.

## Jak to działa

1. W GYM TRACKER (Ustawienia → Zdrowie z telefonu) powstaje osobny klucz: 32 losowe bajty jako
   64 znaki hex. „Kopiuj klucz”.
2. Tu przycisk „Wklej” (`PasteButton` — iOS nie pyta o zgodę na schowek). Klucz trafia do pęku
   kluczy z dostępem „po pierwszym odblokowaniu, tylko to urządzenie”: czyta go przebudzenie
   w tle, a nie trafia do kopii zapasowej ani na inny telefon.
3. „Zezwól na dostęp do Zdrowia” — arkusz zgód iOS. HealthKit nie mówi, na co się nie zgodzono;
   brak zgody wygląda jak brak danych i pole po prostu nie trafia do paczki.
4. Wysyłka: przy każdym otwarciu, przyciskiem „Wyślij teraz” i w tle — obserwatory HealthKit
   budzą aplikację po nowych krokach (najwyżej co godzinę), treningu, śnie i ważeniu, a zadanie
   odświeżania w tle jest zapasem. Bez przycisku najwyżej raz na 15 minut.
5. Paczka „phone v1” (`Payload.swift`) ma ostatnie 14 lokalnych dni; gdyby koperta przekroczyła
   11 000 znaków, odpadają najstarsze. Koperta (`Seal.swift`) jest bajt w bajt ta sama co
   zegarka i Androida: AES-256-CBC + HMAC-SHA256, klucze pochodne z etykiet `gt-box`, `gt-enc`,
   `gt-mac`. Pilnuje tego wspólny wektor `../vectors.json`.
6. Sen (`Sleep.swift`): suma przedziałów snu ze wszystkich źródeł (iPhone i zegarek zapisują tę
   samą noc) minus czuwanie; „w łóżku” się nie liczy. Noc należy do dnia pobudki.

Zablokowany iPhone szyfruje Zdrowie — wtedy ekran pokaże „Telefon zablokowany — spróbuję
później”, a wysyłkę zrobi następne przebudzenie.

## Wymagania

- Mac z **Xcode 16** lub nowszym i XcodeGen: `brew install xcodegen`.
- **Apple Developer Program** (99 USD rocznie) do TestFlight i App Store. Na własnym iPhonie
  da się spróbować z bezpłatnym kontem (Personal Team), ale taka instalacja wygasa po 7 dniach;
  jeśli Xcode odrzuci przy nim uprawnienia HealthKit, zostaje konto płatne.
- iPhone z iOS 17 lub nowszym, z włączonym trybem dewelopera
  (Ustawienia → Prywatność i ochrona → Tryb dewelopera).

## Sprawdzenie bez Xcode

Wystarczą Command Line Tools (`xcode-select --install`):

```bash
cd health/ios
./check.sh          # testy koperty (wspólny wektor), paczki i snu — te same pliki co w Xcode
./check.sh --app    # do tego kompilacja całej aplikacji jako Mac Catalyst z API iOS 17
```

`check.sh` kompiluje pliki testów XCTest z atrapą XCTest (`check/`), bo Command Line Tools XCTest
nie mają. Mac Catalyst to iOS na Macu — ten sam UIKit, HealthKit i BackgroundTasks — więc
`--app` łapie błędy typów i współbieżności (tryb Swift 5 z pełnym sprawdzaniem, jak w projekcie,
i tryb Swift 6), ale nie zastąpi buildu na iPhone'a.

## Uruchomienie na iPhonie

```bash
cd health/ios
xcodegen generate                  # GymTrackerZdrowie.xcodeproj, Info.plist, plik uprawnień
open GymTrackerZdrowie.xcodeproj
```

1. Zespół: wpisz Team ID w `project.yml` (`DEVELOPMENT_TEAM`, developer.apple.com → Account →
   Membership) i wygeneruj projekt jeszcze raz — albo wybierz go w Xcode: target
   GymTrackerZdrowie → Signing & Capabilities → Team. Druga droga znika przy następnym
   `xcodegen generate`.
2. Wybierz podłączonego iPhone'a, ⌘R. Testy: ⌘U (symulator wystarczy).
3. W GYM TRACKER skopiuj klucz, tu „Wklej”, potem „Zezwól na dostęp do Zdrowia”.

Adres serwera to ustawienie buildu `API_URL` w `project.yml` (domyślnie serwer zegarka).

Zadanie w tle można wywołać ręcznie: zatrzymaj aplikację w debugerze (pauza) i wpisz w konsoli

```
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"io.github.aleksanderdudek.gymtracker.zdrowie.sync"]
```

## TestFlight i App Store

1. App Store Connect → Aplikacje → „+”: nazwa „GYM TRACKER Zdrowie”, bundle ID
   `io.github.aleksanderdudek.gymtracker.zdrowie`, język główny polski.
2. Xcode: Product → Archive → Distribute App → App Store Connect. Testerzy wewnętrzni dostają
   build w TestFlight od razu, zewnętrzni po krótkiej recenzji bety.
3. **Polityka prywatności** — adres jest obowiązkowy, a przy HealthKit recenzja go czyta.
   Wystarczy sekcja [Polityka prywatności](#polityka-prywatności) niżej, podlinkowana z GitHuba,
   albo osobna strona aplikacji.
4. **Notatka dla recenzji** (App Review Information → Notes), na przykład:

   > The app reads steps, walking/running distance, flights climbed, exercise minutes, heart rate,
   > resting heart rate, sleep, body mass and cycling workouts from HealthKit, read-only, so the
   > user's web app GYM TRACKER (https://aleksanderdudek.github.io/gym-training-tracker/) can show
   > them. Data is encrypted on the phone (AES-256 + HMAC-SHA256) with a key generated in the
   > user's browser and pasted into this app; our server stores only the latest ciphertext for at
   > most 7 days and cannot decrypt it. No ads, no analytics, no sharing, nothing in iCloud.
   > To test: open the web app, Settings → „Zdrowie z telefonu” → „Kopiuj klucz”, then tap
   > „Wklej” here and „Zezwól na dostęp do Zdrowia”.

   Karta „Zdrowie z telefonu” pokazuje się w GYM TRACKER dopiero z adresem aplikacji
   (`VITE_HEALTH_IOS_URL`). Adres `https://apps.apple.com/app/id<ID>` jest znany od chwili
   założenia aplikacji w App Store Connect — ustaw go przed wysłaniem do recenzji, inaczej
   recenzent nie znajdzie klucza.
5. Opis w sklepie musi wprost mówić o współpracy ze Zdrowiem (wymóg HealthKit), a dane
   zdrowotne nie mogą służyć reklamie ani trafiać do iCloud — aplikacja nie robi ani jednego.
6. **Prywatność w App Store Connect** — patrz niżej.

### Prywatność w App Store Connect

`PrivacyInfo.xcprivacy` deklaruje: bez śledzenia, bez zbieranych danych, UserDefaults z powodu
`CA92.1` (ostatni wynik wysyłki, czyta go tylko ta aplikacja).

„Zbieranie” w rozumieniu Apple to wysyłanie danych z urządzenia tak, że autor aplikacji albo
ktoś trzeci ma do nich dostęp dłużej, niż trwa obsługa żądania. Dane o zdrowiu wychodzą
z telefonu wyłącznie zaszyfrowane kluczem, którego serwer nie zna — autor ich nie odczyta, tak
jak operator poczty nie przeczyta zaszyfrowanego listu. Dlatego deklaracja to „Data Not
Collected”. Serwer widzi tylko adres IP połączenia (jak każdy serwer) i trzyma jego skrót przy
zakładaniu nowej skrzynki, żeby ograniczyć liczbę skrzynek z jednego adresu na godzinę.

Wersja ostrożniejsza, gdyby recenzja miała wątpliwości: „Health & Fitness → Health, Fitness”,
cel „App Functionality”, niepowiązane z tożsamością, bez śledzenia.

### Szyfrowanie a eksport (`ITSAppUsesNonExemptEncryption = false`)

Aplikacja szyfruje, więc pytanie o eksport dotyczy jej wprost. Odpowiedź „nie używa
szyfrowania niezwolnionego” ma podstawy:

- całe szyfrowanie pochodzi z systemu (CommonCrypto: AES-256-CBC; CryptoKit: HMAC-SHA256;
  HTTPS przez `URLSession`) — aplikacja nie ma własnej implementacji ani niestandardowego
  algorytmu;
- szyfrowanie chroni wyłącznie dane samego użytkownika (jego zdrowie w drodze i na serwerze),
  a głównym zadaniem aplikacji jest przeniesienie liczb do GYM TRACKER, nie bezpieczeństwo
  informacji ani komunikacja — to przypadek zwolniony w przepisach USA (EAR, kategoria 5 część 2,
  uwaga 4; wytyczne Apple: szyfrowanie z systemu operacyjnego jest zwolnione z dokumentów).

Klucz w Info.plist sprawia, że App Store Connect nie pyta przy każdym buildzie. Deklaracja jest
prawnie po stronie autora — przy wątpliwościach odpowiedz na pytania w App Store Connect
zamiast ustawiać klucz.

## Polityka prywatności

GYM TRACKER Zdrowie czyta ze Zdrowia, tylko do odczytu i tylko za zgodą użytkownika: kroki,
dystans chodu i biegu, piętra, minuty ćwiczeń, tętno, tętno spoczynkowe, sen, masę ciała
i przejazdy rowerem z ostatnich 14 dni. Z tych danych liczy sumy i wartości dnia; surowych
pomiarów ani lokalizacji nie wysyła.

Dane są szyfrowane na telefonie kluczem utworzonym w aplikacji GYM TRACKER użytkownika
i wysyłane na serwer GYM TRACKER. Serwer nie zna klucza i nie może ich odczytać; trzyma tylko
najnowszą zaszyfrowaną paczkę, najwyżej 7 dni od ostatniej wysyłki, oraz skrót adresu IP przy
zakładaniu skrzynki (ochrona przed nadużyciami). Odczytać paczkę może tylko GYM TRACKER, w którym
klucz powstał. „Odłącz” kasuje klucz z telefonu i paczkę z serwera.

Aplikacja nie ma reklam, analityki ani kont, nie przekazuje danych nikomu i nie zapisuje ich
w iCloud.

## Do sprawdzenia przy pierwszym buildzie

Tu, bez Xcode, sprawdzone było: testy (`./check.sh`, 22 testy, w tym wspólny wektor) i pełna
kompilacja z linkowaniem całej aplikacji jako Mac Catalyst z API iOS 17 oraz jako macOS 14
(`./check.sh --app`), a `project.yml` wygenerował poprawny projekt w XcodeGen 2.46.0. Nie było
buildu na iOS, testów w XCTest ani uruchomienia na telefonie. Przed publikacją:

- [ ] **Build w Xcode na iPhone'a i ⌘U** — prawdziwy XCTest zamiast atrapy z `check/`.
- [ ] **Arkusz zgód** ma polski opis i wszystkie 10 rodzajów danych; przycisk „Wklej” jest
      po polsku i wkleja bez pytania.
- [ ] **Liczby zgadzają się ze Zdrowiem**: kroki dnia, minuty ćwiczeń, „Czas snu” nocy
      (iPhone + zegarek liczone raz), ostatnie ważenie.
- [ ] **Przejazdy z innych aplikacji** (Garmin Connect, Strava) mają dystans — przez
      `statistics(for: .distanceCycling)` albo starsze `totalDistance`.
- [ ] **Przebudzenia w tle**: zablokuj telefon, pochodź, po około godzinie GYM TRACKER na innym
      urządzeniu ma nowe kroki. Zadanie w tle: polecenie w debugerze wyżej.
- [ ] **Zablokowany telefon** daje „Telefon zablokowany — spróbuję później”, nie błąd.
- [ ] **GYM TRACKER przyjmuje paczkę** z `"os":"ios"`.

## Pliki

| Plik | Co robi |
| --- | --- |
| `project.yml` | projekt XcodeGen: cel aplikacji i testów, Info.plist, uprawnienia HealthKit |
| `GymTrackerZdrowie/App.swift` | wejście; obserwatory HealthKit i zadanie w tle przy każdym starcie |
| `GymTrackerZdrowie/ContentView.swift` | jedyny ekran |
| `GymTrackerZdrowie/Sync.swift` | jedna wysyłka: odczyt → paczka → koperta → serwer; ostatni wynik |
| `GymTrackerZdrowie/HealthReader.swift` | zapytania do HealthKit: dni, sen, przejazdy |
| `GymTrackerZdrowie/Payload.swift` | paczka „phone v1” i przycinanie do 11 000 znaków |
| `GymTrackerZdrowie/Sleep.swift` | minuty snu na dzień pobudki |
| `GymTrackerZdrowie/Seal.swift` | klucz, klucze pochodne, AES-256-CBC + HMAC-SHA256 |
| `GymTrackerZdrowie/Sender.swift` | `POST /garmin/push` i `/garmin/forget` |
| `GymTrackerZdrowie/KeyStore.swift` | klucz w pęku kluczy |
| `GymTrackerZdrowie/PrivacyInfo.xcprivacy` | manifest prywatności |
| `GymTrackerZdrowieTests/` | XCTest: koperta (wspólny wektor), paczka, sen |
| `check.sh`, `check/` | testy i kompilacja bez Xcode; atrapa XCTest |
