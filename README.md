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
npm test           # 139 testów silnika i tras (vitest)
```

Build jest w pełni statyczny (`base: './'`), więc `dist/` można wrzucić na dowolny hosting plików
albo otworzyć lokalnie.

## Zakładki

| Zakładka | Adres | Co robi |
| --- | --- | --- |
| Trening | `#/trening` | Wybór treningu i prowadzenie sesji. |
| Plan | `#/plan` | Kalendarz terminów, punkty, stopień, dziennik zdarzeń. |
| Poziomy | `#/poziomy` | Wskaźnik obciążenia, poziomy ćwiczeń, historia sesji. |
| Osiągnięcia | `#/osiagniecia` | Dorobek w liczbach i odznaki z progami. |
| Treningi | `#/treningi` | Własne zestawy ćwiczeń. |
| Atlas | `#/cwiczenia` | Opisy ćwiczeń i filmy; każde ma własny adres do wysłania. |
| Ustawienia | `#/ustawienia` | Dostępne kettlebelle, eksport, import, kasowanie danych. |

Osiągnięcia mają własną zakładkę, bo liczą się z całej historii, a nie z kalendarza planu —
i mają być widoczne również wtedy, gdy żaden plan nie jest uruchomiony.

## Struktura

```
src/
  types.ts                  wszystkie typy domenowe
  routing.ts                trasy w hashu adresu, siedem zakładek
  routing.test.ts           7 testów tras i zakładek
  data/exercises.ts         biblioteka 19 ćwiczeń, cztery treningi, kolory kettlebli
  data/videos.ts            filmy instruktażowe, 4 na ćwiczenie
  data/plans.ts             katalog 54 planów: poziom × płeć × częstotliwość
  engine/
    math.ts                 wzór Epleya, tonaż, wskaźnik obciążenia w czasie
    plan.ts                 stan początkowy, recepta na dziś, mieszane obciążenie
    progression.ts          silnik: ocena sesji, awanse, przejścia, regres, przerwy
    hints.ts                teksty podpowiedzi i wyjaśnień
    schedule.ts             rozpisanie planu na daty, przypisanie sesji do terminów, rotacja
    score.ts                punkty, premie za serię, stopnie
    metrics.ts              sumy, rekordy z okna czasu, miary utrzymania poziomu
    badges.ts               katalog odznak z progami, postęp, migracja starych kluczy
    journal.ts              dziennik zdarzeń wyprowadzany z kalendarza
    advice.ts               podpowiedzi: nadrobienie, przerwa, zmiana częstotliwości
    snapshot.ts             jedno wyliczenie stanu planu na dziś
    progression.test.ts     40 testów silnika progresji
    schedule.test.ts        30 testów kalendarza, przypisania i rotacji
    score.test.ts           15 testów punktacji i dziennika
    badges.test.ts          19 testów odznak, dorobku i podpowiedzi
    metrics.test.ts         28 testów warstwy liczb
  storage/storage.ts        zapis z kolejkowaniem, dwa środowiska
  components/
    ui.tsx                  modal, toast, kafelek ciężaru, przełącznik, wykres
    ExerciseCard.tsx        karta ćwiczenia z formularzem serii
    views.tsx               wybór treningu, sesja, poziomy, kreator, ustawienia
    atlas.tsx               spis ćwiczeń i podstrona pojedynczego ćwiczenia
    PlanView.tsx            katalog planów, kalendarz, punkty i dziennik
    Achievements.tsx        zakładka osiągnięć: dorobek w liczbach i odznaki z progami
    VideoEmbed.tsx          odtwarzacz YouTube ładowany dopiero po kliknięciu
  App.tsx                   spina stan i widoki
  main.tsx                  punkt wejścia
  styles.css                arkusz stylów
```

