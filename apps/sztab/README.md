# GYM TRACKER Sztab

Aplikacja dla prowadzących — trenerów, dietetyków, fizjoterapeutów i lekarzy — którzy prowadzą
ludzi korzystających z GYM TRACKERa. Prowadzący ma konto. Podopieczny nie ma go nigdy: łączy się
z GYM TRACKERa przez zaproszenie, sam wybiera, co pokazuje, i w każdej chwili kończy współpracę.

GYM TRACKER działa bez Sztabu tak jak dotąd. Sztab bez GYM TRACKERa nie ma czego pokazać.

React 19 + TypeScript 6 + Vite 8, Supabase (Auth, Postgres z RLS). Atlas, treningi, plany i silnik
GYM TRACKERa importuje wprost z `../../src` (alias `@gt`), protokół współpracy z `@gymtracker/link`
(`packages/link`).

## Uruchomienie

Wymaga Node 22.12+ i Dockera (lokalny Supabase). Z katalogu głównego repozytorium:

```bash
npm install
npm run db:start -w @gymtracker/sztab      # lokalny Supabase: baza, logowanie, skrzynka testowa
npm run sztab                               # http://localhost:5190
npm run dev -- --port 5174                  # GYM TRACKER z tej gałęzi — tu prowadzą linki zaproszeń
```

Maile (potwierdzenie konta, reset hasła, link logowania) trafiają do skrzynki testowej Supabase:
<http://127.0.0.1:54324>.

Bez telefonu: `npx tsx apps/sztab/scripts/demo-client.ts '<link zaproszenia>'` przyjmuje
zaproszenie jak GYM TRACKER i wysyła siedem tygodni przykładowych danych.

W samym Sztabie, u każdego prowadzącego (także w produkcji, bez dostępu administratora): **„Dodaj
przykłady”** w Bibliotece zapisuje przykładową bibliotekę (`src/lib/demo/library.ts` — każdy rodzaj,
program odsyłający do tej samej partii), a **„Dodaj podopiecznego demo”** na liście podopiecznych zakłada
współpracę z telefonem symulowanym w tej przeglądarce (`src/lib/demo/client.ts`): zaproszenie „DEMO”
przyjęte przez `invite_accept`, siedem tygodni danych, zalecenia sprzed czterech tygodni z odpowiedziami,
wiadomości i zdjęcia. „Symuluj telefon” na jego karcie odpowiada na to, co wysłano (ta sama symulacja co
`seed.ts phone`: `src/lib/demo/phone.ts`), „Usuń demo” kończy współpracę i zapomina telefon.

Bez rejestracji, do sprawdzania ekranów (Playwright): `npx tsx apps/sztab/scripts/seed.ts coach <stan.json>`
zakłada prowadzącego z sejfem i dwóch podopiecznych z danymi (wypisuje mail, hasło i kod sejfu) i wysyła
każdemu zalecenia z datą sprzed 4 tygodni — cotygodniowy check-in, nawyki, jadłospis na 7 dni (szyfrowane
kluczem prowadzącego jak w przeglądarce; `--bez-historii` — bez nich). Potem `… seed.ts phone <stan.json>`
każe telefonom odpowiedzieć tak, jak zrobiłby to telefon: formularze, nawyki i jadłospis najwyżej 4 tygodnie
wstecz, nigdy sprzed wysłania zalecenia, dni w strefie paczki (`Europe/Warsaw`); do tego wiadomość, zdjęcia
i rezerwacja pierwszego wolnego terminu. Zalecenia wysłane z przeglądarki przed `phone` też dostaną
odpowiedzi — od dnia wysłania.

```bash
npm run typecheck -w @gymtracker/sztab
npm test -w @gymtracker/sztab               # logika: pulpit, sejf, wysyłka, skróty
npm run test:db -w @gymtracker/sztab        # baza na żywo: RLS z obu stron i funkcje telefonu
npm run build -w @gymtracker/sztab
```

## Jak to działa

```
GYM TRACKER (telefon, bez konta)  ──szyfrogram──▶  Supabase (UE)  ──szyfrogram──▶  Sztab (przeglądarka prowadzącego)
   dane lokalne, klucze współpracy                  konta, RLS, RPC                  sejf, pulpit, biblioteka
```

- **Serwer nie czyta danych podopiecznych.** Paczka danych i zalecenia to AES-256-GCM kluczem,
  który liczą telefon i przeglądarka prowadzącego (ECDH P-256 → HKDF). W bazie leży szyfrogram.
- **Odcisk klucza w linku.** Link zaproszenia niesie za `#` odcisk klucza prowadzącego, telefon
  sprawdza nim klucz z serwera — przejęty serwer nie podstawi własnego.
