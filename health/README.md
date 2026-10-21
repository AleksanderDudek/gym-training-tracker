# GYM TRACKER Zdrowie — aplikacje na telefon

Dwie małe aplikacje natywne, które czytają dane z **Apple Zdrowie** (iPhone, `ios/`) i
**Health Connect** (Android, `android/`), szyfrują je i odkładają na serwerze GYM TRACKER.
Aplikacja w przeglądarce odbiera je przy otwarciu i pokazuje: kroki i przejazdy rowerem liczą
się jak wpisy, tętno, sen i waga stoją w sekcji „Z telefonu” na ekranie kroków i cardio.

## Dlaczego osobne aplikacje

- **Strona nie czyta Apple Zdrowie ani Health Connect.** Żadna przeglądarka nie daje do nich
  dostępu, także strona dodana do ekranu początkowego. Czyta je tylko kod natywny.
- **Cała aplikacja w natywnej skorupie (Capacitor) byłaby gorsza.** Dane w skorupie leżą osobno
  od danych w przeglądarce, przypomnienia web push i service worker w WKWebView nie działają,
  a App Store odrzuca „strony w ramce”. Mała aplikacja robi jedno: czyta, szyfruje, wysyła.
- **Jedno połączenie, wiele urządzeń.** Garmin Connect, Fitbit, Samsung Health, Withings, Oura
  i inne zapisują dane w Apple Zdrowie i Health Connect, więc telefon przynosi też ich liczby.

## Zegarek Garmin

Najprostsza droga dla Garmina prowadzi przez telefon. Garmin Connect zapisuje kroki, sen, tętno,
wagę i treningi w Apple Zdrowie albo Health Connect, jeśli włączy się to w jego ustawieniach
(Ustawienia → Połączone aplikacje → Apple Zdrowie / Health Connect). GYM TRACKER Zdrowie czyta
je stamtąd jak wszystko inne. Stresu i Body Battery Garmin tam nie przekazuje — te dwie liczby
daje tylko własna aplikacja na zegarek (`garmin/`). „Zaloguj przez Garmin” (oficjalne API) jest
zamknięte dla nowych zgłoszeń od wiosny 2026 roku.

## Jak to działa

1. W GYM TRACKER (Ustawienia → **Zdrowie z telefonu**) powstaje klucz: 32 losowe bajty, 64 znaki
   hex. Leży tylko w tej przeglądarce i nie trafia do eksportu danych. Jest osobny od klucza
   zegarka Garmin.
2. Klucz kopiuje się i wkleja w aplikacji na telefonie przyciskiem **„Wklej klucz”**. Na iPhonie
   to systemowy przycisk wklejania — bez pytania o zgodę na schowek.
3. Aplikacja prosi o dostęp do danych zdrowia (tylko odczyt), czyta ostatnie 14 dni, pieczętuje
   je kopertą zegarka (AES-256-CBC + HMAC-SHA256, klucze wyprowadzone z klucza, opis w
   `src/watchseal.ts`) i wysyła na `POST /garmin/push`.
4. Serwer trzyma tylko najnowszą paczkę, najwyżej 7 dni od ostatniego zapisu, i nie zna klucza.
5. Strona odbiera paczkę przy otwarciu i po powrocie na ekran, sprawdza podpis, odszyfrowuje,
   przesiewa każdą liczbę przez zakresy i scala dzień po dniu.

Dlaczego nie link z kluczem, który sam otwiera aplikację: własny schemat adresu (`coś://`) może
zarejestrować każda inna aplikacja na telefonie i dostałaby klucz do danych o zdrowiu. Linki
zweryfikowane domeną (Universal Links, App Links) wymagają plików w korzeniu domeny, a strona
projektu na GitHub Pages go nie ma.

**Kiedy wysyła.** iPhone: HealthKit budzi aplikację przy nowych danych (kroki najwyżej co
godzinę; treningi, sen i waga od razu), do tego odświeżanie w tle i każde otwarcie. Android:
co godzinę przez WorkManager, jeśli Health Connect pozwala czytać w tle (zgoda „dostęp w tle”),
a zawsze przy otwarciu i przyciskiem „Wyślij teraz”. Same kroki wychodzą najwyżej raz na
kwadrans; trening, sen i waga na iPhonie nie czekają na kwadrans, tylko na minutowy limit
serwera. Gdy wysyłka w tle się nie uda (zablokowany iPhone, brak sieci) albo zostanie
wstrzymana limitem, iPhone zamawia następną próbę za kwadrans — HealthKit o tych samych
danych drugi raz nie budzi.

