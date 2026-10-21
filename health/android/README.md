# GYM TRACKER Zdrowie — Android

Mała aplikacja towarzysząca GYM TRACKER. Czyta z Health Connect kroki, dystans, piętra, tętno,
tętno spoczynkowe, sen, wagę i przejazdy rowerem z ostatnich 14 dni, pieczętuje je tą samą kopertą
co zegarek Garmin (AES-256-CBC + HMAC-SHA256, klucz z GYM TRACKER) i odkłada na serwerze
(`POST /garmin/push`). GYM TRACKER w przeglądarce odbiera paczkę i ją odszyfrowuje. Serwer nie zna
klucza. Decyzje i format paczki: `docs/superpowers/specs/2026-10-21-zdrowie-telefon-design.md`.

Health Connect zbiera też dane z Garmin Connect, Fitbit, Samsung Health czy wag Withings, więc jedna
aplikacja na telefonie obejmuje większość zegarków i wag.

## Jak to działa

1. W GYM TRACKER: Ustawienia → Zdrowie z telefonu → Kopiuj klucz.
2. Tutaj „Wklej klucz” (schowek jest potem czyszczony) i „Zezwól na dostęp” w Health Connect.
3. Aplikacja wysyła od razu, potem przy każdym otwarciu (najwyżej raz na kwadrans) i przyciskiem
   „Wyślij teraz”. Gdy Health Connect umie czytać w tle i jest na to zgoda, wysyła też co godzinę
   (WorkManager).
4. „Odłącz” kasuje paczkę z serwera, klucz z telefonu i pracę w tle.

Sumy dnia liczy Health Connect (`aggregateGroupByPeriod`), więc kroki z telefonu i z zegarka nie
liczą się podwójnie. Sen to suma sesji wszystkich aplikacji minus czuwanie, przypisana do dnia
pobudki. Kopia zapasowa i przenoszenie na nowy telefon są wyłączone — klucz zostaje na tym telefonie.

## Build

Potrzebne: JDK 17 lub nowszy i Android SDK z platformą 36 (`local.properties` z `sdk.dir=…` albo
zmienna `ANDROID_HOME`).

```bash
cd health/android
./gradlew testDebugUnitTest      # koperta (wspólny wektor ../vectors.json), paczka, sen, wysyłka
./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Inny serwer: `./gradlew assembleDebug -Pzdrowie.apiUrl=https://…` (tylko HTTPS).

## Wydanie

APK release podpisuje się kluczem, którego nie ma w repozytorium. Gradle bierze go ze zmiennych
środowiska albo z `~/.gradle/gradle.properties`: `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Bez nich `assembleRelease` daje APK niepodpisany.

Klucz robi się raz i **trzeba zrobić jego kopię** — każdą kolejną wersję trzeba podpisać tym samym,
inaczej Android nie zainstaluje jej na poprzednią:

```bash
keytool -genkeypair -keystore zdrowie.keystore -alias zdrowie -keyalg RSA -keysize 4096 -validity 10000
gh secret set ANDROID_KEYSTORE_B64 < <(base64 -i zdrowie.keystore)
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_ALIAS --body zdrowie
gh secret set ANDROID_KEY_PASSWORD
```

Potem tag uruchamia workflow `Zdrowie Android` (`.github/workflows/zdrowie-android.yml`): testy,
podpisany `gym-tracker-zdrowie.apk` (zawsze ta sama nazwa, więc link `…/releases/latest/download/gym-tracker-zdrowie.apk` pobiera najnowszą wersję) i wydanie na GitHubie z tym plikiem. Wersja aplikacji
pochodzi z tagu (`1.2.3` → versionCode `10203`).

```bash
git tag zdrowie-android-v1.0.0 && git push origin zdrowie-android-v1.0.0
```

Bez sekretów workflow zostawia niepodpisany APK jako artefakt i nie tworzy wydania. Adres wydania
trafia do zmiennej `HEALTH_ANDROID_URL` — dopiero wtedy GYM TRACKER pokaże kartę „Zdrowie
z telefonu” z instrukcją dla Androida:

```bash
gh variable set HEALTH_ANDROID_URL --body "https://github.com/AleksanderDudek/gym-training-tracker/releases/tag/zdrowie-android-v1.0.0"
gh workflow run Deploy
```

APK ma około 11 MB, bo release nie przechodzi przez R8: reguł zachowania klas dla Health Connect nie
dało się sprawdzić na urządzeniu.

## Test na telefonie albo emulatorze

- **Telefon z Androidem 14+**: Health Connect jest w systemie (Ustawienia → Health Connect). Na
  Androidzie 9–13 aplikacja prowadzi do Sklepu Play.
- **Emulator**: obraz z Google Play (nie „Google APIs”), Android 14 lub nowszy. Dane testowe wpisuje
  się w Health Connect ręcznie albo aplikacją [Health Connect Toolbox](https://developer.android.com/health-and-fitness/guides/health-connect/test/health-connect-toolbox).
- Sprawdź po kolei: wklejenie klucza (zły klucz → „Klucz to 64 znaki…”), okno zgody Health Connect
  (pojawia się tylko dzięki polityce prywatności w `RationaleActivity`), „Wyślij teraz” → „dziś
  HH:MM — wysłane: N dni”, w GYM TRACKER „Sprawdź teraz” i dane na ekranie cardio.
- Praca w tle: Android Studio → App Inspection → Background Task Inspector pokazuje zaplanowaną
  wysyłkę i pozwala ją uruchomić od razu.

## Do sprawdzenia przy pierwszym uruchomieniu

Kod się kompiluje, testy jednostkowe przechodzą, lint nie zgłasza błędów, a podpis release działa —
ale nie było telefonu ani emulatora z Health Connect. Przed wydaniem:

- [ ] Okno zgody Health Connect się otwiera, a link do polityki prywatności prowadzi do `RationaleActivity`.
- [ ] Liczby dnia zgadzają się z Health Connect (kroki, dystans, piętra, tętno, sen, waga).
- [ ] Przejazd rowerem z dystansem przychodzi jako jazda na rowerze w GYM TRACKER.
- [ ] Wysyłka w tle co godzinę na telefonie z Androidem 14+ (zgoda „dostęp w tle”).
- [ ] Wygląd w trybie jasnym i ciemnym, pod paskami systemu (Android 15+ rysuje aplikację pod nimi).

## Pliki

| Plik | Co robi |
| --- | --- |
| `Seal.kt` | klucz, klucze pochodne, koperta jak `src/watchseal.ts` i `garmin/source/Seal.mc` |
| `Payload.kt` | dni i przejazdy, JSON paczki v1, przycinanie do 11 000 znaków |
| `Sleep.kt` | minuty snu na dzień pobudki: suma sesji minus czuwanie |
| `HealthReader.kt` | Health Connect: dostępność, zgody, sumy dnia, sen, waga, przejazdy |
| `Sender.kt` | `POST /garmin/push` i `/garmin/forget` |
| `Keys.kt` | klucz w prywatnych ustawieniach aplikacji |
| `Sync.kt` | odczyt → paczka → koperta → serwer, wynik dla ekranu |
| `SyncWorker.kt` | wysyłka w tle co godzinę |
| `MainActivity.kt` | jedyny ekran |
| `RationaleActivity.kt` | polityka prywatności (wymagana przez Health Connect) |
