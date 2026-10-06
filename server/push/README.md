# Serwer przypomnień

Cloudflare Worker, który o 7:30 przypomina o treningu z planu, a o 19:30 o wpisaniu kroków
i ruchu z dnia — o czasie lokalnym telefonu, na Androidzie i iPhonie.

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
cd server/push
npx wrangler login

# 1. Baza
npx wrangler d1 create gym-tracker-push        # identyfikator wpisz do wrangler.toml (database_id)
npx wrangler d1 execute gym-tracker-push --remote --file=schema.sql

# 2. Klucze VAPID: publiczny wpisze się do wrangler.toml, prywatny idzie do sekretów
node keys.mjs
npx wrangler secret put VAPID_PRIVATE_JWK < vapid-private.jwk.json

# 3. Serwer
npx wrangler deploy                            # wypisze adres, np. https://gym-tracker-push.<konto>.workers.dev
```

Potem w GitHubie: **Settings → Secrets and variables → Actions → Variables** dwie zmienne
(nie sekrety — obie są publiczne):

| Zmienna | Wartość |
| --- | --- |
| `PUSH_API` | adres Workera z `wrangler deploy` |
| `VAPID_PUBLIC_KEY` | klucz publiczny wypisany przez `node keys.mjs` |

Następne wdrożenie strony (push na `main`) zbuduje aplikację z kartą „Przypomnienia”
w Ustawieniach. Bez tych zmiennych karty nie ma, a aplikacja działa jak dotąd.

Plik `vapid-private.jwk.json` jest poza gitem. Nie generuj kluczy drugi raz — nowy klucz
odcina wszystkie istniejące subskrypcje (skrypt odmówi, jeśli plik już jest).

## Lokalnie

`npm test` w katalogu głównym obejmuje też serwer (`server/push/*.test.ts`). Worker lokalnie:
`npx wrangler dev --test-scheduled`, a przebieg crona: `curl "http://localhost:8787/__scheduled"`.

## Limity

Darmowy plan Workers daje 10 ms procesora na przebieg crona; jedno przypomnienie to ułamek
milisekundy, więc mieści się kilkanaście na przebieg, a reszta wychodzi w następnym (co 5 minut,
okno 90 minut). Dla kilkuset osób wystarczy; przy większym ruchu — plan płatny Workers.
