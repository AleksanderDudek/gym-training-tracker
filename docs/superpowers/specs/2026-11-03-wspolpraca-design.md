# Współpraca z prowadzącym — strona GYM TRACKERa

Uzupełnia `2026-11-03-sztab-design.md` (aplikacja dla prowadzących, schemat bazy, protokół
`@gymtracker/link`). Tu: decyzje po stronie telefonu.

## Wyłączona, dopóki build jej nie zna

`src/link/config.ts` czyta `VITE_SZTAB_URL` i `VITE_SZTAB_ANON_KEY` przy każdym wywołaniu (w buildzie
Vite i tak wpisuje stałe; testy podmieniają je `vi.stubEnv` bez przeładowania modułów). Brak którejś —
żadnej karty, żadnej uwagi, żadnego zapytania, a `#/wspolpraca…` mówi, że ta wersja się nie łączy.
`VITE_SZTAB_APP_URL` to tylko odnośnik. Baza dochodzi do `connect-src` (`vite/csp.ts`, drugi argument
`csp()`), także `http://127.0.0.1:54321` do lokalnego przebiegu end-to-end.

## Bez klienta Supabase

Telefon woła osiem funkcji RPC (`invite_preview` … `client_end`) zwykłym `fetch` na
`/rest/v1/rpc/<nazwa>` z kluczem anon w `apikey` i `Authorization`. `RpcError.code` to `message`
z odpowiedzi 400 (`raise exception 'bad_token'`); brak sieci i 5xx to `offline`. Odpowiedzi są
sprawdzane pole po polu (`cleanPreview`, `clientPull`) — to dane z zewnątrz.

## Co gdzie leży

- **`cfg.linkSecret`** w zapisie aplikacji — idzie z kopią, więc odtworzony telefon daje temu samemu
  prowadzącemu to samo ID. Powstaje leniwie: ekran zaproszenia liczy ID z kandydata, a zapisuje go
  dopiero „Przyjmij” (`ensureLinkSecret`). Przesiany przy wczytaniu i imporcie (`validLinkSecret`);
  import kopii bez sekretu nie kasuje sekretu telefonu.
- **`gt-link`** w `localStorage`, poza eksportem: współprace (token, klucz prywatny JWK, klucz
  prowadzącego, obszary, zakres, ID i licznik, czasy, stan) i zalecenia po odszyfrowaniu z lokalnym
  stanem i odhaczeniami. Moduł `store.ts` nie importuje kryptografii, żeby karta w profilu i uwaga na
  Dziś mogły stać w głównej paczce; szyfrowanie jest w `sync.ts`, a strony w leniwej paczce `Link`.
- Zakończona współpraca traci token i klucz prywatny, zostaje jako ślad (kto, kiedy), a jej zalecenia
  zostają na telefonie — plan od prowadzącego i tak już jest planem własnym.

## Przyjęcie (`accept.ts`)

1. Odcisk z linku musi pasować do klucza z `invite_preview` — sprawdzane przy wyświetleniu (ekran nie
   pokazuje wtedy nic z zaproszenia jako prawdziwego) i drugi raz tuż przed przyjęciem, na świeżym
   podglądzie.
2. Wyłączność przez `planAcceptance` z pakietu. Zajęty obszar jest odznaczony; zaznaczenie = zgoda na
   zamianę w tym obszarze. Częściowe przyjęcie: niezaznaczone obszary nie wchodzą.
3. Dawna współpraca z tym samym prowadzącym kończy się **przed** `invite_accept` — inaczej to samo ID
   byłoby zajęte (`pseudonym_taken`) i telefon wpadłby na ID z licznikiem 1, a historia u prowadzącego
   by się rozpadła.
4. `pseudonym_taken` → licznik + 1, najwyżej 5 prób.
5. Zamiany u innych prowadzących (`client_end` / `client_update`) **po** udanym przyjęciu. Bez sieci
   w tej chwili — zaległa zmiana (`pending`), ponawiana przez synchronizację; na ekranie działa od razu.
6. Pierwsza paczka idzie od razu, potem strona współpracy.

## Synchronizacja (`sync.ts`)

