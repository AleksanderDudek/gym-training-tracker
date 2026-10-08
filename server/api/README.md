# Serwer aplikacji

Cloudflare Worker z trzema zadaniami:

- **przypomnienia** — o 7:30 o treningu z planu, o 19:30 o wpisaniu kroków i ruchu z dnia,
  o czasie lokalnym telefonu, na Androidzie i iPhonie;
- **uwagi od użytkowników** — wiadomość z formularza w aplikacji (e-mail, treść, zrzut ekranu,
  ślad wizyty) i lista dla autora za hasłem;
- **skrzynki zegarka Garmin** — zaszyfrowana paczka z zegarka czeka, aż odbierze ją aplikacja.
  Klucza serwer nie ma.

## Dlaczego serwer

Strona nie umie zaplanować powiadomienia na konkretną godzinę. API, które miało to robić
(Notification Triggers), wycofano z Chrome, Safari nigdy go nie miał, a iOS usypia aplikację
w tle, więc żaden zegar w JavaScripcie nie dotrwa do rana. Działa tylko Web Push: o czasie
wysyła serwer, telefon pokazuje. Na iPhonie od iOS 16.4, w aplikacji dodanej do ekranu
początkowego.

## Jak to działa

- Aplikacja sama układa listę gotowych przypomnień na 21 dni (`src/engine/reminders.ts`) i przy
  każdym otwarciu przysyła ją na `POST /subscribe` razem z subskrypcją Web Push i strefą czasową.
- Cron co 5 minut (`tick` w `api.ts`) wysyła to, czemu u kogoś wybiła godzina — w oknie 90 minut,
  raz na rodzaj i dzień. Postęp zapisuje się po każdej subskrypcji.
- Serwer nie zna planów ani historii. Dostaje adres powiadomień telefonu, strefę i teksty.
  Gdy ktoś przestanie otwierać aplikację, lista się wyczerpie, a po 45 dniach ciszy subskrypcja
  znika. Martwe subskrypcje (404/410 z usługi) są kasowane od razu.
- Zapytania idą tylko do usług powiadomień przeglądarek (FCM, Apple, Mozilla, Windows) —
  inny adres w subskrypcji jest odrzucany.
- Szyfrowanie (RFC 8291) i podpis VAPID (RFC 8292) na samym WebCrypto, bez zależności;
  test sprawdza je na wartościach z RFC.

## Wdrożenie

Potrzebne konto Cloudflare (darmowy plan wystarcza: cron, baza D1). Wszystko z tego katalogu.

```bash
cd server/api
npx wrangler login

# 1. Baza
npx wrangler d1 create gym-tracker-api        # identyfikator wpisz do wrangler.toml (database_id)
npx wrangler d1 execute gym-tracker-api --remote --file=schema.sql

# 2. Klucze VAPID: publiczny wpisze się do wrangler.toml, prywatny idzie do sekretów
node keys.mjs
npx wrangler secret put VAPID_PRIVATE_JWK < vapid-private.jwk.json

# 3. Hasło do listy uwag (co najmniej 16 znaków; bez niego listy nie ma)
npx wrangler secret put ADMIN_TOKEN

# 4. Serwer
npx wrangler deploy                            # wypisze adres, np. https://gym-tracker-api.<konto>.workers.dev
```

Potem w GitHubie: **Settings → Secrets and variables → Actions → Variables** dwie zmienne
(nie sekrety — obie są publiczne):

| Zmienna | Wartość |
| --- | --- |
| `API_URL` | adres Workera z `wrangler deploy` (bez ukośnika na końcu) |
| `VAPID_PUBLIC_KEY` | klucz publiczny wypisany przez `node keys.mjs` |
| `GARMIN_APP_URL` | adres aplikacji GYM TRACKER w Connect IQ Store — włącza kartę zegarka (`garmin/README.md`) |

Następne wdrożenie strony (push na `main`) zbuduje aplikację z kartą „Przypomnienia”
w Ustawieniach i dymkiem „Napisz do autora” w pasku. Bez tych zmiennych nie ma ani jednego,
ani drugiego, a aplikacja działa jak dotąd.

Plik `vapid-private.jwk.json` jest poza gitem. Nie generuj kluczy drugi raz — nowy klucz
odcina wszystkie istniejące subskrypcje (skrypt odmówi, jeśli plik już jest).

## Lokalnie

`npm test` w katalogu głównym obejmuje też serwer (`server/api/*.test.ts`). Worker lokalnie:
`npx wrangler dev --test-scheduled`, a przebieg crona: `curl "http://localhost:8787/__scheduled"`.

