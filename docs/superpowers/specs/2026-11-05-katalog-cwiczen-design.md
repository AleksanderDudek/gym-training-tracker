# Katalog 1300+ ćwiczeń, mapa mięśni na stronie ćwiczenia i widoczna „Technika” w treningu

Data: 2026-11-05. Decyzje podjęte samodzielnie na prośbę właściciela („Analyze current system. Use
best practices. Pick recommended. Plan it out and then finish on your own.”).

## Prośba

1. Przeanalizować openGym (github.com/DuarteSantos8/openGym) i dodać do aplikacji wszystkie jego
   ćwiczenia.
2. Animacja ćwiczenia z zaznaczonymi mięśniami, „jak w tych wszystkich aplikacjach” — wstawiona na
   stronie ćwiczenia pod animacją goryla (sekcja „Tor ruchu”) i nad filmami z YouTube.
3. Analiza openGym (raport).
4. „Technika” w treningu prowadzonym ma być dobrze widoczna i mówić więcej.

## Co jest w openGym i czego wolno użyć

- Katalog: 6554 wpisy. 1324 (`"textSource": "exercisedb"`) mają tekst z ExerciseDB v1 przez
  zbiór **hasaneyldrm/exercises-dataset — licencja MIT** (nazwy, mięśnie, sprzęt, instrukcje krok po
  kroku, także po polsku). 4308 to własne teksty openGym (**AGPL-3.0**), 922 to warianty (`variantOf`).
- Animacje i zdjęcia ćwiczeń to **Gym visual** (gymvisual.com) — komercyjna biblioteka, z której
  korzysta większość aplikacji (stąd „wszystkie wyglądają tak samo”). openGym ma licencję tylko dla
  siebie; NOTICE wprost zabrania ich wyciągania i używania gdzie indziej. Zbiór MIT ma ten sam wyjątek
  dla mediów.
- Małe mapy ciała w openGym to **MuscleMap** (Melih Colpan, MIT).
- Repozytorium GYM TRACKER jest publiczne i bez licencji. Wciągnięcie tekstów AGPL wymuszałoby
  przejście całej aplikacji na AGPL.

## Decyzje

