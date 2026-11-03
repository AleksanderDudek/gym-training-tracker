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
    data.ts            zapytania: prowadzący, zaproszenia, współprace, paczki, zalecenia, biblioteka
    metrics.ts         pulpit z paczki silnikiem GYM TRACKERa
    aliases.ts         prywatne skróty (tylko w przeglądarce) i lista do CRM
    labels.ts          nazwy obszarów, zakresów, zawodów, rodzajów zaleceń
  pages/               logowanie i rejestracja, pierwsze kroki i sejf, podopieczni, pulpit,
                       zaproszenia (link i QR), biblioteka i kreatory, wysyłka, ustawienia, RODO
  components/          wspólne elementy, kreatory (trening, plan, cele, badania, zalecenie), QR
supabase/
  config.toml          lokalny Supabase: potwierdzenie maila, hasło od 10 znaków, MFA TOTP
  migrations/          schemat, RLS i funkcje RPC dla telefonu
test/
  logic.test.ts        pulpit, sejf, wysyłka, skróty (jsdom, IndexedDB w pamięci)
  db/rpc.test.ts       baza na żywo: zaproszenia, paczki, zalecenia, zgoda, zakończenie, usunięcie konta
scripts/demo-client.ts telefon demo do sprawdzania pulpitu
public/_headers        CSP i nagłówki bezpieczeństwa (Cloudflare Pages); _redirects — SPA
```

## Wdrożenie

1. **Supabase** (projekt w regionie Frankfurt): `npx supabase link --project-ref <ref>`,
   `npx supabase db push`. W panelu: Authentication → URL Configuration — adres Sztabu jako Site
   URL i `https://<adres>/**` w Redirect URLs; włączone potwierdzanie maila, „Leaked password
   protection”, minimum 10 znaków; własny SMTP do maili (domyślny Supabase ma niski limit).
2. **Google** (opcjonalnie): klient OAuth w Google Cloud, wpisany w Authentication → Providers →
   Google; w buildzie `VITE_SZTAB_GOOGLE=1`.
3. **Hosting** (Cloudflare Pages): katalog `apps/sztab`, polecenie
   `npm ci && npm run build -w @gymtracker/sztab`, wynik `apps/sztab/dist`. Zmienne:
   `VITE_SZTAB_URL`, `VITE_SZTAB_ANON_KEY` (klucz publiczny projektu), `VITE_TRACKER_URL`.
4. **GYM TRACKER**: zmienne repozytorium `SZTAB_URL`, `SZTAB_ANON_KEY`, `SZTAB_APP_URL` (Settings
   → Secrets and variables → Actions → Variables). Bez nich Współpraca w GYM TRACKERze jest
   ukryta.

## Czego tu jeszcze nie ma

Etap 2: plany żywieniowe i przepisy, program rehabilitacyjny ze skalą bólu, cotygodniowy check-in,
wideo w Storage zamiast adresów, komentarze do sesji, MFA w interfejsie (Supabase ma je włączone).
Etap 3: analiza AI płatna za analizę (własny klucz z przeglądarki prosto do dostawcy albo serwer
MCP na komputerze prowadzącego), widok drużyny, płatności.
