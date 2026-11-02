# Brakujące funkcje względem innych aplikacji — 11 rzeczy w jednej rundzie

Data: 2026-11-02. Decyzje podjęte samodzielnie na prośbę właściciela („zrób najtańsze, średnie
i łatwe… masz wolną rękę, pick recommended”). Źródło listy: porównanie z Fitatu
(`docs/research/fitatu-vs-gym-tracker.md`) oraz Strong, Hevy, MyFitnessPal, Yazio, MacroFactor.

## Zakres

| # | Funkcja | Pakiet (agent) |
| --- | --- | --- |
| 1 | Kopiuj posiłek / cały dzień | A — dziennik |
| 3 | Woda | A — dziennik |
| 8 | Błonnik, cukry, sól w bilansie dnia | A — dziennik |
| 11 | Okno jedzenia (post przerywany) | A — dziennik |
| 2 | Notatki do treningu i ćwiczenia | B — trening |
| 10 | Mięśnie w tym tygodniu (mapa ciała) | B — trening |
| 4 | Obwody ciała | C — sylwetka |
| 9 | Zdjęcia sylwetki | C — sylwetka |
| 7 | Tryb ciemny | D — wygląd |
| 5 | Eksport do arkusza (CSV) | E — dane i przypomnienia |
| 6 | Przypomnienie o jedzeniu | E — dane i przypomnienia |

## Zasady wspólne dla wszystkich pakietów

1. **Teksty**: każdy tekst w katalogu `text({ pl, en })` (`docs/i18n.md`); `node scripts/i18n-scan.mjs`
   zwraca 0. Ton aplikacji (README „Ton”): bez oceniania, bez wstydu, liczby bez „brawo” i „uwaga”.
2. **Kolory tylko z tokenów** (`var(--…)` ze `src/styles.css`) — żadnych nowych heksów w nowych
   komponentach. Inaczej tryb ciemny (pakiet D) ich nie obejmie.
3. **CSS jedzenia** z prefiksem obszaru (`fd-diet-` itd., `src/food/css.test.ts`).
4. **Dane**: wszystko nowe wchodzi do kopii zapasowej (eksport/import pliku) i znika przy „Usuń
   wszystkie dane” — wyjątek opisany przy zdjęciach sylwetki. Import starszej kopii bez nowych pól
   działa (puste wartości).
5. **Baza diety (Dexie)**: wersję 6 podbija **tylko pakiet A**. Pozostałe pakiety nie zmieniają
   schematu `produkty-pl-dieta`.
6. **Zdrowie**: bez słów o leczeniu; zastrzeżenia biorą tekst z `src/components/Health.tsx`
   (jedno źródło). Funkcje, przy których rozsądek wymaga zastrzeżenia (post), dostają linijkę
   i odnośnik do `#/zdrowie`.
7. **Dostępność**: cele dotykowe ≥ 44 px, etykiety pól, stan nie tylko kolorem, 320 px bez
   poziomego przewijania.
8. **Testy**: każda funkcja ma testy silnika i ekranu (polski) oraz jeden test po angielsku
   (`*.en.test.*`). `npm run typecheck`, `npm run lint` (0 błędów), `npx vitest run` zielone.
9. **README**: każda funkcja dostaje opis w odpowiedniej części README (po polsku, w stylu reszty).

## Decyzje

### A1. Kopiuj posiłek / cały dzień

- W karcie „Zjedzone” przy każdej porze posiłku i dla całego dnia akcja **„Kopiuj na…”** z wyborem:
  „Dziś”, „Jutro”, „Inny dzień”. Na pustym dniu (dziś bez wpisów) w karcie zjedzonych skrót
  **„Jak wczoraj”** — kopiuje wczorajsze wpisy jednym stuknięciem, z „Cofnij” w toaście.
- Kopiowane są wpisy z ich wartościami (bez zmian ilości); pora posiłku zostaje ta sama.
- Dlaczego: najczęstsza czynność w licznikach (MFP „Copy from yesterday”, Fitatu „Copy day” —
  płatne). Ludzie jedzą powtarzalnie; ulubione i zestawy już są, brakuje dnia i posiłku.

### A3. Woda

- Mała karta w dzienniku pod „Zjedzone”: „Woda: 1,25 l z 2 l” i przyciski **+250 ml**, **+500 ml**
  oraz „−” (cofnięcie ostatniego). Zapis w dniu (`DayRow.water`, ml).
- Cel z napojów według EFSA (2010, AI całkowitej wody 2,0 l K / 2,5 l M, z czego ok. 80 % z napojów):
  **1,6 l kobiety, 2,0 l mężczyźni**, do zmiany w profilu diety; w ciąży / przy karmieniu +0,3 / +0,7 l
  (EFSA). Bez oceny dnia — sam pasek. Karta da się wyłączyć w profilu diety („Pokazuj wodę”), domyślnie
  włączona.

### A8. Błonnik, cukry, sól

- Wpis w dzienniku zapisuje także `fiber`, `sugars`, `salt` (g), gdy źródło je zna (produkt, przepis,
  lokal, zestaw); migracja Dexie v6 — stare wpisy mają `null`.
- W bilansie dnia sekcja zwinięta „Węglowodany i tłuszcz” staje się **„Więcej: węglowodany, tłuszcz,
  błonnik, cukry, sól”**. Błonnik z celem **25 g** (EFSA), sól z górną granicą **5 g** (WHO), cukry
  bez celu (dane to cukry ogółem, nie dodane — cel WHO dotyczy dodanych, więc go nie stawiamy).
- Gdy część wpisów nie ma danych: „co najmniej 18 g (bez danych w 2 wpisach)”.

### A11. Okno jedzenia (post przerywany)

