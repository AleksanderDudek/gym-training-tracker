# GYM TRACKER Sztab — aplikacja dla prowadzących

3 listopada 2026. Plan z wizualizacjami: artefakt „GYM TRACKER Sztab” (claude.ai). Strona GYM
TRACKERa: `2026-11-03-wspolpraca-design.md`.

## Cel

Trener, dietetyk, fizjoterapeuta albo lekarz prowadzi ludzi, którzy używają GYM TRACKERa. Widzi
ich historię (treningi, jedzenie, waga, badania) w zakresie, na który podopieczny się zgodził,
i wysyła im plany, treningi, cele, badania do zrobienia i zalecenia. Konto ma tylko prowadzący.

Twarde założenia od autora:

- GYM TRACKER działa samodzielnie jak dotąd; Sztab musi z niego korzystać.
- Zaproszenie wysyła prowadzący; dopiero przyjęcie tworzy widok prowadzenia.
- Jedna osoba może mieć kilku prowadzących, ale nie dwóch w tym samym obszarze (nie dwie diety, nie
  dwa plany treningowe naraz). Jedna osoba może prowadzić kilka obszarów.
- Podopieczny jest anonimowy: losowe alfanumeryczne ID, unikalne bez sprawdzania w bazie. Dane
  kontaktowe trzyma prowadzący u siebie, nigdy w Sztabie.

## Decyzje

### Szyfrowanie end-to-end zamiast „anonimowej bazy”

Pseudonimizacja (ID zamiast nazwiska) nie zdejmuje z danych RODO — waga, jedzenie i badania to dane
o zdrowiu (art. 9), a prowadzący wie, kto jest kim. Dlatego serwer w ogóle nie dostaje danych
w postaci jawnej:

- Paczka danych i zalecenia: AES-256-GCM, klucz współpracy = HKDF(ECDH(P-256 prowadzącego, P-256
  telefonu), numer zaproszenia). Szyfrogram ma dane dodatkowe (`AAD`) z miejscem — paczka jednej
  współpracy podłożona pod inną się nie otworzy.
- Link zaproszenia niesie za `#` odcisk klucza prowadzącego (16 bajtów SHA-256). Telefon porównuje
  go z kluczem z serwera, więc przejęty serwer nie podstawi swojego klucza.
- Jawne w bazie zostaje tylko to, czego serwer potrzebuje do pracy: ID, obszary, zakres zgody,
  rodzaj i data zalecenia, czas ostatniej paczki.

To ten sam wzorzec, którego GYM TRACKER używa dla zegarka („klucza serwer nie ma”). Odrzucone:
jawne dane z RLS (prostsze zapytania i analizy po stronie serwera, ale serwer staje się
miejscem wycieku danych o zdrowiu wszystkich podopiecznych).

### Telefon wysyła, serwer nie pobiera

GYM TRACKER nie ma backendu z danymi — leżą w przeglądarce. „Cykliczne pobieranie” jest więc
wysyłką z telefonu: przy otwarciu, po zamkniętym treningu, po zmianie zgody; najwyżej co 15 minut.
Pulpit uczciwie mówi, z kiedy są dane.

### ID podopiecznego liczone, nie losowane z bazy

`HMAC-SHA256(sekret telefonu, "id|<prowadzący>|<licznik>")` → 100 bitów, 20 znaków Crockforda
(`GT-7K4Q-9XM2-HT3P-ZR8W-E5NA`). Ten sam prowadzący zawsze widzi to samo ID (także po zakończeniu
i nowym zaproszeniu), różni prowadzący — różne ID tej samej osoby, więc nie dopasują jej między sobą.
Kolizja przy milionie podopiecznych jednego prowadzącego ≈ 4·10⁻¹⁹; baza ma unikalny indeks wśród
trwających współprac, a odmowa `pseudonym_taken` każe telefonowi policzyć ID z licznikiem + 1.
Sekret jedzie w kopii zapasowej GYM TRACKERa, więc odtworzony telefon wraca z tym samym ID.

Odrzucone: UUID v4 z telefonu (też bez kolizji, ale inny u każdego zaproszenia — prowadzący
traciłby ciągłość) i jedno ID dla wszystkich prowadzących (pozwala im łączyć dane jednej osoby).

### Obszary i zakres to dwie różne rzeczy

Obszar — co prowadzący układa: trening, żywienie, rehabilitacja (każdy: jeden naraz) i wgląd (bez
planów, np. lekarz; do trzech naraz). Zakres — co podopieczny pokazuje: treningi, ruch, jedzenie,
ciało, badania. Zaproszenie proponuje oba, podopieczny przyjmuje obszary (w całości albo
w części) i odhacza zakres. Rehabilitacja i wgląd doszły do założeń autora: fizjoterapeuta
i trener mogą prowadzić jednocześnie, a lekarz oglądający wyniki nie koliduje z nikim.

Wyłączność pilnuje telefon (`planAcceptance`): serwer nie wie, że dwie współprace to ta sama osoba,
i nie powinien. Przy zajętym obszarze telefon proponuje „zamień prowadzącego” — tamta współpraca
traci ten obszar albo kończy się, gdy nie zostaje jej żaden.

### Sejf prowadzącego