- **ID podopiecznego** to HMAC sekretu telefonu i identyfikatora prowadzącego: ten sam prowadzący
  zawsze widzi to samo ID, dwóch prowadzących — dwa różne. Szczegóły i rachunek kolizji:
  `packages/link/src/id.ts`.
- **Sejf prowadzącego.** Klucz prywatny leży na serwerze zapieczętowany kodem odzyskiwania
  (PBKDF2 600 tys. rund), a na komputerze — w IndexedDB jako klucz nieeksportowalny.
- **Wyłączność obszarów** (trening, żywienie, rehabilitacja — jeden prowadzący naraz; wgląd — do
  trzech) pilnuje telefon, bo tylko on wie, kto kogo prowadzi.
- **Dane wysyła telefon**: przy otwarciu aplikacji, po treningu i po zmianie zgody, najwyżej raz na
  15 minut. Pulpit mówi, z kiedy są.
- **Pulpit liczy silnikiem GYM TRACKERa** (`src/lib/metrics.ts`): realizacja planu, tonaż,
  kierunek zmiany ćwiczeń, średnia waga — te same liczby, które widzi podopieczny.
- **Prowadzenie dzień po dniu** (spec `docs/superpowers/specs/2026-11-25-sztab-funkcje-konkurencji-design.md`):
  formularze (wywiad, cotygodniowy check-in, skala bólu), nawyki i jadłospis to zalecenia jak reszta;
  odpowiedzi i odhaczenia przychodzą w paczce (część `coaching`), a Sztab liczy z nich realizację
  w strefie czasowej telefonu (`snapshot.tz`), tak jak liczy telefon.
- **Wiadomości i zdjęcia** idą jak paczka — szyfrogram z AAD związanym z wierszem. Zdjęcia tylko za
  osobną zgodą (`photos`), najwyżej 60, zmniejszone na telefonie.
- **Harmonogram**: zalecenie z „pokaż od” (`assignments.visible_from`) — funkcja odbioru telefonu
  nie oddaje go wcześniej. Program w bibliotece to oś dni z elementów biblioteki; „Uruchom program”
  rozpisuje go na zaplanowane zalecenia.
- **Wizyty** to jedyne jawne dane współpracy: godziny, tytuł, miejsce (bez danych o zdrowiu — formularz
  o tym przypomina). Rezerwację z telefonu pilnuje baza: limit miejsc z blokadą wiersza, 10 przyszłych
  wizyt na podopiecznego.
- **Grupy i skróty** zostają w przeglądarce prowadzącego, nigdy na serwerze.

Pełny opis decyzji: `docs/superpowers/specs/2026-11-03-sztab-design.md`.

## Struktura