Silnik jest w całości oddzielony od interfejsu. `engine/` nie importuje niczego z Reacta, funkcje
przyjmują stan i zwracają zmiany, więc dają się testować bez DOM-u. Funkcje mutujące (`applyResult`,
`applyLayoff`) działają na przekazanym obiekcie — `App.tsx` woła je zawsze na kopii stanu.

## Atlas ćwiczeń i wideo

Każde z 19 ćwiczeń ma własną podstronę pod adresem `#/cwiczenia/<id>` — z kadrem techniki,
etapami trudności i filmami w dwóch listach: pięć najpopularniejszych nagrań techniki, a pod
nimi ten sam ruch w wariancie z kettlebell. Wejście prowadzi z zakładki „Atlas” albo z linku
w rozwiniętej karcie ćwiczenia podczas treningu.

**Trasy siedzą w części hash adresu.** GitHub Pages serwuje wyłącznie pliki statyczne, więc
ścieżka `/cwiczenia/swing2` wróciłaby jako 404. Hash nie trafia na serwer: jeden `index.html`
obsługuje każdą podstronę, ścieżka dokumentu zostaje ta sama, a względne adresy zasobów
(`base: './'`) dalej się rozwiązują. Przycisk „wstecz” działa bez dodatkowego kodu.

**Lista filmów nie jest pisana z pamięci.** Powstała z wyników wyszukiwania YouTube:
kandydaci są odsiewani po długości i tytule, oceniani liczbą wyświetleń razem z pozycją
w wynikach, ograniczani do jednego filmu na kanał, a każdy identyfikator sprawdzono przez
oEmbed i stronę osadzania, żeby nie trafił tam film usunięty, prywatny albo z wyłączonym
osadzaniem. Aplikacja jest po polsku, więc do dwóch miejsc na ćwiczenie rezerwowane jest na
nagrania polskie — resztę zajmują najmocniejsze angielskie. Karta ma znacznik języka.

**Do listy z kettlebell wchodzą tylko filmy, które nazywają odważnik** w tytule albo w nazwie
kanału, trafiają w sam ruch i przekraczają próg oglądalności — inaczej sekcja zapełniłaby się
wyczynami pokroju „podciąganie +49 kg” i treningami z serii „Day 244”. Trafność sprawdzana jest
jeszcze raz na tytule z oEmbed, bo wyszukiwarka bywa zwraca tytuł automatycznie przetłumaczony
i filtr działający na wynikach widzi inny tekst niż ten, który staje na karcie. Gdy po tym
odsiewie zostają mniej niż trzy filmy, sekcji nie ma wcale — dla podciągania i dipów wariant
z kettlebell nie istnieje jako materiał instruktażowy i lepiej nie udawać, że jest.

**Odtwarzacz wchodzi dopiero po kliknięciu.** Cztery osadzone ramki na stronę ściągałyby
megabajt skryptów i ustawiały ciasteczka, zanim ktokolwiek naciśnie play, więc do tego
czasu stoi tam sama miniatura. Adres `youtube-nocookie.com` odkłada śledzenie do momentu
odtworzenia, a zwykły link do YouTube pod spodem działa nawet wtedy, gdy autor skasuje film.

## Plan treningowy

Zakładka „Plan" rozpisuje dwanaście tygodni na konkretne daty i pilnuje terminów także wtedy,
gdy trening się nie odbył. Dzień startu i dni tygodnia wybiera użytkownik — to jedyne dwie
rzeczy, których żaden algorytm nie zgadnie za człowieka.

**Katalog ma 54 warianty**, generowane z reguł, nie pisane ręcznie: trzy poziomy (od zera,
podstawowy, zaawansowany) × trzy warianty płci × sześć częstotliwości (2–7 treningów w tygodniu).

**Dni tygodnia dobrane pod maksymalny odstęp.** Dwa treningi to poniedziałek i czwartek, czyli
przerwy 2 i 3 dni, a nie 1 i 6. Domyślny układ da się nadpisać własnym wyborem dni.

