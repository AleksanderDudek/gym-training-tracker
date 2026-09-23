# GYM TRACKER

Aplikacja do prowadzenia treningu siłowego z automatyczną progresją. Wybierasz trening, wpisujesz
wyniki, a silnik sam decyduje, kiedy podnieść powtórzenia i kiedy wejść na cięższe obciążenie.
Atlas obejmuje 105 ćwiczeń: kettlebell, sztanga, hantle, maszyny i kalistenika.

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
npm test           # 231 testów silnika, biblioteki, odznak, ruchu, tonu i tras (vitest)
```

Build jest w pełni statyczny (`base: './'`), więc `dist/` można wrzucić na dowolny hosting plików
albo otworzyć lokalnie.

## Ton

Aplikacja żartuje, ale nie wszędzie. `engine/quips.ts` pilnuje trzech zasad:

**Żart nigdy nie stoi tam, gdzie człowiek szuka informacji.** Cele serii, ciężary, terminy,
opisy odznak i ostrzeżenia o przeciążeniu zostają suche. Puenta idzie obok, we własnym
rejestrze typograficznym — inny kolor, inny krój — żeby nikt nie pomylił dowcipu z danymi.
Ostrzeżenia o bólu, kontuzji i skoku obciążenia nie żartują nigdy i nie mają wariantów.

**Nigdy kosztem użytkownika.** Opuszczony termin kwitowany jest łagodnie („Kalendarz się nie
obraził. Czeka."), bo wstyd jeszcze nikogo nie wzmocnił. Śmiejemy się z siłowni, z liczb
i z samej aplikacji. Test sprawdza, że w tekstach nie ma słów, którymi da się komuś dokopać.

**Ten sam żart dwa razy przestaje być żartem.** Teksty losowane są ziarnem — tym samym
w obrębie jednego ekranu, innym przy kolejnym treningu. Losowanie przy każdym renderze
migałoby tekstem w trakcie czytania.

**Liczby przekładane na rzeczy.** Tonaż i powtórzenia zamieniają się w przedmioty o znanej
masie i w czas: „w sumie 2 czołgi", „po jednym na sekundę zajęłoby to 1 godzinę i 45 minut".
Jednostka nie jest największą, która się mieści — „1,2 hipopotama" jest prawdziwe i martwe,
a „3 maluchy" widać od razu — tylko tą, przy której liczba wypada najbliżej kilku sztuk.
Liczba zawsze wychodzi całkowita, bo ułamek wymusiłby w polszczyźnie czwartą formę odmiany
dla każdej jednostki.

**Każde ćwiczenie i każdy trening ma dopisek.** Sto pięć komentarzy z szatni, po jednym na
ruch, i po jednym na gotowy zestaw. Stoją obok wskazówki technicznej, nigdy zamiast niej:
`hint` mówi, co zrobić, żeby się nie połamać, dopisek mówi, jak to wygląda z boku.

**Sylwetka się poci.** W najtrudniejszym momencie ruchu manekinowi lecą kropelki — nie niosą
informacji i o to chodzi: figurka, która wyraźnie się męczy, jest zabawniejsza i przy okazji
pokazuje, gdzie wysiłek jest największy. Przy `prefers-reduced-motion` znikają.

**Stopnie opisują karierę, nie mięśnie**: od „Gościa z ulicy" po „Pomnik za życia". Awans
zależy od frekwencji, więc i nazwa mówi o tym, jak często cię tam widują.

**Karty do wpisu są dokumentami wydanymi przez urząd, który nie istnieje.** Odznaka dostaje
„ŚWIADECTWO POCIĘŻAROWE" z medalem, cały dorobek — „LEGITYMACJĘ SIŁOWĄ" z rysowaną sylwetką.
Obie mają podwójną ramkę, zawijasy w narożnikach, sentencję zamiast łacińskiej dewizy
(„PER ASPERA AD ZAKWASY"), numer wydania „bez trybu odwoławczego" liczony z treści, odręczny
podpis urzędu, który nie istnieje („Główny Inspektor Zakwasów"), i przechyloną pieczęć
(„POTWIERDZONE — nikt nie sprawdzał"). Powaga formy przy błahości treści jest tu całym żartem.

Blankiet dopasowuje się do treści: przy dwuwierszowym tytule i długiej puencie medal się
kurczy, a poniżej progu znika całkiem. Podpis idzie pod treść, nie na sztywno — inaczej
zawijas lądował w poprzek zdania.

**Medale pokazują ludzika.** Odznaki o ruchu — powtórzenia, serie, tonaż, partie ciała —
noszą tę samą faceless sylwetkę, co manekin w atlasie, zmniejszoną do środka sześciokąta
i zatrzymaną w charakterystycznej klatce: wykrok, zawias, deska, pompka. Symbol trzeba
rozszyfrować, sylwetkę widać od razu. Rodziny kalendarzowe zostają przy znakach, a okna
czasu przy liczbach — tam informacja jest ważniejsza od żartu. Pozy dobrane są szerokie:
postać na baczność w dwudziestu siedmiu pikselach czyta się jak kreska.

Sylwetka na legitymacji rysowana jest wprost na płótnie z tego samego silnika póz, co manekin
w atlasie — kopiowanie jego SVG nic by nie dało, bo kolory kresek siedzą w arkuszu strony,
a samodzielny obrazek nie ma do niego dostępu. Skala liczona jest z obwiedni postaci, nie
z rozmiaru sceny: scena ma 160 na 150 jednostek, a człowiek zajmuje z niej ćwiartkę.

## Wprowadzenie, udostępnianie i wsparcie

**Wprowadzenie** wchodzi samo tylko przy pierwszym uruchomieniu i nigdy w trakcie sesji.
Cztery ekrany, bo piąty nikt nie czyta; „Pomiń” stoi na każdym z nich, a nie pod krzyżykiem
w rogu — wprowadzenie, którego nie da się wyminąć, jest bramką, nie pomocą. Ostatni ekran
mówi wprost, że aplikacja jest bezpłatna, i podaje jedną konkretną akcję dla tych, którzy
chcą się odwdzięczyć. Da się je otworzyć ponownie z Ustawień.

**Udostępnianie** siedzi w podsumowaniu po zamkniętej sesji i w oknie zdobytej odznaki.
Wysyłka idzie przez systemowy arkusz (`navigator.share`), bo to on zna aplikacje
zainstalowane na telefonie — własna lista przycisków zawsze będzie niepełna. Gdy arkusza
nie ma, treść ląduje w schowku i pokazują się bezpośrednie adresy do X, Facebooka
i WhatsAppa oraz pobranie obrazka.

Do wpisu składa się **kwadratowa karta 1080 × 1080**: medal w tworzywie, nazwa odznaki,
liczby i adres aplikacji. Kwadrat, bo mieści się bez przycięcia wszędzie tam, gdzie
prostokąt bywa kadrowany inaczej, niż autor zakładał. Karta powstaje na płótnie dopiero
po kliknięciu, a medal wjeżdża w nią jako kopia żywego rysunku ze strony — razem
z gradientami, które inaczej zostałyby w osobnym bloku `defs`. Adres stoi w osobnej,
ostatniej linii wpisu, bo serwisy robią podgląd z ostatniego adresu, a wtrącony w zdanie
bywa ucinany.

**Wsparcie** jest widoczne z każdego ekranu — kubek w nagłówku, obok ustawień — i ma cztery
stałe miejsca poza nim: podsumowanie po zamkniętej sesji, koniec wprowadzenia, dół zakładki
Osiągnięcia i Ustawienia. Zasady bez zmian: nigdy nie blokuje drogi, nigdy nie pojawia się
w trakcie treningu, nigdy nie prosi dwa razy pod rząd. Teksty rotują („Aplikacja jest
bezpłatna. Kawa autora już nie."), więc ten sam komunikat nie wisi w kółko.

**Dorobek udostępnisz w każdej chwili** — przycisk „Udostępnij dorobek" w zakładce Osiągnięcia
i drugi, obok wyniku sesji, po każdym zamkniętym treningu.

## Zakładki

| Zakładka | Adres | Co robi |
| --- | --- | --- |
| Twoja sesja | `#/sesja` | Co masz dziś do zrobienia według planu; w trakcie — bieżąca sesja. |
| Plan | `#/plan` | Kalendarz terminów, punkty, stopień, dziennik zdarzeń. |
| Poziomy | `#/poziomy` | Wskaźnik obciążenia, poziomy ćwiczeń, historia sesji. |
| Osiągnięcia | `#/osiagniecia` | Dorobek w liczbach, progi najbliższe zdobycia, 56 rodzin odznak. |
| Treningi | `#/treningi` | Wszystkie treningi do wyboru i kreator własnych. |
| Atlas | `#/cwiczenia` | 105 ćwiczeń z filtrem sprzętu; każde ma własny adres do wysłania. |