```
src/
  App.tsx              bramka logowania (brak sesji → profil i sejf → otwarcie sejfu → aplikacja) i trasy
  session.tsx          stan logowania, sejf na tym komputerze
  lib/
    env.ts             konfiguracja z buildu (domyślnie lokalny Supabase)
    sb.ts              klient Supabase (PKCE)
    router.ts          trasy w ścieżce adresu (History API)
    vault.ts           sejf: klucz w IndexedDB, kod odzyskiwania, zmiana kodu
    data.ts            zapytania: prowadzący, zaproszenia, współprace, paczki, zalecenia, biblioteka,
                       wiadomości, zdjęcia, terminy i rezerwacje
    metrics.ts         pulpit z paczki silnikiem GYM TRACKERa
    coached.ts         wspólne dla listy i karty: które zalecenia obowiązują (jak na telefonie), dzień w strefie
                       telefonu, 7 pełnych dni przed min(dziś, dzień paczki)
    review.ts          „Do przejrzenia”: powody i kolejność na liście podopiecznych (reviewLoad.ts — wczytywanie po 4)
    adherence.ts       realizacja nawyków i jadłospisu dzień po dniu, w strefie telefonu
    forms.ts           gotowe formularze, okresy, stan check-inu, serie do wykresów
    program.ts         daty harmonogramu i programu (zmiana czasu), wybór obszaru przy wysyłce do wielu
    assign.ts          treść z biblioteki jako zalecenie i to samo sprawdzenie, które robi telefon
    calendar.ts        tydzień, powtarzane terminy, plik .ics
    mfa.ts, mfaApi.ts  logowanie dwuetapowe (TOTP)
    aliases.ts         prywatne skróty i grupy (tylko w przeglądarce), CSV do CRM
    labels.ts          nazwy obszarów, zakresów, zawodów, rodzajów zaleceń
    demo/              przykładowa biblioteka (library.ts), telefon symulowany wspólny z seed.ts (phone.ts,
                       snapshot.ts), podopieczny demonstracyjny w przeglądarce (client.ts, state.ts)
  pages/               logowanie i rejestracja (z kodem TOTP), pierwsze kroki i sejf, podopieczni („Do
                       przejrzenia”, grupy, akcje grupowe), pulpit z zakładkami (wiadomości, odpowiedzi,
                       realizacja, zdjęcia, zalecenia z harmonogramem), zaproszenia (link i QR),
                       biblioteka i kreatory, wysyłka (zaplanowana, do wielu), kalendarz wizyt,
                       ustawienia (MFA), RODO
  components/          wspólne elementy, kreatory (trening, plan, cele, badania, zalecenie, formularz,
                       nawyki, jadłospis, program), uruchomienie programu, widok do druku, QR
supabase/
  config.toml          lokalny Supabase: potwierdzenie maila, hasło od 10 znaków, MFA TOTP
  migrations/          schemat, RLS i funkcje RPC dla telefonu
test/
  logic.test.ts        pulpit, sejf, wysyłka, skróty (jsdom, IndexedDB w pamięci)
  db/rpc.test.ts       baza na żywo: zaproszenia, paczki, zalecenia, zgoda, zakończenie, usunięcie konta
  db/features.test.ts  baza na żywo: harmonogram, wiadomości, zdjęcia, wizyty, uprawnienia nowych tabel
  *.test.ts(x)         formularze, nawyki i jadłospis, realizacja, „Do przejrzenia”, harmonogram, druk,
                       wiadomości, zdjęcia, kalendarz, MFA
scripts/demo-client.ts telefon demo do sprawdzania pulpitu
scripts/seed.ts        prowadzący z sejfem i dwa telefony z danymi — do sprawdzania ekranów
public/_headers        CSP i nagłówki bezpieczeństwa (Cloudflare Workers, pliki statyczne)
wrangler.jsonc         Worker z plikami statycznymi: dist/, każda nieznana ścieżka → index.html (SPA)
```

## Wdrożenie

1. **Supabase** (projekt w regionie Frankfurt): `npx supabase link --project-ref <ref>`,
   `npx supabase db push --remote` (CLI 3 bez `--remote` celuje w lokalną bazę). W panelu:
   Authentication → URL Configuration — adres Sztabu jako Site URL i `https://<adres>/**` w
   Redirect URLs; włączone potwierdzanie maila, „Leaked password protection” (plan płatny),
   minimum 10 znaków; własny SMTP do maili (wbudowany wysyła tylko do członków organizacji
   Supabase, ok. 2 maile na godzinę).
2. **Google** (opcjonalnie): klient OAuth w Google Cloud, wpisany w Authentication → Providers →
   Google; w buildzie `VITE_SZTAB_GOOGLE=1`.
3. **Hosting** (Cloudflare Workers, pliki statyczne — `wrangler.jsonc`): zmienne buildu w
   `apps/sztab/.env.production.local` (poza gitem): `VITE_SZTAB_URL`, `VITE_SZTAB_ANON_KEY` —
   starszy klucz `anon` (JWT, `eyJ…`), bo GYM TRACKER wysyła go też jako `Authorization: Bearer`,
   a nowy `sb_publishable_…` nie jest JWT — i `VITE_TRACKER_URL`. Potem
   `npm run build -w @gymtracker/sztab` i z katalogu `apps/sztab` `npx wrangler deploy`.
4. **GYM TRACKER**: zmienne repozytorium `SZTAB_URL`, `SZTAB_ANON_KEY`, `SZTAB_APP_URL` (Settings
   → Secrets and variables → Actions → Variables). Bez nich Współpraca w GYM TRACKERze jest
   ukryta.

## Czego tu jeszcze nie ma

Etap 2 jest zrobiony (formularze ze skalą bólu i check-inem, jadłospis z przepisami, komentarze do
treningów w rozmowie, MFA) razem z funkcjami z przeglądu FitFive i Trainero — decyzje i to, czego
świadomie nie ma, w `docs/superpowers/specs/2026-11-25-sztab-funkcje-konkurencji-design.md`.

Dalej: pliki i wideo w szyfrowanym Storage (zamiast adresów), powiadomienia push o wiadomościach,
synchronizacja z Google Calendar. Etap 3: analiza AI płatna za analizę (własny klucz z przeglądarki
prosto do dostawcy albo serwer MCP na komputerze prowadzącego), widok drużyny (dzielenie kluczy
współpracy), płatności.