## Limity

Darmowy plan Workers daje 10 ms procesora na przebieg crona; jedno przypomnienie to ułamek
milisekundy, więc mieści się kilkanaście na przebieg, a reszta wychodzi w następnym (co 5 minut,
okno 90 minut). Dla kilkuset osób wystarczy; przy większym ruchu — plan płatny Workers.

## Uwagi od użytkowników

Dymek w pasku aplikacji (na każdym ekranie) i przycisk w Ustawieniach otwierają okno: e-mail
(opcjonalnie, do odpowiedzi), treść i zrzut ekranu — zrobiony automatycznie z ekranu pod oknem
albo wybrany z galerii. Do wiadomości dochodzi ślad wizyty (`src/trail.ts`): ekran, z którego
ktoś pisze, czas wizyty i czas z aplikacją na ekranie, kolejne ekrany, stuknięcia i błędy
aplikacji, przeglądarka i rozmiar ekranu. Ślad żyje tylko w pamięci karty i wychodzi wyłącznie
z wiadomością; liczby w etykietach stuknięć są zamienione na `#`.

**Czytanie:** `https://<adres Workera>/admin/feedback` — przeglądarka zapyta o hasło (login
dowolny, hasło to `ADMIN_TOKEN`). Najnowsze na górze, z miniaturą zrzutu i rozwijanym śladem.
Strona ma `Content-Security-Policy: default-src 'none'` i escapuje wszystko, co ktoś wpisał —
treść od obcych ludzi nie wykona się jako kod. Albo bez przeglądarki:

```bash
npx wrangler d1 execute gym-tracker-api --remote \
  --command "SELECT datetime(created/1000,'unixepoch'), email, view, text FROM feedback ORDER BY created DESC LIMIT 20"
```

**Ochrona:** limit 10 wiadomości na godzinę z jednego adresu (IP tylko jako skrót SHA-256
z solą — samego adresu baza nie zna), ukryte pole-pułapka na boty, treść do 4000 znaków,
zrzut tylko jako obraz (JPEG, PNG, WebP) do ok. 1,5 MB, CORS tylko dla strony aplikacji.

## Zegarek Garmin

Aplikacja na zegarek (`garmin/`) co 30 minut odkłada na serwerze zaszyfrowany tydzień danych,
a aplikacja w przeglądarce odbiera go przy otwarciu.

- `POST /garmin/push {box, blob}` — od zegarka (bez nagłówka Origin, zapytanie idzie przez
  aplikację Garmin Connect na telefonie). Odpowiedź `200 {"ok":true}`, bo zegarek czeka na JSON.
- `POST /garmin/pull {box}` — od aplikacji: `{blob, updated}` albo 404, bez pamięci podręcznej.
- `POST /garmin/forget {box}` — odłączenie zegarka; skrzynka znika od razu.

**Czego serwer nie wie.** `blob` to koperta AES-256-CBC z HMAC-SHA256, a klucz zna tylko zegarek
i przeglądarka. Tętno i stres to dane o zdrowiu (RODO, art. 9), więc serwer dostaje je
w postaci, której nie umie odczytać. `box` to 32 znaki hex wyprowadzone z klucza: kto go zna,
może paczkę nadpisać albo skasować, ale nie odczytać ani podrobić — aplikacja odrzuci kopertę
bez poprawnego podpisu. W bazie leży szyfrogram, czas zapisu i skrót adresu IP, z którego
skrzynkę założono.

**Limity.** Jedna paczka na minutę na skrzynkę, 20 nowych skrzynek na godzinę z jednego adresu,
koperta do 12 000 znaków. Skrzynka bez zapisu przez 7 dni znika przy przebiegu crona — tyle
dni zegarek i tak wysyła w każdej paczce.

**Wdrożenie przy istniejącym serwerze.** Tabela `garmin` dochodzi w `schema.sql`:

```bash
npx wrangler d1 execute gym-tracker-api --remote --file=schema.sql   # CREATE … IF NOT EXISTS — reszta zostaje
npx wrangler deploy
```

**Koszt.** Zegarek zapisuje 48 razy na dobę. Darmowy plan D1 daje 100 tys. zapisów dziennie,
czyli wystarcza na około 2 tys. aktywnych zegarków; dalej — plan płatny albo rzadsza wysyłka
(`Sync.EVERY` w `garmin/source/Sync.mc`).