**Im częściej, tym więcej dni lekkich.** Trening D nie jest „tym samym, tylko słabiej" — po prostu
nie ma w nim ciężkiego zawiasu, przysiadu ani wyciskania. Przy dwóch treningach w tygodniu nie
występuje wcale, przy siedmiu zajmuje cztery dni z siedmiu.

**Płeć przestawia wyłącznie ciężary startowe.** Program, rotacja treningów i zasady progresji są
identyczne. Start planu ustawia ciężary tylko w ćwiczeniach bez historii: gdzie jest już
zalogowany wynik, tam zmierzony poziom bije każdą tabelkę.

## Terminy, nie tylko treningi

Kalendarz nie jest listą życzeń — jest listą terminów, z których każdy kiedyś się rozstrzyga.

**Przypisanie sesji do terminu.** Trening z danego dnia domyka najpierw termin z tą samą datą,
potem najstarszy zaległy w oknie łaski, a na końcu termin jutrzejszy (ktoś zrobił swoje dzień
wcześniej). Jeśli nic nie pasuje, sesja liczy się jako dodatkowa. Jedna sesja domyka jeden termin.

**Okno łaski to trzy dni.** Termin po czasie ma status „do nadrobienia", nie „opuszczony" —
dopiero czwartego dnia przepada i wchodzi do statystyk jako pudło. Krócej byłoby okrutne wobec
kogoś, kto raz w tygodniu ma dyżur; dłużej zamieniłoby plan w listę życzeń bez terminów.