Przy starcie (2,5 s po wczytaniu), po powrocie do karty i 0,5 s po tym, jak dziennik treningów urósł
(zamknięty trening, import) — wtedy paczka idzie bez względu na kwadrans. Nigdy w trakcie sesji.
Moduł wczytuje się tylko, gdy jest trwająca współpraca albo zaległa zmiana (`hasLinkWork`). Jedna
synchronizacja naraz. Brak sieci przerywa przebieg po cichu.

- `bad_token` przy odbiorze → `client_status`; `ended` albo brak wiersza (konto prowadzącego usunięte)
  → koniec u siebie z uwagą na Dziś. Nieznany stan (brak sieci) niczego nie zmienia.
- Zalecenie otwierane kluczem współpracy z AAD `assignment|<współpraca>|<numer>`, sprawdzane
  `parseAssignment`, a numer w środku musi być numerem wiersza. Nie otwiera się — liczone jako
  zepsute, ekran mówi, ile takich. Wycofane — ukryte.
- Obszary i zakres przychodzą z serwera (prawdą jest serwer), chyba że czeka zaległa zmiana.
- Potwierdzenia (`ReceiptV1`) przy zobaczeniu, rozpoczęciu (uruchomiony plan, dodany trening,
  pierwsze odhaczenie), „Zrobione”, „Nie tym razem” i każdej zmianie odhaczeń; bez sieci czekają
  (`sent` ≠ `status`) i idą przy następnej synchronizacji.

## Paczka (`snapshot.ts`)

`buildSnapshot` jest czysta: zakresy, okno `SNAPSHOT_DAYS` liczone dniami lokalnymi. Jedzenie i badania
czyta `readExtras` z Dexie tymi samymi sitami co raport (`cleanRows`, `cleanProfile`, `loadReports`),
importami dynamicznymi — start aplikacji nie wczytuje kodu jedzenia. Cele dnia tylko przy profilu,
który ich nie chowa (`hidesKcal`). `LabValue` kopiuje `ref` (krotka `Range`) i `qual` wprost z
`LabResult`. Za duża paczka: okno kurczy się o ćwiartkę, aż szyfrogram zmieści się w
`SNAPSHOT_MAX_CHARS`; poniżej tygodnia — nie idzie nic. `bytes` = długość szyfrogramu.

## Zalecenia (`assign.ts`)

Plan i trening jako własne, z numerami `coach-<8 znaków numeru zalecenia>-<numer>`: nie nadpiszą
własnych, a drugie „Uruchom” podmienia kopię. Ćwiczenia spoza `EX` odpadają (ekran je wymienia);
trening bez ćwiczeń odpada z rotacji; rotacja może wskazywać gotowy trening z biblioteki; plan bez
rotacji się nie uruchamia. Po imporcie zwykła droga: `#/plany/<id>` albo `#/treningi/<id>`.

## Ekrany

Pięć zakładek bez zmian — współpraca należy do Profilu (`activeTab` → `prog`, rodzic `#/profil`).
Zaproszenie otwarte linkiem nie dostaje wprowadzenia, jak link do karty zegarka. Zakończenie pyta na
stronie (`role="group"`), nie w oknie. Teksty w `Link.text.ts` i `Link.words.ts` (`text({ pl, en })`),
etykiety zakresów słowami, a nie kluczami.

## Reset

„Usuń wszystkie dane” wymienia współprace w pytaniu, kończy je na serwerze (bez sieci — zostają tam
do wygaśnięcia po stronie prowadzącego; telefon i tak zapomina klucze i token), czyści `gt-link`,
a `freshState()` nie ma sekretu.

## Nie sprawdzone na żywej bazie

Wszystko biegnie przeciw Sztabowi w pamięci (`src/test/linkServer.ts`), który odtwarza funkcje
z migracji i kształt odpowiedzi PostgREST. Do sprawdzenia na lokalnym Supabase: odpowiedź funkcji
`void` (zakładam 204 albo pusty / `null` JSON — oba obsłużone), `json` z `invite_preview` dla
nieistniejącego numeru (`null`), limit 30 s na `client_push` (telefon odpowiada `wait`).