Ustawienia (`#/ustawienia`) mają przycisk w nagłówku, nie w dolnym pasku: drabina kettlebli,
poziomy startowe, eksport, import i kasowanie danych to ekran otwierany raz na miesiąc.

Osiągnięcia mają własną zakładkę, bo liczą się z całej historii, a nie z kalendarza planu —
i mają być widoczne również wtedy, gdy żaden plan nie jest uruchomiony.

**Zakładka „Twoja sesja” odpowiada na jedno pytanie: co robię dzisiaj.** Gdy plan ma termin —
pokazuje ten jeden trening i przycisk startu. Gdy terminu nie ma — mówi, kiedy wypada następny.
Gdy sesja już trwa — pokazuje ją. Lista wszystkich treningów mieszka w zakładce „Treningi”,
bo ekran z ośmioma równorzędnymi przyciskami nie podpowiada niczego.

Stary adres `#/trening` dalej działa — zapisane linki i zakładki przeglądarki nie przestają
prowadzić tam, gdzie prowadziły.

## Nawigacja i cele dotykowe

**Sześć zakładek, nie siedem.** Przy siedmiu na ekranie 320 px na pozycję wypadało 45 px
wysokości i 42 px szerokości, a etykiety trzeba było ścisnąć do 9,5 px — poniżej minimum
44 px z wytycznych Apple, 48 dp z Material Design i poniżej czytelności każdej znanej
podziałki typograficznej. Ustawienia zeszły do przycisku w nagłówku, bo dolny pasek jest od
miejsc odwiedzanych codziennie, a nie od ekranu otwieranego raz na miesiąc.