**Opuszczony termin nie zjada treningu.** Wskaźnik rotacji przesuwa się dopiero po terminie
zamkniętym albo ostatecznie przepadłym: opuszczony poniedziałek z treningiem A oddaje ten trening
najbliższej środzie. Bez tego rotacja gubiłaby wzorce ruchowe dokładnie u osób, które i tak
trenują nieregularnie. Do wyboru jest też stare zachowanie („trening przepada"), gdzie rotacja
idzie sztywno z kalendarzem.

**Ręczne odhaczenie.** Trening zrobiony poza aplikacją domyka termin jednym kliknięciem — silnik
mierzy regularność, a nie to, gdzie ktoś wpisał powtórzenia.

**Dziennik.** Każdy termin zostawia ślad, także ten, w którym nic się nie wydarzyło. Wpisy o
terminach wyprowadzane są z kalendarza przy każdym otwarciu, a nie dopisywane w chwili zdarzenia
— dzięki temu dzień, w którym aplikacja była zamknięta, i tak trafia do dziennika jako opuszczony.
Trwale zapisane są tylko zdarzenia nie do odtworzenia: start i koniec planu, zmiana wariantu,
zdobyte odznaki.

## Punkty i odznaki

Punktacja nagradza obecność w terminie, nie tonaż. Ciężar rozlicza silnik progresji, a punkty za
kilogramy popychałyby do przeciążenia dokładnie wtedy, gdy trzeba odpuścić.

| Zdarzenie | Punkty |
| --- | --- |
| Termin zrobiony co do dnia | 100 |
| Nadrobiony 1 / 2 / 3 dni po terminie | 70 / 45 / 25 |
| Trening poza planem | 20 |
| Każdy kolejny termin w terminie | +10 za sesję, do +100 |
| Tydzień planu bez opuszczonego terminu | 150 |
| Termin opuszczony | 0 |

**Nie ma punktów ujemnych.** Karą za opuszczony termin jest zerwana seria i zatrzymany licznik, a
nie dług do odrobienia — wychodzenie z minusa zniechęca skuteczniej niż cokolwiek innego.

**Osiem stopni**, od Nowicjusza po Mistrza. Pierwszy awans wypada po niecałym tygodniu regularnych
treningów, żeby pierwsza nagroda nie była odległa o miesiąc.

**Odznaki mają progi, nie jeden koniec.** Rodzina „Powtórzenia" ma sześć progów od 500 do
100 000, „Utrzymany rytm" pięć od czterech tygodni do roku. Zdobyty próg nie kończy tematu, tylko
odsłania następny — a pasek postępu mówi, ile brakuje. Zamiast ściany „zablokowane" jest zawsze
widoczny kolejny krok. Wszystko mieszka w zakładce **Osiągnięcia**, razem z sumami dorobku.

Cztery grupy:

- **Dorobek** — sumy z całej historii: treningi, powtórzenia, serie, wykonane ćwiczenia, tonaż,
  czas pod obciążeniem, liczba poznanych ruchów.
- **Szczyty** — rekord z przesuwanego okna: najlepszy dzień, siedem, czternaście, dwadzieścia
  jeden, trzydzieści i dziewięćdziesiąt dni. „Najlepszy miesiąc" znaczy dowolne trzydzieści dni
  z rzędu, a nie miesiąc z kalendarza — okno przesuwa się po datach, nie po kartkach.
- **Utrzymanie** — to, że nic się nie osypało: tygodnie z rzędu po dwa treningi, dni bez zejścia
  z ciężaru, ćwiczenia stojące w granicach 5% własnego szczytu, powrót do poziomu po przerwie.
- **Terminy** — zależne od uruchomionego planu: seria w terminie, brak pudła, czyste tygodnie,
  nadrobienia.

Wszystkie da się zdobyć przy dowolnym ciężarze — bo jedyne, na co człowiek ma realny wpływ
każdego dnia, to czy się pojawi. Raz zdobyty próg zostaje po zmianie planu, tak samo jak punkty:
przy zamknięciu planu przechodzą do trwałego dorobku.

**Odznaki nie dają punktów.** Punkty pilnują terminów, odznaki nagradzają dorobek — gdyby objętość
płaciła punktami, ranga rosłaby najszybciej tuż przed kontuzją.

**Liczenie jest osobne od nagradzania.** `metrics.ts` liczy wszystko z historii treningów raz,
a warunek odznaki mieści się w jednej linijce porównania z progiem. Powtórzenia ćwiczeń na stronę
liczą się dwa razy, sekundy spacerów farmera nie mieszają się z powtórzeniami, a tonaż dorobku
liczy kilogramy razy powtórzenia — inaczej niż tonaż z `math.ts`, gdzie sekundy wchodzą do wzoru,
bo na tamtej liczbie skalibrowany jest wskaźnik przeciążenia.

**Ekran treningu podaje cenę zwłoki.** „Dziś do wzięcia 180 pkt" obok „nadrobienie jutro: 70 pkt"
działa lepiej niż jakiekolwiek napomnienie.

## Inteligentne ustawianie kolejnego treningu

Silnik patrzy na regularność, nie na wyniki — częstotliwość, którą ktoś realnie utrzymuje, jest
warta więcej niż ta, którą kiedyś wybrał w katalogu.

- **Termin dzisiaj** — zachęta i pełna stawka punktów.
- **Termin zaległy w oknie łaski** — karta nadrobienia z liczbą dni, które zostały.
- **Dzień wolny** — informacja, ile czekać, i przypomnienie, że przerwa też pracuje.
- **Realizacja poniżej 60% przy co najmniej sześciu terminach** — propozycja rzadszego wariantu,
  jednym przyciskiem. Punkty przechodzą do dorobku, poziomy ćwiczeń zostają.
- **Realizacja od 95% przy co najmniej ośmiu terminach** — propozycja gęstszego wariantu.
- **Przerwa od 11 dni** — ostrzeżenie przed ciężkim wejściem; skoki ciężaru i tak są wstrzymane.

**Przerwy.** Plan pokazuje swoją najdłuższą zaplanowaną przerwę i zestawia ją z progami silnika:
do 10 dni nic się nie dzieje, od 11 wstrzymane są skoki ciężaru, od 21 cofają się cele.

## Jak działa progresja

**Poziom bierze się z pomiaru, nie z tabelki.** Każde ćwiczenie zaczyna w fazie próbnej: jedna
seria na połowie domyślnego obciążenia, tyle powtórzeń, ile wychodzi z zapasem. Od dna listy próba
nie startuje, bo przy 4 kg ogranicznikiem przestaje być siła, a zaczyna cierpliwość — wynik nic
wtedy nie mierzy. Lista ciężarów zaczyna się za to od 4 i 6 kg po to, żeby początkujący, dla
którego 8 kg to za dużo, miał dokąd zejść; wcześniej drabina nie miała stopni w dół. Duża nadwyżka
przeskakuje więcej niż jeden rozmiar naraz. Wynik powyżej zakresu
przenosi próbę na cięższy, poniżej — na lżejszy, a w zakresie staje się celem startowym. Drabina
domyka się najwyżej po czterech próbach. Balistyka kalibruje się oceną wysiłku, nie serią na maksa,
bo swing na wyczerpanie przestaje być ruchem o prędkość. Ćwiczenia z masą ciała przesuwają etap
trudności zamiast ciężaru.

**Nadwyżka nad celem nie idzie do kosza.** Wynik wyższy od celu podnosi cel od razu do tego wyniku.
Wcześniej komplet dawał +1 powtórzenie niezależnie od tego, czy ktoś zrobił dokładnie tyle, ile
trzeba, czy dwa razy tyle — dojście do własnego poziomu zajmowało kilkanaście sesji.

**Test kontrolny.** Co sześć sesji, a po dwóch sesjach z rzędu na „Łatwo" wcześniej, ostatnia seria
traci sufit. Wynik przestawia poziom od razu tam, gdzie powinien być. Test nie wchodzi w trakcie
przejścia na cięższy kettlebell, bo obraz zmienia się tam i tak co sesję.

**Szacowane maksimum nie liczy się z serii próbnej.** Kilkanaście powtórzeń na najlżejszym
kettlebellu daje wzorem Epleya liczbę bez sensu — ogranicznikiem jest tam wytrzymałość, nie siła —
a wygładzanie przeniosłoby ten błąd na kolejne sesje. Maksimum powstaje raz, z ustalonego poziomu.
Przepisane powtórzenia po skoku ciężaru mają dodatkowo podłogę z połowy dolnej granicy zakresu,
żeby żadne zaniżone oszacowanie nie kazało robić jednej powtórki.

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

## Publikacja

Aplikacja stoi na GitHub Pages: <https://aleksanderdudek.github.io/gym-training-tracker/>

Wdrożenie prowadzi `.github/workflows/deploy.yml` — każdy push na `main` uruchamia
`typecheck`, testy i build, a dopiero potem publikuje `dist/`. Nieprzechodzące testy
zatrzymują wdrożenie.

## Zapis danych

`storage/storage.ts` obsługuje dwa środowiska. Osadzone w artefakcie korzysta z `window.storage`,
uruchomione samodzielnie z `localStorage`. Warstwa próbuje po kolei i zgłasza awarię do interfejsu,
zamiast po cichu gubić dane. Zapisy idą jednym łańcuchem promisów, żeby równoległe wywołania nie
wyścigały się o klucz.

Stan planu jest **wyprowadzany, nie zapamiętany**: kalendarz, realizacja, serie, punkty i warunki
odznak liczą się od zera z historii treningów przy każdym otwarciu. Zapisywane jest tylko to,
czego nie da się odtworzyć — dorobek punktowy z planów zamkniętych, daty zdobycia odznak i
zdarzenia jednorazowe. Dzięki temu żaden licznik nie może rozjechać się z historią po imporcie
danych ani po zmianie dni tygodnia.

## Zastrzeżenie

Aplikacja nie zastępuje trenera ani fizjoterapeuty. Przy bólu, kontuzji lub chorobie skonsultuj plan
ze specjalistą.