Klucz prywatny na serwerze zapieczętowany kodem odzyskiwania (24 znaki, PBKDF2-SHA256 600 tys.
rund). Na komputerze — w IndexedDB jako `CryptoKey` nieeksportowalny, więc na co dzień kod nie jest
potrzebny. Konto powstaje dopiero po przepisaniu ostatniej grupy kodu. Odrzucone: klucz z hasła
logowania (reset hasła kasowałby dostęp do danych, a hasło przechodzi przez Supabase Auth).

### Supabase

Logowanie według standardu bez pisania go od zera: potwierdzenie maila, reset hasła, link
logowania, Google (za przełącznikiem), MFA TOTP, ochrona przed wyciekniętymi hasłami, PKCE.
Postgres z RLS dla prowadzącego; telefon bez konta rozmawia przez funkcje `SECURITY DEFINER`
z tokenem (w bazie tylko SHA-256). Region Frankfurt. Odrzucone: Cloudflare Workers + D1 + Better
Auth (jeden dostawca z obecnym serwerem GYM TRACKERa, ale logowanie, maile i uprawnienia do
złożenia samemu), Firebase (reguły dokumentowe zamiast SQL, słabsze dopasowanie do relacji).

### Monorepo bez przenosin

GYM TRACKER zostaje w korzeniu (wdrożenie na Pages, filmy demo, 3600+ testów, ścieżki w
dokumentacji). Doszły workspaces npm: `packages/link` (protokół — jedyne, co obie aplikacje
muszą rozumieć identycznie) i `apps/sztab`. Sztab bierze atlas, plany i silnik z `src/` przez alias
`@gt`, bez kopiowania; do osobnego pakietu przejdą, gdy zmiany w jednej aplikacji zaczną psuć
drugą. Odrzucone teraz: przeniesienie GYM TRACKERa do `apps/tracker` i Turborepo.

### Paczka w typach GYM TRACKERa

Dziennik, waga, ruch i plan jadą w kształcie zapisu aplikacji, a Sztab składa z nich stan i woła
ten sam silnik (`snapshot`, `weightTrend`, `doneExercises`, `trend`, `sessionTonnage`). Plan i trening
od prowadzącego to `PlanTemplate` i `Workout`, więc w GYM TRACKERze stają się zwykłym planem własnym
— progresja, kalendarz i odznaki działają bez zmian.

### Żadnych danych kontaktowych

Pola „imię podopiecznego” nie ma. Prowadzący może dopisać prywatny skrót, który zostaje w jego
przeglądarce, i wyeksportować listę ID do CRM (CSV). Zaproszenie ma notatkę dla prowadzącego
z wyraźną prośbą, żeby nie wpisywać tam nazwisk. Strona „RODO i rejestr” mówi, kto jest
administratorem, gdzie trzymać rejestr, jak odpowiadać na żądania i daje wzór klauzuli.

## Model zagrożeń (skrót)

| Kto | Co może | Czego nie może |
|---|---|---|
| Przejęta baza / operator | czytać ID, obszary, zakres, daty; kasować | odczytać danych, podstawić klucza (odcisk w linku), podrobić paczki (GCM) |
| Ktoś z linkiem zaproszenia | przyjąć je, zanim zrobi to podopieczny | — (prowadzący widzi nowego podopiecznego i może zakończyć; link wysyła się bezpośrednio, działa raz, wygasa) |
| Ktoś z numerem współpracy | sprawdzić, czy trwa | czegokolwiek więcej bez tokenu |
| XSS w Sztabie | używać klucza, póki strona otwarta | wynieść klucza (nieeksportowalny) |

## Zrobione (etap 1)

Pakiet protokołu z testami; schemat, RLS i funkcje z testami na żywej bazie; Sztab: rejestracja,
logowanie, link na maila, reset hasła, sejf z kodem, podopieczni, pulpit (przegląd, trening,
jedzenie, ciało, badania, zalecenia), zaproszenia z linkiem i QR, biblioteka z kreatorem treningu
i planu na atlasie i doradcy GYM TRACKERa, wysyłka pięciu rodzajów zaleceń, ustawienia, RODO;
telefon demo; CI. Strona GYM TRACKERa — osobny dokument.

## Etap 2 i 3

Plany żywieniowe i przepisy z bazy GYM TRACKERa, program rehabilitacyjny ze skalą bólu, check-in,
wideo w Storage, komentarze do sesji, MFA w interfejsie. Potem analiza AI płatna za analizę:
(a) własny klucz prowadzącego — zapytanie idzie z przeglądarki prosto do dostawcy, dane nie
dotykają serwera; (b) kredyty Sztabu przez funkcję brzegową, za wyraźną zgodą przy każdej analizie;
(c) serwer MCP na komputerze prowadzącego, który otwiera sejf kodem i daje jego własnemu modelowi
narzędzia „lista podopiecznych”, „paczka”. Do tego widok drużyny i płatności.

## Do zrobienia przez człowieka

Projekt Supabase w chmurze, klient OAuth Google, hosting i domena Sztabu, zmienne `SZTAB_*`
w GitHubie, regulamin, polityka prywatności i umowa powierzenia (do przejrzenia przez prawnika).