- **Opcja, domyślnie wyłączona**, w profilu diety → „Okno jedzenia”: 12:12, 14:10, 16:8, 18:6.
  Po włączeniu w dzienniku (tylko dziś) karta z licznikiem: „Post od 20:15 · zostało 3 h 40 min”
  albo „Okno jedzenia do 18:00”, z „Zaczynam post” / „Kończę post”. Start postu podpowiada godzina
  ostatniego wpisu, ale zapisuje go człowiek.
- Okno **nie zmienia celu kalorii** — jeden cel na dzień zostaje jedyną regułą.
- Linijka zastrzeżenia (nie dla osób w ciąży, karmiących, z cukrzycą na lekach, z zaburzeniami
  odżywiania — porozmawiaj z lekarzem) z odnośnikiem do `#/zdrowie`; przy profilu z ciążą/karmieniem
  opcja jest niedostępna z wyjaśnieniem.
- Dlaczego opcja, a nie domyślnie: przegląd badań (np. Cochrane/BMJ 2023–2024) nie pokazuje przewagi
  postu nad zwykłym deficytem przy tej samej kaloryczności; dla części ludzi to po prostu wygodna
  struktura dnia. Dajemy narzędzie, nie obietnicę.

### B2. Notatki

- `LogEntry.note?` (trening) i `LogItem.note?` (ćwiczenie), do 500 znaków. Pole „Notatka” w podsumowaniu
  po zamkniętej sesji i przy ćwiczeniu w trakcie (ikona ołówka, nie w drodze „Zrobione”); edycja
  w historii treningów. Notatka ćwiczenia **wraca przy następnej sesji tego ćwiczenia** jako
  „Ostatnio: …” — to w Strong/Hevy najcenniejsze („wyżej siodełko”, „chwyt szerzej”).
- Notatki są w zapisie treningów (localStorage), więc same wchodzą do kopii zapasowej.

### B10. Mięśnie w tym tygodniu

- Karta w zakładce Trening → Plan (i w Profilu, jeśli plan nie trwa): dwa rysunki ciała (przód, tył),
  16 grup mięśni zabarwionych liczbą serii w bieżącym tygodniu (główne mięśnie = 1 seria,
  pomocnicze = 0,5 — ten sam model co doradca). Skala z tokenów, plus **lista liczbowa** pod rysunkiem
  (rysunek nie jest jedynym nośnikiem informacji). Odniesienie: 10–20 serii na partię na tydzień
  (Schoenfeld i in., 2017) jako podpis, bez ocen „za mało/za dużo”.

### C4. Obwody ciała

- Dziennik obwodów w zapisie treningów obok wagi (`state.measures`, wpis na dzień jak ważenie):
  talia, biodra, klatka, ramię, udo — cm, do 0,1. Każde pole opcjonalne.
- Dom: Profil → karta „Sylwetka” (obok wagi): ostatnie wartości, zmiana od pierwszego pomiaru, mini
  wykres każdego obwodu (istniejący `Trendline`). W Postępie diety kafelek „Talia” z tą samą liczbą.
- Bez ocen i progów zdrowotnych (zgodnie z zasadą ważenia: liczby bez oceny). Podpowiedź pomiaru:
  talia w połowie między łukiem żebrowym a talerzem biodrowym (WHO), rano, na wydechu.

### C9. Zdjęcia sylwetki

- W karcie „Sylwetka” „Dodaj zdjęcie” (aparat albo galeria), zapis w **osobnej bazie IndexedDB**
  (`gt-sylwetka`), zmniejszone do 1080 px, JPEG. Porównanie dwóch dat obok siebie (wybór „przed”
  i „po”), lista miniatur po datach, usuwanie.
- **Zdjęcia nie wchodzą do kopii zapasowej** (rozmiar) — karta mówi to wprost i daje „Pobierz”
  przy każdym zdjęciu. „Usuń wszystkie dane” kasuje także je. Zdjęcia nigdy nie wychodzą z telefonu.

### D7. Tryb ciemny

- Ustawienia → „Wygląd”: **Automatycznie** (domyślnie, za systemem), Jasny, Ciemny. Zapis jak język —
  w tej przeglądarce. `data-theme` na `<html>`; tokeny przedefiniowane dla ciemnego; `meta theme-color`
  idzie za motywem.
- Obsada, medale i sceny dostają ciemne warianty przez tokeny; **karty do udostępniania i plakat
  zostają jasne** (to obrazki dla innych, rysowane na płótnie). Mapa „W pobliżu”: kafelki OSM
  przyciemnione filtrem CSS w ciemnym motywie. Kontrast tekstu ≥ 4,5 : 1 (test tokenów).

### E5. Eksport do arkusza

- Ustawienia → „Dane” → **„Eksport do arkusza (CSV)”**: trzy pliki do wyboru — treningi (wiersz na
  serię), ciało (ważenia i obwody), jedzenie (wiersz na wpis). Po polsku separator `;` i przecinek
  dziesiętny (tak otwiera polski Excel), po angielsku `,` i kropka; UTF-8 z BOM. Plik powstaje
  w przeglądarce.

### E6. Przypomnienie o jedzeniu

- Nowe przypomnienie „Jedzenie z dziś” (domyślnie wyłączone, godzina do wyboru, domyślnie 20:00),
  tylko gdy jest profil diety. **Gdy włączone są oba wieczorne (kroki 19:30 i jedzenie), wychodzi
  jedno powiadomienie** o godzinie jedzenia: „Wpisz kroki i jedzenie z dziś” — trzecie powiadomienie
  dziennie to za dużo (ta sama zasada co ważenie).

## Poza zakresem

Licznik kalorii z AI głosem/tekstem (wymaga modelu w chmurze), widżet i Apple Watch (PWA),
społeczność.