**Ikona nad etykietą.** Pozwala trzymać tekst na 10,5–11 px zamiast 9,5 px i daje drugi,
szybszy do rozpoznania znacznik niż samo słowo. Ikony są rysowane inline, jedną siatką 24×24
i jedną grubością linii — bez zewnętrznych zasobów i bez zależności.

Po zmianie każda zakładka ma **53 × 56 px** przy szerokości ekranu 320 px, a stan aktywny
niesie trzy sygnały naraz: pasek nad pozycją, kolor i pogrubienie.

**Cele dotykowe w całej aplikacji** przeszły przez ten sam próg 44 px: przyciski, rozwijacze,
przełączniki, filtry sprzętu, odhaczanie terminu w kalendarzu i odnośniki tekstowe. Kółko
odhaczenia ma dalej 24 px średnicy, ale obszar kliknięcia 44 px — inaczej domknięcie terminu
było loterią. Audyt w przeglądarce na siedmiu ekranach nie znajduje już ani jednego celu
poniżej progu.

## Atlas i sprzęt

Biblioteka ma **105 ćwiczeń** w siedmiu partiach ruchu: zawias biodrowy, przysiad, ciągnięcie,
pchanie, całe ciało, core i carry, nogi dodatkowo. Obok pierwotnych dziewiętnastu ćwiczeń
kettlebellowych stoją teraz sztanga, hantle, maszyny i kalistenika. Atlas filtruje się po sprzęcie.