## Paczka (wersja 1)

Treść koperty to JSON z `"k": "phone"` — po tym strona odróżnia paczkę telefonu od paczki
zegarka (klucz wklejony nie w to urządzenie nie poda cudzych liczb):

```json
{
  "v": 1, "k": "phone", "os": "ios", "t": 1792540800,
  "d": [{ "day": "2026-10-20", "steps": 9120, "m": 7340, "floors": 12, "active": 35,
          "rhr": 52, "hrMin": 48, "hrAvg": 71, "hrMax": 142, "sleep": 432, "kg": 82.4 }],
  "a": [{ "start": 1792501200, "sport": 2, "sec": 3600, "m": 25000 }]
}
```

- `day` — dzień według zegara telefonu; każde inne pole może nie istnieć (brak pomiaru albo zgody).
- `steps`, `m` (metry), `floors`, `active` (minuty „Ćwiczenia”, tylko iPhone) — sumy dnia.
- `rhr` — tętno spoczynkowe dnia; `hrMin`/`hrAvg`/`hrMax` — ze wszystkich pomiarów dnia.
- `sleep` — minuty snu w nocy, która **skończyła się** tego dnia, bez przebudzeń; noc zapisana
  przez kilka źródeł (iPhone i zegarek) liczona raz.
- `kg` — ostatnie ważenie dnia.
- `a` — tylko przejazdy rowerem z drogą (`sport` jak w FIT: 2 = rower). Biegi i marsze nie, bo
  ich kroki są już w krokach dnia.

Paczka ma najwyżej 11 000 znaków po zapieczętowaniu (serwer przyjmuje 12 000): gdy się nie
mieści, odpadają najstarsze dni.

**Wspólny wektor.** `vectors.json` (klucz, IV, klucze pochodne, paczka i koperta, policzone przez
`node:crypto`) sprawdzają: `src/phone.test.ts` i `src/engine/phone.test.ts` (vitest), testy
JUnit Androida i testy Swift iPhone'a. Jeśli któraś strona się rozjedzie, jej test nie przejdzie.

## Włączenie karty w aplikacji

Karta „Zdrowie z telefonu” pojawia się, gdy build zna adres serwera (`API_URL`) i adres co
najmniej jednej aplikacji. Zmienne repozytorium (Settings → Secrets and variables → Actions →
Variables), potem nowe wdrożenie strony:

```bash
gh variable set HEALTH_ANDROID_URL --body "https://github.com/AleksanderDudek/gym-training-tracker/releases/latest/download/gym-tracker-zdrowie.apk"
gh variable set HEALTH_IOS_URL --body "https://testflight.apple.com/join/<kod>"   # albo adres w App Store
gh workflow run Deploy
```

Bez adresu iPhone'a karta na iPhonie mówi, że aplikacji jeszcze nie ma (i odwrotnie).
Serwera nie trzeba wdrażać na nowo — telefon używa istniejących skrzynek.

## Build i publikacja

- **Android** — `android/README.md`: `./gradlew testDebugUnitTest assembleDebug`, instalacja
  przez `adb install`, podpisany APK z tagu `zdrowie-android-v*` (workflow
  `.github/workflows/zdrowie-android.yml`), później Google Play (formularz deklaracji Health Connect).
- **iPhone** — `ios/README.md`: Mac z Xcode, `xcodegen generate`, konto Apple Developer Program
  (HealthKit na urządzeniu i TestFlight), potem App Store.

## Prywatność w skrócie

- Odczyt tylko tych rodzajów danych, które strona pokazuje albo liczy; żadnego zapisu do
  Apple Zdrowie ani Health Connect.
- Dane wychodzą z telefonu wyłącznie zaszyfrowane kluczem, którego serwer nie zna.
- Klucz w telefonie: pęk kluczy iOS (tylko to urządzenie, bez kopii w chmurze) albo prywatne
  ustawienia aplikacji na Androidzie (kopie zapasowe wyłączone).
- „Odłącz” w aplikacji kasuje skrzynkę na serwerze i klucz w telefonie; „Odłącz telefon” w karcie
  robi to samo po stronie przeglądarki. Dane, które już przyszły, zostają w historii.
