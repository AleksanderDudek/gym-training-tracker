# Trener kettlebell

Aplikacja do prowadzenia treningu kettlebell z automatyczną progresją. Wybierasz trening, wpisujesz
wyniki, a silnik sam decyduje, kiedy podnieść powtórzenia i kiedy wejść na cięższy kettlebell.

React 18 + TypeScript + Vite. Bez backendu — dane leżą w przeglądarce, z eksportem i importem do pliku.

## Uruchomienie

```bash
npm install
npm run dev        # serwer deweloperski na http://localhost:5173
```

Pozostałe polecenia:

```bash
npm run build      # produkcyjny build do dist/
npm run preview    # podgląd builda
npm run typecheck  # tsc --noEmit
npm test           # testy silnika progresji (vitest)
```

Build jest w pełni statyczny (`base: './'`), więc `dist/` można wrzucić na dowolny hosting plików
albo otworzyć lokalnie.

## Struktura

```
src/
  types.ts                  wszystkie typy domenowe
  data/exercises.ts         biblioteka 19 ćwiczeń, etapy trudności, kolory kettlebli
  engine/
    math.ts                 wzór Epleya, tonaż, wskaźnik obciążenia w czasie
    plan.ts                 stan początkowy, recepta na dziś, mieszane obciążenie
    progression.ts          silnik: ocena sesji, awanse, przejścia, regres, przerwy
    hints.ts                teksty podpowiedzi i wyjaśnień
    progression.test.ts     17 testów silnika
  storage/storage.ts        zapis z kolejkowaniem, dwa środowiska
  components/
    ui.tsx                  modal, toast, kafelek ciężaru, przełącznik, wykres
    ExerciseCard.tsx        karta ćwiczenia z formularzem serii
    views.tsx               wybór treningu, sesja, poziomy, kreator, ustawienia
  App.tsx                   spina stan i widoki
  main.tsx                  punkt wejścia
  styles.css                arkusz stylów
```

Silnik jest w całości oddzielony od interfejsu. `engine/` nie importuje niczego z Reacta, funkcje
przyjmują stan i zwracają zmiany, więc dają się testować bez DOM-u. Funkcje mutujące (`applyResult`,
`applyLayoff`) działają na przekazanym obiekcie — `App.tsx` woła je zawsze na kopii stanu.

## Jak działa progresja

**Podwójna progresja.** Najpierw rosną powtórzenia w zakresie, dopiero potem ciężar. Metoda opisana
po raz pierwszy w 1911 roku przez Alana Calverta, wciąż standard.

**Zapas powtórzeń jako warunek awansu.** Cel zaliczony na styk, bez zapasu, nie podnosi poziomu.
Skala ma trzy stopnie, a nie dziesięć, bo metaanalizy oceny zapasu pokazują, że ludzie mylą się
średnio o jedno powtórzenie.

**Przejście ciężaru seria po serii.** Skok o jeden rozmiar kettlebell to 16–33% obciążenia,
wielokrotnie więcej niż typowy skok na sztandze. Cięższy bell wchodzi więc najpierw do jednej serii,
z każdą udaną sesją do kolejnej, aż zastąpi wszystkie.

**Powtórzenia po zmianie ciężaru** liczy odwrócony wzór Epleya (`1RM = ciężar × (1 + powt / 30)`).
Aplikacja szacuje maksimum z ostatnich serii, uwzględniając zadeklarowany zapas, i przelicza je na
nowy ciężar.

**Balistyka inaczej niż siła.** Swingi to ruch wybuchowy — progresują przez dokładanie serii (4→8),
a nie przez wyciskanie kolejnych powtórzeń z serii. Grindy odwrotnie.

**Obciążenie w czasie.** Stosunek tonażu z 7 dni do średniej tygodniowej z 28 dni. Zakres 0,8–1,3
uchodzi za bezpieczny, powyżej 1,5 wstrzymywane są skoki ciężaru. Wskaźnik bywa w literaturze
krytykowany, więc traktowany jest jako sygnał ostrzegawczy, nie wyrocznia.

**Przerwa w treningach.** Do 10 dni nic się nie dzieje. Od 11 do 20 wstrzymane są skoki ciężaru. Od
21 do 42 cofają się cele powtórzeń. Powyżej sześciu tygodni maksima schodzą o 10%, a ciężar spada
tylko tam, gdzie po korekcie nie da się utrzymać dolnej granicy zakresu. Progi są łagodne, bo
badania nad roztrenowaniem pokazują, że nawet po 12 tygodniach przerwy siła spada o 5–15%.

## Zapis danych

`storage/storage.ts` obsługuje dwa środowiska. Osadzone w artefakcie korzysta z `window.storage`,
uruchomione samodzielnie z `localStorage`. Warstwa próbuje po kolei i zgłasza awarię do interfejsu,
zamiast po cichu gubić dane. Zapisy idą jednym łańcuchem promisów, żeby równoległe wywołania nie
wyścigały się o klucz.

## Zastrzeżenie

Aplikacja nie zastępuje trenera ani fizjoterapeuty. Przy bólu, kontuzji lub chorobie skonsultuj plan
ze specjalistą.
# gym-training-tracker