**Każdy sprzęt ma własną drabinę ciężaru.** Sztanga zaczyna od gryfu i idzie skokiem talerzy,
kettlebell skacze co 4 kg, stos maszyny co 5, hantle co 2 kg do dwudziestki. Jedna wspólna lista
proponowałaby obciążenia, których nie da się nałożyć — 60 kg nie mieści się w drabinie kettlebli,
a 4 kg nie istnieje na sztandze. Progresja dobiera ciężar wyłącznie z drabiny właściwej dla
ćwiczenia; edytowalna w Ustawieniach jest drabina kettlebli, reszta ma wartości domyślne.

**Identyfikatory pierwszej biblioteki są nietknięte.** Gotowe treningi, plany i zapisane postępy
stoją na nich, więc test pilnuje, żeby żaden nie zniknął przy kolejnym rozszerzeniu atlasu.

## Tor ruchu — manekin zamiast nagrań

Każde ćwiczenie z przypisanym wzorcem ruchu ma w atlasie animowaną sylwetkę: bez twarzy,
bez płci, rysowaną w przeglądarce z kątów stawów. **Nic tu nie pochodzi z cudzych nagrań,
bibliotek ruchu ani sklepów z modelami** — nie ma czyjegoś prawa autorskiego do pilnowania,
licencji do odnawiania, reklam przed odtworzeniem ani zapytań na zewnątrz. Podstrona
ćwiczenia po wejściu nie odpytuje żadnego obcego serwera; filmy z YouTube wchodzą dopiero
po kliknięciu, bo same miniatury ściągają się z serwerów Google w chwili, gdy trafią
do dokumentu.

**Jak to działa.** `engine/pose.ts` liczy punkty stawów z kątów bezwzględnych (0 to pion
w górę, wartości rosną zgodnie z ruchem wskazówek zegara). `data/moves.ts` trzyma
osiemnaście wzorców ruchu jako po kilka klatek kluczowych; między klatkami idzie
interpolacja z wygładzonym tempem, więc powtórzenie zwalnia na krańcach zakresu tak jak
prawdziwe. Sylwetka dosuwa się sama do podłoża — najniższy punkt ciała ląduje na linii
ziemi — dzięki czemu autor pozy nie liczy wysokości bioder, a przysiad nie wisi
w powietrzu. Cały katalog animacji waży kilka kilobajtów liczb.

Jeden wzorzec obsługuje całą rodzinę ćwiczeń: przysiad ze sztangą, goblet i hack squat
różnią się trzymanym sprzętem, nie torem ruchu. Sprzęt dorysowuje się osobno z pola `gear`,
więc ten sam przysiad dostaje gryf, kettlebell albo nic.

Animacja startuje sama, da się ją zatrzymać i przewinąć suwakiem klatka po klatce.
Przy `prefers-reduced-motion` nie rusza się wcale — zostaje nieruchoma klatka z momentu,
który uczy najwięcej. Opis toru ruchu jest zapisany w `aria-label`, więc czytnik ekranu
dostaje zdanie zamiast grafiki.

**Czego to nie zastępuje.** Sylwetka pokazuje tor ruchu i tempo, nie ustawienie łopatek
ani oddech. Filmy zostają na miejscu dla tych, którzy chcą zobaczyć żywego człowieka.

## Ćwiczenia na czas

Ćwiczenie mierzone w sekundach mówi to wprost — na karcie, w celu (`3 × 30 s`) i przy polu wyniku.
Ćwiczenia na powtórzenia dostają ten sam znacznik (`3 × 8 powt.`), bo „3 × 30” przy spacerze
farmera i przy swingach znaczy dwie zupełnie różne rzeczy.

W sesji każda seria na czas dostaje licznik:

- **próba i test kontrolny** — stoper liczący w górę, bo pytanie brzmi „ile wytrzymasz”;
- **seria z wyznaczonym czasem** — odliczanie w dół od przepisanego czasu, z paskiem postępu.

Odliczanie zatrzymuje się samo na zerze i wpisuje wynik do formularza; stoper wpisuje go po
zatrzymaniu. Czas liczy się z różnicy znaczników czasu, a nie z liczby tyknięć — karta w tle
dostaje rzadsze `setInterval`, więc licznik oparty na tyknięciach zostawałby w tyle.