| # | Decyzja | Dlaczego |
| --- | --- | --- |
| 1 | Importujemy **1324 ćwiczenia z zbioru MIT** (hasaneyldrm/exercises-dataset, commit `7455efae`), bezpośrednio ze źródła MIT, nie z plików openGym. | Jedyna część katalogu openGym, której licencja pozwala na użycie w aplikacji bez licencji AGPL. Źródło MIT ma też polskie instrukcje (MIT obejmuje tłumaczenia). |
| 2 | **Nie** bierzemy 4308 tekstów AGPL ani polskich nazw openGym. | Zmiana licencji całej aplikacji to decyzja właściciela, nie ta runda. Zapisane w raporcie jako opcja. |
| 3 | **Nie** bierzemy animacji Gym visual. Mięśnie pokazuje **własna mapa ciała** na konturach MuscleMap (MIT, commit `d53ddf4d`), a ruch — dotychczasowy goryl. | Media Gym visual wymagają własnej licencji (płatnej). Mapa z MuscleMap daje ten sam efekt „podświetlonych mięśni” co inne aplikacje i jest zgodna z licencją. |
| 4 | Polskie **nazwy** 1324 ćwiczeń tłumaczymy sami (glosariusz siłowni, spójny z nazwami z biblioteki). Instrukcje krok po kroku po polsku i angielsku — ze zbioru MIT. | Zbiór MIT nie ma polskich nazw; nazwy openGym są AGPL. |
| 5 | Dane katalogu: skrypt `npm run catalog:build` czyta przypiętą kopię zbioru i zapisuje `src/data/catalog/index.json` (nazwy, sprzęt, mięśnie) oraz `steps.pl.json` / `steps.en.json`. Ładowane leniwie (osobne kawałki JS), nie w głównym pakiecie. | 1,2 MB tekstu instrukcji nie może spowalniać startu. Język jest stały na załadowanie strony, więc pobiera się tylko jeden plik kroków. |
| 6 | Identyfikator ćwiczenia z katalogu: `kat-<id>` (np. `kat-0025`). Adres: `#/cwiczenia/kat-0025`. | Nie zderza się z identyfikatorami biblioteki; czytelny w adresie i w kopii zapasowej. |
| 7 | Mięśnie zbioru (21 celów, 39 pomocniczych nazw) mapujemy na **16 partii aplikacji** jedną tabelą (`catalog/muscles.ts`), barki rozbijane po nazwie (rear → tył, lateral → bok, reszta → przód). | Ta sama siatka, co „Mięśnie w tym tygodniu” i doradca — ćwiczenie z katalogu liczy się do serii tygodnia jak każde inne. |
| 8 | Ćwiczenie z katalogu **wchodzi do silnika dopiero po dodaniu do treningu** („adopcja”): definicja (nazwa pl/en, sprzęt, tryb, jednostka, cele, mięśnie, partia) zapisuje się w `state.catalog`, a progresja w `state.prog` jak dla każdego ćwiczenia. Przy starcie i imporcie definicje rejestrują się w `EX` / `EX_MUSCLES` / `ALL`. | 1324 pozycje w `state.prog` i w pętlach silnika na każdym starcie to koszt bez korzyści. Kopia zapasowa niesie definicje, więc trening z ćwiczeniem z katalogu odtwarza się na innym telefonie bez katalogu w pamięci. |
| 9 | Tryb i cele z katalogu: sprzęt z ciężarem → `grind` 3 × 8–12; masa ciała → `body` 3 × 6–15; rozciąganie / przytrzymanie / deska → `carry` w sekundach 3 × 20–60 s; cardio → sekundy. Ciężar startowy z dolnej części drabiny sprzętu. Partia ruchu z głównego mięśnia (np. czworogłowe → Przysiad, najszersze → Ciągnięcie). | Te same reguły progresji co dla biblioteki; pierwsze treningi i tak idą przez fazę próbną (`calib`), która ustawi poziom. |
| 10 | Sprzęt: sztangi, suwnica Smitha, sztanga łamana → `barbell`; hantle → `dumbbell`; kettlebell → `kettlebell`; wyciąg, maszyny, sanie, „assisted” → `machine`; gumy → `band`; reszta (masa ciała, piłki, wałek, skakanka, obciążenie dodatkowe) → `bodyweight`. | Sprzęt wybiera drabinę ciężaru; bez drabiny progresja idzie powtórzeniami. |
| 11 | Ćwiczenia katalogu, które są tym samym ruchem co ćwiczenie z biblioteki, dostają **bliźniaka** (`twins.ts`): strona katalogu odsyła do wersji z biblioteki (filmy, goryl, etapy), a wyszukiwarka pokazuje tylko wersję z biblioteki. Strona biblioteki pokazuje kroki z bliźniaka. | Dwa „Przysiady ze sztangą” z osobną progresją to pułapka. |
| 12 | **Mapa mięśni** na każdej stronie ćwiczenia (biblioteka i katalog), w sekcji „Pracujące mięśnie” **między „Tor ruchu” (goryl) a filmami**. Przód i tył, główne mięśnie w kolorze akcentu z delikatnym pulsowaniem, pomocnicze jaśniej, reszta szara. Pod rysunkiem lista nazw (czytnik ekranu dostaje listę, nie sam obraz). Pulsowanie wyłączone przy `prefers-reduced-motion`. | Prośba właściciela, miejsce wskazane wprost. Lista pod obrazem — rysunek nie jest jedynym nośnikiem informacji (jak w „Mięśnie w tym tygodniu”). |
| 13 | Sylwetka mapy idzie za postacią z ustawień (Gustaw → męska, Gosia → żeńska). | MuscleMap ma obie; drobny szczegół, który robi różnicę. |
| 14 | **„Technika” w treningu prowadzonym**: zamiast schowanego na dole `<details>` — wyraźny przycisk „Jak to zrobić?” tuż pod nazwą ćwiczenia (ikona, podpis „ruch, mięśnie, kroki”). Otwiera arkusz (dialog) z: gorylem w ruchu, mapą mięśni, „Na co uważać”, krokami z katalogu i odnośnikiem do pełnej strony z filmami. Ten sam przycisk w przerwie dla **następnego** ćwiczenia i w widoku listy. | Dotąd szare „Technika” na dole ekranu nie wyglądało na klikalne, a po rozwinięciu dawało jedno zdanie. Arkusz nie wyrzuca z treningu (zegar, przerwa i stan zostają), a przerwa to najlepszy moment, żeby zerknąć na następny ruch. |
| 15 | Atlas (`#/cwiczenia`) dostaje przełącznik „Biblioteka / Katalog 1300+”. Katalog: wyszukiwarka (polskie znaki dopasowane bez ogonków), filtr partii mięśniowej i sprzętu, lista z paginacją „pokaż więcej”. | 1324 wiersze naraz na telefonie to za dużo dla DOM i dla człowieka. |
| 16 | Wybór ćwiczenia w kreatorze treningu i w przekąskach przeszukuje też katalog (po bibliotece, z dopiskiem „katalog”). Wybranie ćwiczenia z katalogu adoptuje je. | Właściciel chce te ćwiczenia „w systemie” — czyli do użycia w treningu, nie tylko do czytania. |
| 17 | Źródła i licencje: strona ćwiczenia z katalogu podpisuje źródło (ExerciseDB / hasaneyldrm, MIT); pełne teksty licencji w `public/licenses/` i w README. | MIT wymaga zachowania noty. |
| 18 | Raport: `docs/research/opengym-vs-gym-tracker.md` + `.html`, po angielsku jak raport Fitatu. | Ten sam format co poprzednia analiza. |

## Poza zakresem / na później

- Licencja Gym visual (płatna) — gdyby właściciel ją kupił, animacje mogą wejść w miejsce/obok goryla.
- Teksty AGPL openGym (4308 ćwiczeń) — tylko po decyzji o licencji AGPL dla całej aplikacji.
- Aplikacja Sztab pokazuje ćwiczenia z katalogu pod identyfikatorem (nie zna definicji podopiecznego).