## Struktura

```
src/
  types.ts                  wszystkie typy domenowe
  routing.ts                trasy w hashu adresu, siedem zakładek
  routing.test.ts           7 testów tras i zakładek
  data/exercises.ts         biblioteka 105 ćwiczeń, drabiny sprzętu, cztery treningi
  data/exjokes.ts           dopiski do 105 ćwiczeń i do gotowych treningów
  data/moves.ts             osiemnaście wzorców ruchu jako klatki kluczowe
  data/anim.ts              przypisanie ćwiczeń do wzorców
  data/exercises.test.ts    14 testów spójności biblioteki i drabin
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
    pose.ts                 szkielet manekina: kąty, klatki, dosunięcie do podłoża
    share.ts                treść wpisu, karta 1080×1080, wysyłka i ścieżka zapasowa
    share.test.ts           11 testów treści wpisu, adresów i wprowadzenia
    quips.ts                humor: porównania liczb, odmiana, zestawy tekstów
    quips.test.ts           19 testów puent, odmiany, dopisków i granic porównań
    pose.test.ts            19 testów szkieletu, cyklu i katalogu ruchów
    badges.ts               katalog odznak z progami, postęp, migracja starych kluczy
    journal.ts              dziennik zdarzeń wyprowadzany z kalendarza
    advice.ts               podpowiedzi: nadrobienie, przerwa, zmiana częstotliwości
    snapshot.ts             jedno wyliczenie stanu planu na dziś
    progression.test.ts     40 testów silnika progresji
    schedule.test.ts        30 testów kalendarza, przypisania i rotacji
    score.test.ts           15 testów punktacji i dziennika
    badges.test.ts          23 testy odznak, dorobku i podpowiedzi
    metrics.test.ts         40 testów warstwy liczb
  storage/storage.ts        zapis z kolejkowaniem, dwa środowiska
  components/
    ui.tsx                  modal, toast, kafelek ciężaru, przełącznik, wykres
    ExerciseCard.tsx        karta ćwiczenia z formularzem serii
    views.tsx               wybór treningu, sesja, poziomy, kreator, ustawienia
    atlas.tsx               spis ćwiczeń i podstrona pojedynczego ćwiczenia
    PlanView.tsx            katalog planów, kalendarz, punkty i dziennik
    SessionHome.tsx         ekran „co robię dzisiaj”
    Timer.tsx               stoper i odliczanie dla ćwiczeń na czas
    BadgeArt.tsx            medale odznak: tworzywa, piktogramy, pasma progów
    Celebrate.tsx           moment zdobycia — medal, promienie, konfetti
    icons.tsx               ikony nawigacji
    Mannequin.tsx           sylwetka ćwiczeń i jej zegar
    Intro.tsx               opcjonalne wprowadzenie, cztery ekrany
    Share.tsx               przycisk udostępniania i ścieżka zapasowa
    Support.tsx             wsparcie autora w dwóch wariantach
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

**Odznaki mają progi, nie jeden koniec.** 56 rodzin, 312 progów. Rodzina „Powtórzenia" ma dziesięć
progów od 500 do miliona, „Utrzymany rytm" siedem od czterech tygodni do dwóch lat. Zdobyty próg
nie kończy tematu, tylko odsłania następny — a pasek postępu mówi, ile brakuje. Zamiast ściany
„zablokowane" jest zawsze widoczny kolejny krok. Wszystko mieszka w zakładce **Osiągnięcia**.

Drabiny są mniej więcej geometryczne (kolejny próg to zwykle dwa razy tyle, co poprzedni) i sięgają
dalej, niż da się dojść w rok regularnych treningów. Ostatni próg ma być odległy, a nie osiągalny
w sezon — inaczej po roku aplikacja przestaje mieć cokolwiek do zaproponowania.

Pięć grup:

- **Dorobek** — sumy z całej historii: treningi (do 2 000), powtórzenia (do miliona), serie,
  wykonane ćwiczenia, tonaż (do 10 000 t), czas pod obciążeniem, liczba poznanych ruchów.
- **Partie ruchu** — objętość w rozbiciu na wzorce: zawias biodrowy, przysiad, ciągnięcie,
  pchanie, całe ciało, core, nogi. Widać, co jest zaniedbane. Zawias ma próg na 10 000 powtórzeń,
  bo tyle liczy klasyczne wyzwanie swingowe.
- **Szczyty** — rekordy pojedynczych podejść (najcięższy ciężar, szacowane maksimum,
  najdłuższa seria, najdłuższy podchód, najcięższa sesja) oraz rekordy z przesuwanego okna: doba,
  siedem, czternaście, dwadzieścia jeden, trzydzieści, dziewięćdziesiąt, sto osiemdziesiąt
  i trzysta sześćdziesiąt pięć dni. „Najlepszy miesiąc" znaczy dowolne trzydzieści dni z rzędu,
  a nie miesiąc z kalendarza — okno przesuwa się po datach, nie po kartkach.
- **Utrzymanie** — to, że nic się nie osypało: tygodnie z rzędu po dwa treningi, dni z rzędu
  z treningiem, dni bez zejścia z ciężaru, ćwiczenia stojące w granicach 5% własnego szczytu,
  etapy w ćwiczeniach z masą ciała, powrót do poziomu po przerwie.
- **Terminy** — zależne od uruchomionego planu: seria w terminie, brak pudła, czyste tygodnie,
  nadrobienia.

## Jak wyglądają odznaki

Odznaka jest przedmiotem, nie znakiem typograficznym. Każda to sześciokątny medal z tworzywem,
które rośnie razem z postępem w rodzinie: **brąz → srebro → złoto → platyna → diament**.
Tworzywo liczy się z udziału zdobytych progów w rodzinie, nie z gołego numeru progu — dzięki
temu domknięcie dowolnej rodziny kończy się diamentem, także tej trzyprogowej, a rodzina
dziesięcioprogowa rozkłada te same pięć pasm na dłuższą drogę. Odznaka jednorazowa dostaje
złoto: jeden trening przed ósmą nie waży tyle, co domknięta dziesięcioprogowa rodzina.

**Niezdobyta odznaka nadal pokazuje swój rysunek**, tylko bez tworzywa. Szary, ale czytelny
piktogram mówi, co jest do wzięcia — ściana z kłódką nie mówi nic.

Rysunki są rysowane inline, jedną siatką 24×24 i jedną grubością linii, tak samo jak ikony
nawigacji. Rodziny okien czasu noszą zamiast piktogramu długość okna (`7D`, `30D`, `365`),
bo liczba na medalu czyta się szybciej niż kolejny symbol.

**Półka** na górze zakładki ustawia zdobyte medale najmocniejszym tworzywem do przodu.
Lista rodzin mówi, ile czego brakuje; półka pokazuje dorobek jako zbiór przedmiotów,
a to inne uczucie.

## Moment zdobycia

Po zamkniętej sesji nowe progi dostają własne okno, nie listę punktowaną: medal wjeżdża
z przeskalowaniem, za nim obracają się promienie, z niego wystrzeliwuje konfetti, telefon
krótko wibruje. Na scenę idzie **najwyższe zdobyte tworzywo**, nie pierwsze w kolejności
rodzin — zdobycie złota nie może zniknąć pod brązem tylko dlatego, że brąz wypadł wcześniej
w katalogu. Reszta ustawia się pod spodem, bo dwanaście równorzędnych gratulacji to hałas.

Cały ruch znika przy `prefers-reduced-motion` — zostaje sam medal. Przyciski okna są
przyklejone do dołu, a treść przewija się pod nimi, więc główna akcja nigdy nie ucieka
pod krawędź ekranu.

**„Najbliżej zdobycia”** pokazuje pięć progów z najdalej posuniętym paskiem. Przy trzystu progach
sama lista przestaje odpowiadać na pytanie „co mogę zrobić teraz" — ta sekcja odpowiada.

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

