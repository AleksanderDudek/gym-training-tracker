# GYM TRACKER

Aplikacja do prowadzenia treningu siłowego z automatyczną progresją. Wybierasz trening, wpisujesz
wyniki, a silnik sam decyduje, kiedy podnieść powtórzenia i kiedy wejść na cięższe obciążenie.
Atlas obejmuje 114 ćwiczeń: kettlebell, sztanga, hantle, maszyny i kalistenika — 30 z nich zrobisz bez żadnego sprzętu.
Trening idzie część po części z zegarem w pasku, a zakładka Jedzenie dokłada dziennik jedzenia
z dietą, która nagina się do tego, co naprawdę zjedzone, białkowe przepisy i gotowce bez naczyń,
własne zestawy, prawie 40 tysięcy produktów sprzedawanych w Polsce (także w dziesięciu sklepach
internetowych i w halach Selgros), menu 18 sieci gastronomicznych i sklepy w pobliżu.

React 19 + TypeScript 6 + Vite 8, aplikacja do zainstalowania z własnym service workerem
(vite-plugin-pwa). Bez backendu — dane leżą w przeglądarce (trening w `localStorage`, dziennik
jedzenia w IndexedDB), z eksportem i importem do jednego pliku.

## Uruchomienie

Wymaga Node 22.12 albo nowszego (Vite 8; `engines` w `package.json`).

```bash
npm install
npm run dev        # serwer deweloperski na http://localhost:5173
```

Pozostałe polecenia:

```bash
npm run build      # typecheck + produkcyjny build do dist/ z service workerem (injectManifest)
npm run preview    # podgląd builda — tu działa też praca offline
npm run typecheck  # tsc: aplikacja, testy, konfiguracja Vite i skrypty, service worker, filmy demo
npm run lint       # oxlint
npm test           # 1836 testów: silnik, doradca, kalorie, odznaki, zegar sesji, trasy, jedzenie, plan z zakupami, serwer… (vitest)
```

Aplikacje na telefon (GYM TRACKER Zdrowie — `health/README.md`):

```bash
health/android/gradlew -p health/android testDebugUnitTest assembleDebug  # 30 testów JUnit i APK (Android SDK, JDK 17+)
health/ios/check.sh         # 22 testy części bez HealthKit przez swiftc — bez Xcode; --app kompiluje całą aplikację
```

Baza produktów i przepisy:

```bash
npm run food:check-recipes  # pokrycie przepisów i ich koszyki sklepów: baza produktów razem z Selgrosem i sklepami internetowymi
npm run food:check-prep     # plan z zakupami na prawdziwych danych: tydzień w najlepszych sklepach i każdym stylu diety
npm run food:selgros        # produkty Selgrosa z wyszukiwarki selgros.pl (Playwright, ok. godziny; wznawia, strony starsze niż tydzień czyta ponownie; --fresh od zera)
npm run food:data           # nowa baza z Open Food Facts i Open Prices (szczegóły w „Jedzenie”)
```

Filmy demo (po jednym na potrzebę użytkownika, 25–45 s, z opisami do postprodukcji — `demo-videos/README.md`):

```bash
npm run demo:videos         # build i nagranie wszystkich filmów do demo-videos/ (Playwright + ffmpeg)
npm run demo:videos -- 08   # tylko wybrane; --skip-build bez budowania, --describe-only same opisy
npm run demo:seed           # osoba demo (7 tygodni treningów i dziennik jedzenia) — tylko po zmianie modelu danych
```

Build jest w pełni statyczny (`base: './'`), więc `dist/` można wrzucić na dowolny hosting plików
albo otworzyć lokalnie.

## Obsada: goryle

Aplikacja ma trzy postacie i to one niosą jej charakter. Goryl rośnie siłą przez całe życie,
a srebrny grzbiet dostaje dopiero z wiekiem — trudno o lepszy obraz progresji.

- **Gustaw** — podopieczny, młody samiec: mały grzebień, pomarańczowa opaska, błękitna koszulka.
- **Gosia** — podopieczna: okrągła głowa bez grzebienia, kitka z pomarańczową gumką, zielony top.
  Rysowana w 92% wielkości Gustawa, bo samice goryli są mniejsze.
- **Trener Siwy** — stary srebrnogrzbiety: duży grzebień, srebrna czapa i barki, okulary nisko
  na nosie, gwizdek na pomarańczowej smyczy i stalowa kamizelka TRENER.

Budowa jest anatomiczna, nie kreskówkowa: masywne barki i kaptury, prawie brak szyi, mała
głowa osadzona nisko, przedramię niemal tak grube jak ramię, naga twarz w kształcie serca pod
łukiem brwiowym, wysunięty pysk z płaskim nosem. Kreska jest komiksowa: jeden kontur, płaskie
wypełnienia, emocja w brwiach, oczach i ustach.

**Kolory pochodzą od postaci, nie odwrotnie.** Stal to kamizelka trenera — i dlatego stal jest
kolorem akcji. Pomarańcz to opaski i smycz, więc pomarańcz oznacza aktywną zakładkę i puenty.
Błękit to koszulka Gustawa, zieleń top Gosi, srebro grzbiet Siwego. Paleta interfejsu i paleta
obsady to jedna lista, nie dwie. Jedyny kolor spoza obsady to złoto wsparcia — wzięte z medalu
„złoto” i z cremy espresso, którym Siwy częstuje w banerach.

**Zasady, których pilnuje test.** Postać reaguje, nigdy nie informuje: każdy stan — pasmo
odznaki, liczba, nazwa — stoi obok niej napisany słowem, więc nic nie ginie przy wyłączonych
obrazkach ani przy czytniku ekranu. Radość rośnie razem z pasmem (`BAND_MOOD`: 0 tęsknota →
5 euforia), a nie skacze. Siwy tylko doradza i wspiera — nigdy nie beszta i o nic nie błaga.
Jedna postać na ekran i nigdy w trakcie serii. Wyjątki są dwa: blankiet do wpisu — to nie ekran,
tylko dokument z dwoma portretami w narożnikach (o nim niżej, w części o tonie) — i ilustracje
kart treningów i planów, w których obsada gra scenkę, a nie mówi do użytkownika.

**Twoja postać to Gustaw albo Gosia** — do wyboru w profilu. Rośnie razem z punktami
doświadczenia, od „Świeżo z dżungli” po srebrny grzbiet (o tym niżej, w części o postaci).

Kto gdzie stoi: ostrzeżenie mówi Siwy (spokojna rada), dobra wiadomość to radość podopiecznego,
pusta lista to tęsknota, stoper ma kibica, który męczy się w ostatniej jednej trzeciej podchodu,
a okno kasowania danych — trenera, bo to on pilnuje, żeby nikt nie skasował sobie roku pracy.

## Ilustracje treningów i planów

Każdy trening i każdy plan ma zabawną scenkę z obsadą — z systemu projektowego (`WorkoutArt`,
`PlanArt`, grupy zasobów „Workout art” i „Plan art”). Tło według sprzętu (mieszkanie, mieszkanie
z kettlebell, siłownia), wykonawca w ruchu z silnika póz, kibic w popiersiu, jeden gag i dymek:
Gustaw robi przysiad ze sztangą, a Gosia patrzy z przerażeniem na schody — „A potem schody…”.
W planach zawsze stoi Trener Siwy, a kartka kalendarza w rogu mówi 30, 60 albo 90 DNI. Plany
klasyczne mają scenę na poziom, a własne treningi i plany — wspólną.

- **Gdzie:** na karcie treningu i planu nad tytułem (Treningi, katalog planów, plan klasyczny),
  na całą szerokość pod paskiem aplikacji w podglądzie treningu, w podglądzie planu,
  w konfiguratorze planu klasycznego (scena idzie za wybranym poziomem) i na zakładce Plan.
- **Format 2:1**, szerokość treści karty: 332, 362 i 402 px na telefonach 360, 390 i 430 px,
  najwyżej 612 px na komputerze.
- **SVG, nie PNG.** System ma też eksporty PNG 1200×600 — 57 plików, razem ok. 5 MB. W aplikacji
  ta sama scena rysuje się z kodu: zero zapytań, działa offline bez dokładania megabajtów do
  pamięci service workera, jest ostra przy DPR 3 i bierze kolory z tokenów. PNG zostają do
  udostępnień poza aplikacją.
- **Na obrazku nie ma informacji.** Tytuł, dane i przyciski są w HTML-u, a dymek powtarza się
  w tekście zastępczym, więc czytnik ekranu dostaje ten sam żart.
- Manekin w scenie ma **budowę sceniczną** (`build="scene"`): kończyny półtora raza grubsze,
  głowa 1,4 raza większa. W atlasie stoi sam w kadrze, więc zostaje szczupły; w scenie obok
  popiersia kibica wyglądałby jak patyczak.

Test pilnuje, żeby tabela scen trzymała się aplikacji: każdy trening z biblioteki i każdy plan
z celem ma swoją scenę, kalendarz pokazuje długość planu, tło pasuje do sprzętu, miny pasują do
postaci, dymek mieści się w kadrze i powtarza w tekście zastępczym, a każdy obrazek na liście
przycina się własnym `clipPath`. Test tła złapał jedną rzecz z systemu: „Siła z masą ciała —
90 dni” to plan bez sprzętu, a miała w tle kettlebell — w aplikacji stoi w mieszkaniu bez niego.

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

**Sylwetka ma minę i się poci.** Mimika i kropelki potu wynikają z jednej liczby — wysiłku
liczonego z odległości od najtrudniejszej klatki ruchu. Na górze powtórzenia twarz odpuszcza:
brew uniesiona, oko otwarte, lekki uśmiech. W dole brew ściąga się do nosa, oko mruży się
do kreski, usta otwierają się do wydechu, a obok głowy lecą krople. To nie tylko żart —
widać, w którym miejscu zakresu jest ciężko.

Twarz jest z profilu, bo sylwetka też: jedno oko, jedna brew, usta. Dwoje oczu na profilu
wygląda jak błąd rysunkowy, a nos narysowany w środku czaszki sterczy przez kontur jak dziób,
więc nosa nie ma. Cała mimika obraca się razem z głową, więc przy leżeniu na ławce nie zostaje
pionowo. Kropelki znikają przy `prefers-reduced-motion`.

Ten sam ludzik pozuje na legitymacji siłowej — tam z wysiłkiem ustawionym nisko, bo na zdjęciu
do dokumentu nikt nie wyje z wysiłku. Na medalach odznak głowa zostaje kropką: przy dwóch
pikselach średnicy mina byłaby plamą.

**Stopnie opisują karierę, nie mięśnie**: od „Gościa z ulicy" po „Pomnik za życia". Awans
zależy od frekwencji, więc i nazwa mówi o tym, jak często cię tam widują.

**Karty do wpisu są dokumentami wydanymi przez urząd, który nie istnieje.** Odznaka dostaje
„ŚWIADECTWO POCIĘŻAROWE" z medalem, cały dorobek — „LEGITYMACJĘ SIŁOWĄ" z rysowaną sylwetką.
Obie mają podwójną ramkę, zawijasy w narożnikach, sentencję zamiast łacińskiej dewizy
(„PER ASPERA AD ZAKWASY"), numer wydania „bez trybu odwoławczego" liczony z treści, odręczny
podpis urzędu, który nie istnieje („Główny Inspektor Zakwasów"), i przechyloną pieczęć
(„POTWIERDZONE — nikt nie sprawdzał"). Powaga formy przy błahości treści jest tu całym żartem.

**W narożnikach nagłówka wiszą portrety obsady**, jak popiersia założycieli na starych
dyplomach: po lewej podopieczny (Gustaw albo Gosia, zależnie od ziarna karty), po prawej
Trener Siwy jako komisja, która dokument zatwierdza — i na jego medalion zahacza pieczęć,
tak jak na zdjęcie w legitymacji. Na karcie widać tylko głowę, więc miny są dobrane pod
twarz: świadectwo odznaki bierze minę z pasma (`BAND_MOOD`, ta sama drabina co w oknie
zdobycia), po treningu podopieczny ledwie żyje — wywalony język i krople potu — a przy
dorobku jest dumny albo osłupiały. Trener aprobuje albo mruga. Tęsknoty i opuszczonego
treningu na blankiecie nie ma: nikt nie udostępnia dokumentu, na którym ktoś jest smutny.
Medaliony stoją obok napisów nagłówka, więc nie zabierają treści ani piksela w pionie.
Twarze rysuje ten sam komponent co w aplikacji, wyrenderowany po kliknięciu do odłączonego
węzła, a zmienne arkusza zamieniają się przed rasteryzacją na swoje wartości zapasowe —
samodzielny obrazek arkusza strony nie widzi.

Blankiet dopasowuje się do treści: przy dwuwierszowym tytule i długiej puencie medal się
kurczy, a poniżej progu znika całkiem. Podpis idzie pod treść, nie na sztywno — inaczej
zawijas lądował w poprzek zdania.

**Medale pokazują ludzika.** Odznaki o ruchu — powtórzenia, serie, tonaż, partie ciała —
noszą tę samą patyczkową sylwetkę, co manekin w atlasie, zmniejszoną do środka sześciokąta
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
liczby, dwa portrety obsady i adres aplikacji. Kwadrat, bo mieści się bez przycięcia wszędzie tam, gdzie
prostokąt bywa kadrowany inaczej, niż autor zakładał. Karta powstaje na płótnie dopiero
po kliknięciu, a medal wjeżdża w nią jako kopia żywego rysunku ze strony — razem
z gradientami, które inaczej zostałyby w osobnym bloku `defs`. Adres stoi w osobnej,
ostatniej linii wpisu, bo serwisy robią podgląd z ostatniego adresu, a wtrącony w zdanie
bywa ucinany.

**Hasło nad wstęgą: „Twój trening sam wie, kiedy dołożyć. Na razie za darmo.”** Kto zobaczy
kartę w cudzym kanale, nie wie, co to GYM TRACKER — hasło mówi to jednym zdaniem, zanim wzrok
zjedzie na adres, w kolejności z każdej reklamy: korzyść, potem gdzie. Korzyść, a nie lista
funkcji: notes z treningiem zapisze serie, ale nie powie, kiedy dołożyć — to robi ta aplikacja.
„Na razie” uczciwie, bez obietnicy, że zawsze. Zdanie zaproszenia we wpisie też mówi, czym jest
aplikacja i że kosztuje zero.

**Poleć znajomym** (`#/polec`, z Ustawień i z Profilu) to plakat od tego samego urzędu, co
certyfikaty: „Ogłoszenie · nabór otwarty — Trener Siwy szuka podopiecznych”. Siwy wskazuje
palcem jak na starym plakacie werbunkowym, Gustaw z telefonem, Gosia z bicepsem; pod nimi hasło,
jedno zdanie o tym, co aplikacja robi, pieczęć „ZA DARMO · na razie”, wstęga z adresem i drobny
druk „Opłata wpisowa: 0 zł · zakwasy wliczone”. Strona pokazuje dokładnie ten obrazek, który
pójdzie w świat, i wpis do niego; „Udostępnij plakat” idzie przez systemowy arkusz z obrazkiem,
a bez niego zostaje pobranie i skopiowanie linku.

**Karta ma się czytać w miniaturze**, a nie dopiero po powiększeniu — na osi czasu nikt
w nią nie klika, tylko przewija. Stopnie pisma poszły w górę (tytuł 76 px, wiersze 37 px,
puenta 38 px), a napisy siedzą na trzech tuszach zamiast na czterech szarościach: czarny
na treści, przygaszony na podpisach, ceglasty na puencie i nagłówku dokumentu.

**Adres stoi na wstędze przez całą szerokość stopki**: jasne litery na stali, 40 px półgrubą,
bez `https://` i końcowego ukośnika — z obrazka nikt go nie kliknie, tylko przepisze, więc
każdy zbędny znak to miejsce na większy krój. Wcześniej stał drobnym drukiem (27 px) i do
tego pod pieczęcią. Stal nie jest przypadkowa: w aplikacji to kolor akcji, a adres jest
jedyną akcją, jaką obrazek w cudzym kanale może komuś zaproponować. Końce wstęgi wychodzą
poza kartkę i mają wcięcia jak na dyplomie; stopień dopasowuje się do szerokości, gdyby
adres kiedyś się wydłużył.

Pieczęć ma pełny kolor i grubsze pierścienie, a duże słowo dopasowuje się do obwódki —
„POTWIERDZONE” w stałym stopniu wychodziło poza pierścień. Stoi przy prawej krawędzi pod
nagłówkiem, zahaczając o portret trenera: to miejsce, którego treść nie zajmuje, bo medal
i sylwetka stoją pośrodku, a tytuł karty bez grafiki zaczyna się niżej. Idzie na papier
**przed** napisami, więc gdy długi tytuł jednak do niej dosięgnie, wydrukuje się na niej —
prawdziwa pieczęć też nie zjada tekstu, który już był na kartce.

**Wsparcie ma dwa miejsca i jeden styl: cienki pasek pod paskiem aplikacji i duży baner na dole
zakładek.** Oba mówią głosem Trenera Siwego i oba są złote.

**Pasek** stoi pod paskiem aplikacji, nie nad nim — na samej górze zostaje tytuł ekranu, a prośba
jest drugą rzeczą, nie pierwszą. Przykleja się razem z paskiem aplikacji. W środku to samo co
w dużym banerze, tylko w jednym wierszu: twarz Siwego (mina zmienia się co dzień), żart o espresso
w jego stylu („Siwy przyjmuje wpłaty także w espresso.”, „Stado działa na bananach i małej
czarnej.”) i przycisk espresso. Cały pasek jest jednym odnośnikiem do buycoffee.to. Tekst ma
najwyżej dwa krótkie wiersze — test pilnuje długości i tego, że każdy żart jest o Siwym i o kawie.
Na telefonie przycisk mówi krótko „Espresso →”, bo pełne „Postaw espresso” zabierało żartowi tyle
miejsca, że ucinał się w pół zdania; pełne zostaje na szerszych ekranach. Na najwęższych (poniżej
360 px) znika twarz. Pasek ma 44 px, więc krzyżyk jest pełnym celem dotykowym.

**Baner na dole** zostaje tam, gdzie był: ekran Dziś, Plan z uruchomionym planem, Treningi,
Profil, Osiągnięcia, Atlas i — w wersji w linii — Ustawienia; do tego góra podsumowania po
zamkniętej sesji, okno zdobytej odznaki i koniec wprowadzenia. Prowadzi rada dnia od Trenera
Siwego — konkretna wskazówka treningowa, która ma wartość sama w sobie i zmienia się co dzień,
więc jutro jest po co wrócić. Dopiero pod nią stoi żart o espresso i przycisk „Postaw espresso”.
Test pilnuje, żeby rada nigdy nie mówiła o kawie, a żart zawsze. Pasek przypomina, baner zamyka
ekran — dwa miejsca to decyzja autora.

**Złoto, nie pomarańcz i nie zieleń.** Wsparcie było wcześniej pomarańczowe, jak aktywna
zakładka. Teraz ma własny kolor: złoto z medalu i cremy espresso. Zieleń odpadła, bo znaczy tu
postęp i sukces — punkty planu, paski odznak, stan „ok” — a jasnozielony pasek zlałby się
z szarozielonym tłem aplikacji. Złote tło odcina od jasnego tła ramka w `--c-gold-ink`, bo
samo wypełnienie różni się od niego o włos; test pilnuje, żeby nikt jej nie skasował.

Zasady bez zmian: nigdy nie blokuje drogi i nigdy nie pojawia się w trakcie treningu — pasek
znika, gdy tylko ruszy sesja, a baneru nie ma na ekranie sesji, w kreatorze własnego treningu
i w katalogu planów. **Krzyżyk chowa pasek na tydzień** — prośba, której nie da się odsunąć,
przestaje być prośbą; po tygodniu wraca sama. Żart idzie z aplikacji, z goryla i z kawy, nigdy
z czytającego — nie ma tu liczników zbiórki, pasków „do celu" ani zdań o tym, jak bardzo autor
potrzebuje.

**Kawa według kraju.** W Polsce pasek, baner i okno kontaktu prowadzą do buycoffee.to (BLIK,
przelewy), gdzie indziej do buymeacoffee.com (karta z każdego kraju) — tak jak w drugiej
aplikacji autora, Teleo. „Polska” to polski wśród preferowanych języków przeglądarki albo polska
strefa czasowa: bez pytania o lokalizację, a obejmuje i Polaków za granicą, i telefony po
angielsku w kraju. Pod przyciskiem banera stoi adres, dokąd naprawdę prowadzi.

**Kontakt z autorem** to „@” w pasku aplikacji, tuż przed dymkiem „Napisz do autora”, i sekcja
„Kontakt” w Ustawieniach. Okno (arkusz od dołu, jak okno wiadomości) zbiera drogi poza aplikacją:
Instagram autora, w Polsce serwer na Discordzie (rozmowy idą po polsku, więc za granicą go nie ma)
i kawę według kraju; gdy działa serwer wiadomości, ma też „Napisz w aplikacji”. Każdy odnośnik
pokazuje swój adres i otwiera się w nowej karcie. „@” jest zawsze — odnośniki nie potrzebują
serwera — poza trwającym treningiem. Instagram (instagram.com/aleksanderdudek) stoi pierwszy,
dla wszystkich; jego adres to jedna stała, `INSTAGRAM_URL` w `src/contact.ts`.

**Miejsce w układzie zależy od tego, po co ktoś przyszedł.** Na ekranie Dziś baner stoi **pod**
wyjściami do treningu i przekąski, bo kto przyszedł ćwiczyć, ten najpierw widzi przycisk startu.
W podsumowaniu sesji jest odwrotnie, na samej górze: to jedyna chwila, w której aplikacja właśnie
coś dla kogoś zrobiła. Na pozostałych zakładkach zamyka ekran.

**Dorobek udostępnisz w każdej chwili** — przycisk „Udostępnij dorobek" w zakładce Osiągnięcia
i drugi, obok wyniku sesji, po każdym zamkniętym treningu.

## Zakładki

| Zakładka | Adres | Co robi |
| --- | --- | --- |
| Dziś | `#/sesja` | Co masz dziś do zrobienia według planu, ważenie, karta jedzenia (kalorie i białko dnia — gdy prowadzisz dietę), pasek postaci, przekąska ruchowa i rada dnia; w trakcie — bieżąca sesja. |
| Trening | `#/plan`, `#/treningi`, `#/cwiczenia` | Trzy sekcje. **Plan**: uruchomiony plan — kalendarz terminów, punkty, stopień, dziennik; bez planu — katalog: plany z celem, własne i klasyczny. **Treningi**: 38 gotowych treningów (całe ciało, push/pull/nogi, góra/dół, partie), 32 z profilem i własne, z filtrem sprzętu i rodzaju. **Ćwiczenia**: atlas 114 ćwiczeń. |
| Jedzenie | `#/jedzenie`, `#/przepisy`, `#/produkty`, `#/w-poblizu` | Cztery sekcje. **Dziennik**: pytanie o wagę, bilans dnia z „Dodaj zjedzone” i „Ulubione”, zjedzone, plan posiłków albo propozycja dnia, „Co teraz?”. **Przepisy**: białkowe, z produktów jednego sklepu. **Produkty**: 29 tys. produktów z filtrami. **W pobliżu**: sklepy na mapie i przepisy z nich. |
| Osiągnięcia | `#/osiagniecia` | Dorobek w liczbach, progi najbliższe zdobycia, 73 rodziny odznak — także czasu na treningu — i odznaki każdego zrobionego ćwiczenia. |
| Profil | `#/profil` | Postać i doświadczenie, twoje liczby, waga i wzrost, obciążenie, przekąski, kroki i cardio, lista zrobionych ćwiczeń i historia treningów z kaloriami. |

Podstrony mają własne adresy i strzałkę wstecz w pasku aplikacji:

| Podstrona | Adres | Należy do |
| --- | --- | --- |
| Podgląd treningu — serie, mięśnie, doradca, start | `#/treningi/<id>` | Trening |
| Kreator treningu: nowy, kopia gotowego, edycja własnego | `#/treningi/nowy`, `#/treningi/nowy/<id>`, `#/treningi/<id>/edytuj` | Trening |
| Katalog planów | `#/plany` | Trening |
| Podgląd planu z doradcą i startem | `#/plany/<id>` | Trening |
| Kreator planu: nowy, edycja własnego | `#/plany/nowy`, `#/plany/<id>/edytuj` | Trening |
| Plan klasyczny z kettlebell — konfigurator | `#/plany/klasyczny` | Trening |
| Przekąski — dziś, tydzień, historia | `#/przekaski` | Dziś |
| Zapis przekąski | `#/przekaski/dodaj`, `#/przekaski/<id>` | Dziś |
| Kroki i cardio — dziś, tydzień, historia, jak liczymy kalorie | `#/cardio` | Dziś |
| Zapis kroków, bieżni, roweru albo zajęć tańca | `#/cardio/kroki`, `#/cardio/bieznia`, `#/cardio/rower`, `#/cardio/taniec` | Dziś |
| Ćwiczenie — technika i wideo | `#/cwiczenia/<id>` | Trening |
| Plan posiłków — tydzień, dni wzorcowe, warianty | `#/jedzenie/plan` | Jedzenie |
| Postęp — waga z prognozą, kalorie z 14 dni, makro z tygodnia | `#/jedzenie/postep` | Jedzenie |
| Profil diety — energia, sposób odżywiania, plan z Excela, dane | `#/jedzenie/profil` | Jedzenie |
| Produkt — zdjęcia, wartości, skład, ceny | `#/produkty?p=<kod>` (arkusz nad listą) | Jedzenie |
| Historia ćwiczenia | `#/profil/<id>` | Profil |
| Ustawienia | `#/ustawienia` | przycisk w pasku aplikacji |

**Trening ma trzy sekcje, Jedzenie — cztery.** Pięć zakładek to górna granica obu wytycznych —
szósta zeszłaby poniżej celu dotykowego. Gdy doszło jedzenie, plan wszedł do zakładki Trening jako
pierwsza sekcja: plan, biblioteka treningów i atlas odpowiadają na jedno pytanie — „co trenuję” —
a trening na dziś i tak stoi na ekranie Dziś. Zwolnione miejsce dostało Jedzenie. Przełącznik sekcji
stoi na górze każdej z nich, każda ma własny adres, a podstrony (podgląd treningu, kreator, katalog
planów, ćwiczenie) podświetlają swoją zakładkę.

**Zakładka pamięta ostatnią sekcję** — razem z wyszukiwaniem i filtrami, które stoją w adresie —
jak stos zakładki w iOS: z produktów przefiltrowanych po „skyr” do przepisów i z powrotem wraca się
do tej samej listy. Za pierwszym razem Trening otwiera plan, gdy jakiś trwa, a bez planu — treningi.

**Dieta ma cztery widoki, ale sekcją jest tylko Dziennik.** Plan posiłków, postęp i profil diety to
podstrony ze strzałką wstecz — inaczej pod przełącznikiem sekcji stałby drugi rząd zakładek.
Ustawienia siedzą w pasku aplikacji, bo otwiera się je raz na miesiąc.

Osiągnięcia mają własną zakładkę, bo liczą się z całej historii, a nie z kalendarza planu —
i mają być widoczne również wtedy, gdy żaden plan nie jest uruchomiony.

**Ekran Dziś odpowiada na jedno pytanie: co robię dzisiaj.** Gdy plan ma termin — pokazuje ten
jeden trening i przycisk startu. Gdy terminu nie ma — mówi, kiedy wypada następny. Gdy sesja już
trwa — pokazuje ją. Pełna lista treningów mieszka w zakładce Trening, bo ekran z dwudziestoma
siedmioma równorzędnymi przyciskami nie podpowiada niczego. Kto prowadzi dietę, ma tu też jedną
kartę jedzenia: ile kalorii i białka z celu dnia, ile zostało i „Dodaj zjedzone”. Kto nie prowadzi,
nie widzi jej wcale, a ekran Dziś nie wczytuje ani nie uruchamia jej kodu. (Pobrany jest i tak:
service worker trzyma całą aplikację w zapasie na pracę offline — ale leży tylko w pamięci podręcznej.)

Stare adresy dalej działają — `#/trening` i `#/poziomy`, a także dawne linki do formularza
przekąski — zapisane linki i zakładki przeglądarki nie przestają prowadzić tam, gdzie prowadziły.

## Nawigacja i cele dotykowe

Nawigacja idzie za wzorcem aplikacji mobilnych z wytycznych Material 3 i Apple HIG: zakładki
na dole do ruchu w bok, pasek aplikacji na górze do ruchu w głąb.

**Pięć zakładek.** Tyle przewidują obie wytyczne — Material 3 „od trzech do pięciu”, iOS
najwyżej pięć na iPhonie. Każda pozycja ma na ekranie 320 px **64 × 64 px**, a etykieta mieści
się w jednym słowie („Dziś”, a nie „Twoja sesja”) i ma 12 px. Aktywna zakładka niesie trzy
sygnały naraz: „pigułkę” za ikoną jak w Material 3, kolor i pogrubienie.

**Pasek aplikacji zamiast nagłówka.** Wielki napis „GYM TRACKER” na każdym ekranie zajmował
ćwierć wysokości telefonu i nie mówił, gdzie się jest. Teraz przyklejony pasek ma tytuł ekranu —
na ekranie Dziś z datą, w trakcie sesji z nazwą treningu i postępem — znak aplikacji na
korzeniach zakładek i strzałkę wstecz na podstronach. Przyciski „← Atlas ćwiczeń” w treści
zniknęły: wstecz jest zawsze w tym samym miejscu. Po przewinięciu pasek dostaje cień, bo tak
Material 3 i iOS pokazują, że treść wjeżdża pod spód.

**Wstecz wraca tam, skąd się przyszło.** Strzałka korzysta z historii przeglądarki, więc z zapisu
przekąski otwartego w atlasie wraca do atlasu, a z listy treningów na ekran Dziś. Adres otwarty
wprost, bez historii w aplikacji, wraca do rodzica ekranu, a nie wyprowadza ze strony.

**Każda zakładka pamięta miejsce.** Przełączenie zakładek wraca na to samo przewinięcie, a powrót
strzałką z podstrony — na to samo miejsce listy, z którego się weszło. Nowa podstrona zaczyna się
od góry. Stuknięcie w zakładkę, na której się jest, przewija ją na górę. Tak zachowują się paski
zakładek w iOS i Androidzie; wcześniej każde przejście rzucało na początek ekranu.

**Klawiatura nie przykrywa pola.** Na telefonie klawiatura podnosi przyklejony dolny pasek nad
siebie i zasłania nim pole, w które się pisze. Na czas pisania dolny pasek znika i wraca, gdy
fokus opuści pole. Tylko na ekranach dotykowych — przy myszy i klawiaturze fizycznej nie ma czego
przykrywać.

**Stuknięcie bez czekania.** Kontrolki mają `touch-action: manipulation`: bez podwójnego
stuknięcia do powiększenia przeglądarka nie czeka na drugie stuknięcie i reaguje od razu. Pola
formularzy mają 17 px, więc iOS nie powiększa strony przy wejściu w pole.

**Ikona nad etykietą.** Ikony są rysowane inline, jedną siatką 24×24 i jedną grubością linii —
bez zewnętrznych zasobów i bez zależności.

**Cele dotykowe w całej aplikacji** trzymają próg 44 px: przyciski, rozwijacze, przełączniki,
filtry sprzętu, odhaczanie terminu w kalendarzu, strzałka wstecz, krzyżyk paska wsparcia
i odnośniki tekstowe. Kółko odhaczenia ma 24 px średnicy, ale obszar kliknięcia 44 px.

**Na komputerze aplikacja zostaje kolumną telefonu.** Treść i zakładki trzymają kolumnę 640 px
na środku, jak każda PWA otwarta w szerokim oknie — sekcje nie rozlewają się na 1600 px.

**Nagłówki idą po kolei.** Tytuł w pasku aplikacji jest `h1`, sekcje ekranu `h2`. Audyt
Lighthouse (telefon): dostępność 100, SEO 100.

## Profil — historia bez konta

Aplikacja nie zna maila, nazwiska ani hasła i nie zamierza poznać. „Profil” znaczy tu więc coś
innego niż zwykle: nie tożsamość, tylko jedno miejsce, z którego widać przeszłość. Zakładka
zastąpiła „Poziomy” — te same liczby siedzą teraz **przy** historii, zamiast obok niej, a pełny
katalog poziomów i tak stał już w atlasie przy każdym ćwiczeniu.

**Cztery rzeczy na jednym ekranie:** twoje liczby (treningi, powtórzenia, tonaż, staż w tygodniach),
wskaźnik obciążenia, lista ćwiczeń **zrobionych** i historia treningów. Lista bierze się z dziennika,
a nie z katalogu: profil pokazuje przeszłość, nie to, co dałoby się jeszcze zrobić. Każdy wiersz
mówi, ile sesji, jak dawno i w którą stronę to idzie.

**Każde ćwiczenie ma własną podstronę** pod `#/profil/<id>` — oddzielną od tej w atlasie, bo to
dwa różne pytania. Atlas mówi, jak to robić; profil mówi, jak ci szło: kierunek zmiany zdaniem,
wykres sesja po sesji, rekordy (najcięższy ciężar, najlepsza seria, tonaż) i pełna lista sesji
z ciężarem, seriami i zadeklarowanym wysiłkiem.

**Kierunek liczony jest z tercji, nie z krańców.** Porównanie pierwszego wyniku z ostatnim
opowiadałoby głównie o szumie — gorszy sen, cięższy dzień, inny sprzęt. Średnia z pierwszej
tercji sesji kontra średnia z ostatniej wygładza wahania, a próg pięciu procent oddziela
zmianę od drgania. Poniżej czterech sesji aplikacja mówi wprost, że jest za wcześnie,
zamiast rysować trend z trzech punktów.

**Miarą jest szacowane maksimum, gdy jest z czego je policzyć** — od czterech sesji z ciężarem.
Ćwiczenia z masą ciała dostają powtórzenia, ćwiczenia na czas sekundy. Wykres nie miesza
wielkości: linia od początku do końca pokazuje to samo, inaczej skakałaby przy każdej
zmianie obciążenia.

**Liczone jest z dziennika, nie z `prog[id].hist`.** Dziennik jest źródłem — `hist` bywa
przycinany przez silnik progresji, bo służy do wyliczania następnej sesji, a nie do pamiętania
wszystkiego. Spadek po przerwie nie jest tu opisany jako porażka: wykres liczy, nie ocenia.

## Przekąski ruchowe

Krótka seria poza treningiem: dziesięć przysiadów przy czajniku, minuta deski w przerwie,
kilka swingów między spotkaniami. Badania nad takimi „przekąskami” — od kilkudziesięciu sekund
do kilku minut, kilka razy dziennie — pokazują poprawę wydolności i przerwanie długiego
siedzenia. Liczy się więc rozłożenie w ciągu dnia, nie objętość jednej serii.

**Przekąska nie jest treningiem** i aplikacja pilnuje tej granicy. Nie trafia do dziennika
treningów, więc nie podnosi celów serii, nie domyka terminu planu, nie wchodzi do wskaźnika
obciążenia ani do sum dorobku. Dziesięć pompek nie może udawać sesji. Dokłada się za to do
odznak ćwiczeń, do własnej grupy odznak i do doświadczenia postaci.

**Droga jest zawsze ta sama: ćwiczenie → liczba → zapis.** Na ekranie sesji karta przekąsek
pokazuje same ćwiczenia, bez liczb: ostatnio robione jako przekąska, a na start cztery ruchy bez
sprzętu (przysiad, pompki, deska, burpee), plus „Inne ćwiczenie”. Stuknięcie prowadzi do widoku
zapisu, w którym wpisuje się, ile było. Wcześniej na przyciskach stały gotowe liczby
(„Przysiad ×15”, zapis jednym stuknięciem) — szybciej, ale zapisywało się to, co było ostatnio,
a nie to, co jest teraz.

**Widok zapisu nie podpowiada liczby z góry.** Pole jest puste, a kursor stoi w nim od razu;
jedyna podpowiedź to szara „ostatnio 12”, i to tylko wtedy, gdy ktoś już robił ten ruch jako
przekąskę. Obok przyciski ±, ciężar tylko przy ćwiczeniach z obciążeniem (domyślnie ostatnio
użyty, bez historii — bez ciężaru) i stoper przy ćwiczeniach na czas. Enter zapisuje. Po zapisie
widok wraca tam, skąd ktoś przyszedł — na ekran sesji, do atlasu albo do historii ćwiczenia;
otwarty wprost z adresu wraca na ekran sesji.

**Licznik dnia pojawia się dopiero po pierwszym zapisie.** Do tego czasu karta zaprasza i nic
nie liczy — zero przy każdym ćwiczeniu to lista rzeczy niezrobionych, a nie zachęta. Po zapisie
nagłówek karty mówi „Dziś 3 przekąski · +45 XP”, a dzisiejsze ćwiczenia wskakują na górę listy
z tym, ile już jest: „Pompki — dziś 36 powt. · 3×”. Widok zapisu pokazuje pod formularzem
analizę dnia dla wybranego ćwiczenia: ile łącznie, z ilu przekąsek i ile z treningu, i ile
brakuje do kolejnego progu dnia.

**Ćwiczenie wybiera się pisaniem, nie przewijaniem.** Pole działa jak wyszukiwarka: po wejściu
pokazuje wszystkie 114 ćwiczeń według polskiego alfabetu (Ł po L, Ś po S), ustawione na tym
wybranym, a każda litera zawęża listę. Szuka po początkach słów — „pomp” daje wszystkie pompki,
„hantle” ćwiczenia z hantlami, „zawias” całą partię — a gdy tak nic nie pasuje, także w środku
słowa. Ogonki są opcjonalne: „wioslowanie” znajduje „Wiosłowanie”, bo na telefonie tak się
pisze szybciej. Dopasowany fragment jest podświetlony, wynik zostaje alfabetyczny.

Zamiast natywnego `datalist` jest własne pole według wzorca combobox z wytycznych WAI-ARIA:
`datalist` na telefonach zachowuje się każdy inaczej, nie da się go ostylować, a ogonki
dopasowuje albo nie — zależnie od przeglądarki. Strzałki chodzą po liście, Enter wybiera,
Escape zamyka i przywraca poprzedni wybór, czytnik ekranu słyszy liczbę wyników, a każda
pozycja ma 48 px wysokości. Po wyborze nazwa zostaje zaznaczona, więc kolejna litera zaczyna
nowe szukanie, zamiast doklejać się do nazwy.

**Historia przekąsek** (`#/przekaski`) ma te same skróty do zapisu, dzisiejsze przekąski
z godziną i przyciskiem usunięcia, dzień w rozbiciu na ćwiczenia (ile, w ilu przekąskach, ile
razem z treningiem, ile brakuje do progu dnia), ile jeszcze da dziś doświadczenie, ostatnie
siedem dni jako pasek i historię dzień po dniu.

**Usunięcie przekąski cofa to, co dała.** Dziennik treningów tylko rośnie, więc tam raz zdobyty
próg ma zawsze pokrycie. Przekąskę da się skasować — i to zwykle po literówce, „150” zamiast
„15”. Gdyby jej progi zostawały, pomyłka dawałaby odznaki i doświadczenie na zawsze, a ekran
pokazywałby te same progi jako niezdobyte. Usunięcie cofa więc progi przekąsek i progi tego
ćwiczenia, których historia już nie uzasadnia; reszta odznak zostaje nietknięta. Jedna
przekąska ma też górną granicę — 500 powtórzeń albo 30 minut — bo więcej to już nie przekąska.

Przekąska wisi pod treningiem z planu, nie nad nim: kto przyszedł trenować, najpierw widzi
trening. Na ekranie przekąsek nie ma baneru wsparcia — to narzędzie do szybkiego zapisu,
a kawa poczeka.

## Kroki, cardio i kalorie

**Aplikacja nie mierzy kroków — przyjmuje je.** Krokomierz telefonu liczy system (chip ruchu
w iPhonie, czujnik kroków w Androidzie) i żadna przeglądarka nie daje do niego dostępu, także
aplikacja zainstalowana na ekranie głównym. Akcelerometr strony działa tylko przy włączonym
ekranie i otwartej karcie, więc liczyłby wyłącznie spacer z telefonem w dłoni. Zamiast udawać
pomiar, aplikacja przyjmuje liczby z urządzenia, które mierzy naprawdę, i liczy z nich kalorie.
Z zegarka Garmin kroki i przejazdy rowerem przychodzą same — o tym niżej, w części o zegarku.
Z Apple Zdrowie i Health Connect przychodzą przez małą aplikację na telefon — w części „Zdrowie z telefonu”.

**Cztery rodzaje wpisu, jedna droga: rodzaj → liczby z wyświetlacza → zapis.**

- **Kroki** — liczba z całego dnia z telefonu albo zegarka. Drugi wpis kroków na ten sam dzień
  zastępuje pierwszy: wieczorem wpisuje się stan licznika, a nie przyrost od południa.
- **Bieżnia** — średnia prędkość, czas i nachylenie w procentach (puste znaczy płasko).
- **Rower** — średnia prędkość z licznika albo, na rowerze stacjonarnym, moc w watach.
  Prędkość na wyświetlaczu roweru stacjonarnego to umowna liczba; waty mówią, ile było pracy.
- **Taniec** — zajęcia w parze albo solo: czas całych zajęć i to, ile z nich było tańcem.
  Trzy możliwości słowami z sali: „cały czas taniec” (80–90% ruchu), „pół na pół” (połowa
  tańca, połowa tłumaczenia) i „dużo tłumaczenia” (20–30% ruchu). Rodzaj i podział podpowiada
  ostatni wpis, bo ta sama szkoła zwykle uczy tak samo co tydzień.

Dzień wybiera się przełącznikiem „Dziś / Wczoraj / Inny dzień”, bo kroki wpisuje się często
nazajutrz rano. Bieżnia, rower i taniec się sumują — to osobne wyjścia. Pod formularzem stoi
uwaga o podwójnym liczeniu: marsz na bieżni z telefonem w kieszeni jest już w krokach, a telefon
noszony na zajęciach liczy też kroki taneczne.

**Kalorie liczą się już w trakcie pisania**, zanim ktoś naciśnie „Zapisz”, żeby dało się je
porównać z bieżnią. Podgląd pokazuje dwie liczby: kalorie **aktywne** (ponad spoczynek, to
główna liczba w całej aplikacji) i sumę **razem ze spoczynkiem** — tę zwykle pokazuje
wyświetlacz. Aktywne, bo tak ACSM liczy wydatek przy planowaniu ruchu i tak zegarki podają
„energię aktywną”; suma z bieżni dolicza godzinę siedzenia, która i tak by się spaliła.

**Skąd liczby:**

| Ruch | Metoda | Źródło |
| --- | --- | --- |
| Kroki | droga = kroki × krok (41,4% wzrostu, bez wzrostu 70 cm), koszt marszu ACSM | równanie ACSM na marsz |
| Bieżnia | marsz: 0,1·v + 1,8·v·nachylenie + 3,5; bieg: 0,2·v + 0,9·v·nachylenie + 3,5 | równania ACSM |
| Rower, prędkość | tabela MET według prędkości, liniowo między środkami przedziałów | Compendium 2024, kody 01018–01060 |
| Rower, moc | 1,8 · waty · 6,12 / masa + 7 | równanie ACSM dla cykloergometru |
| Taniec | udział tańca × MET tańca + reszta × 1,5 MET słuchania | Compendium 2024: para 4,8 (03090), solo 5,0 (03010), stanie 1,5 (07041) |
| Ćwiczenia siłowe | MET rodzaju pracy × czas serii z przerwami | Compendium 2024, m.in. 02052, 02054, 02058 |

Między 6 a 8 km/h bieżnia przechodzi **płynnie** od wzoru na marsz do wzoru na bieg — twarde
przełączenie dawało skok z 4,8 na 8,6 MET przy jednej dziesiątej km/h. Tabela roweru jest
połączona liniowo z tego samego powodu. Test pilnuje, żeby żaden krok o 0,1 km/h nie skakał.

**Zajęcia tańca to dwa kawałki: taniec i słuchanie.** Taniec z partnerem bierze wartość salsy
z partnerem (4,8 MET) — bliżej zajęć w szkole tańca niż towarzyski rekreacyjny (6,0), który
zakłada taniec bez przerw. Solo bierze kod zajęć baletu, nowoczesnego i jazzu (5,0), najszerszy
dla tańca bez partnera. Kiedy instruktor tłumaczy, stoi się i przestępuje z nogi na nogę —
1,5 MET. Do rachunku idą środki przedziałów: 85%, 50% i 25% tańca. Godzina w parze przy 80 kg
to ≈ 265 kcal ponad spoczynek przy tańcu bez przerw, ≈ 170 pół na pół i ≈ 105 przy dużej
ilości tłumaczenia. Taniec nie ma drogi, więc nie dokłada kilometrów.

**Kalorie treningu liczą się z serii, nie z zegara sesji.** Zegar mierzy też telefon odłożony
na godzinę i sesję zamkniętą następnego dnia. Każde ćwiczenie ma profil: MET z Compendium dla
rodzaju pracy (swingi 9,8, przysiady i martwe ciągi 5,0, trening oporowy 3,5, kalistenika 3,8,
deska i brzuch 2,8, noszenie ciężaru 6,0), tempo na powtórzenie i typową przerwę. MET treningu
oporowego to średnia z całej sesji razem z przerwami, więc przerwa liczy się po tym samym MET.
Wyjątkiem jest ruch ciągły — skakanka, ergometr, liny, sanie — gdzie MET opisuje samą pracę,
a przerwa idzie spokojniej, po 2 MET. Turecki wstaw i kompleks mają własne tempo, bo jedno
„powtórzenie” to pół minuty albo trzy ruchy.

Przy 80 kg wychodzi to tak: 10 tysięcy kroków ≈ 270 kcal, pół godziny bieżni 5 km/h ≈ 95 kcal
(135 razem ze spoczynkiem, jak na wyświetlaczu), godzina roweru 20 km/h ≈ 535 kcal, Trening A
na domyślnym poziomie ≈ 200 kcal w ok. 40 minut. To szacunek — pomiar tlenu u konkretnej osoby
potrafi odbiec o 20–30%, dlatego przy każdej liczbie stoi tylda, a większe liczby idą co 5 kcal.

**Kalorie są wszędzie, gdzie jest ruch:** w podsumowaniu po zamkniętym treningu (suma i rozbicie
na ćwiczenia), w historii treningów w profilu, przy każdej sesji w historii ćwiczenia (i suma
z całej historii), w szacunku „ile to potrwa i ile spali” przy treningu na dziś i na liście
treningów, na podstronie ćwiczenia w atlasie (pozycja Compendium i jedna sesja na twoim poziomie),
a na ekranie kroków — dzień i siedem dni ze wszystkiego razem: wpisów, treningów i przekąsek.

**Waga jest dziennikiem, nie jedną liczbą.** Kalorie zależą od wagi wprost, a waga się zmienia —
często właśnie dlatego, że ktoś liczy kalorie. Każdy ruch liczy się z wagi obowiązującej w jego
dniu, więc nowe ważenie nie przepisuje historii. Ruch sprzed pierwszego ważenia bierze pierwsze
ważenie. **Bez wagi aplikacja nie zgaduje** — zapisuje drogę i czas, a kalorie pokazuje, gdy
tylko waga się pojawi, także dla wcześniejszych wpisów. Formularz pyta o wagę sam, dopóki jej
nie ma; później zmienia się ją w profilu, obok opcjonalnego wzrostu (tylko do długości kroku).

**Ruch wpisany ręcznie nie jest treningiem**, tak jak przekąska: nie trafia do dziennika
i nie rusza poziomów ćwiczeń ani planu. Daje za to doświadczenie postaci i własne odznaki.

**Doświadczenie płaci za minuty ruchu, nie za liczby.** Miarą są minuty według zaleceń WHO
(150–300 tygodniowo): bieżnia i rower od 3 MET to minuty umiarkowane, od 6 MET — podwójne, bo
tak WHO przelicza bieg na marsz; lżej niż 3 MET to zero. **Z zajęć tańca liczy się sam taniec**,
z intensywnością tańca, a nie średniej zajęć: godzina pół na pół to 30 minut ruchu
umiarkowanego. Średnia z tłumaczeniem wyszłaby tuż nad progiem 3 MET i dała całą godzinę, a przy
dużej ilości tłumaczenia — zero; jedno i drugie mija się z tym, co działo się na sali. WHO od
2020 roku liczy każdy ruch bez minimalnej długości odcinka, więc kawałki tańca między
objaśnieniami wchodzą w całości. Z kroków liczy się nadwyżka ponad
5 000 — tyle robi się bez wychodzenia z domu, poniżej zaczyna się według badań Tudor-Locke
tryb siedzący — przy 100 krokach na minutę. **Minuta to 1 XP, do 50 dziennie.** Sufit to
połowa treningu: 50 minut to z nawiązką dzienna porcja z WHO, a spacer ma dokładać, a nie
zastępować sesję, wokół której zbudowana jest cała aplikacja. Wpis jest ręczny i nikt go nie
sprawdza, więc sufit jest też bezpiecznikiem na zero dopisane przez pomyłkę. Podgląd w formularzu
mówi, ile minut da wpis, karta na ekranie Dziś — ile ich dziś jest i ile dały XP, a ekran kroków
pokazuje pasek bieżącego tygodnia na tle 150 minut WHO.

**Osiem rodzin odznak w grupie „Kroki i cardio”:**

| Rodzina | Co liczy | Progi |
| --- | --- | --- |
| Kroki w nogach | wszystkie kroki z historii | od 10 tys. do 5 mln |
| Dzień na nogach | najwięcej kroków w jednym dniu | od 5 do 30 tys. |
| Osiem tysięcy | dni z co najmniej 8 000 kroków | od 1 do 730 dni |
| Bieżnia i rower | wyjścia od dziesięciu minut | od 1 do 400 |
| Na parkiecie | zajęcia tańca od dziesięciu minut | od 1 do 200 |
| Kilometry | droga z kroków, bieżni i roweru na zewnątrz | od 10 do 5 000 km |
| Tydzień według WHO | tygodnie pn–nd ze 150 minutami ruchu, także z tańca | od 1 do 104 |
| Dzień po dniu | ciąg dni z rzędu z co najmniej 20 minutami ruchu | od 3 do 365 dni |

Cel dzienny to **8 000 kroków, nie 10 000**: metaanaliza Palucha i in. (Lancet Public Health,
2022) pokazuje, że korzyść dla zdrowia rośnie mniej więcej do 6–8 tysięcy u starszych i 8–10
u młodszych, a dalej się wypłaszcza. Okrągłe dziesięć tysięcy wymyśliła reklama krokomierza.
**Żadna odznaka nie liczy kalorii**, bo kalorie rosną razem z masą ciała — odznaka przychodziłaby
szybciej temu, kto waży więcej.

**Usunięcie wpisu cofa to, co dał** — tak jak przy przekąskach. Poprawka kroków na ten sam dzień
w dół (literówka „90 000” zamiast „9 000”) też cofa progi, których nowa liczba nie uzasadnia.
Doświadczenie cofa się samo, bo i tak liczy się od zera z wpisów.

Pusty dzień ma żart, jak przekąski — z bieżni, roweru, parkietu i telefonu, nigdy z wagi ani z jedzenia.
Obok stoją kalorie i masa ciała, a to najłatwiejsze miejsce, żeby komuś dokuczyć; test pilnuje
słów.

## Jedzenie

Zakładka z czterema sekcjami — dawny projekt Produkty PL, przepisany na wygląd i zasady tej
aplikacji. Dane produktów: [Open Food Facts](https://world.openfoodfacts.org), ceny:
[Open Prices](https://prices.openfoodfacts.org), sklepy i mapa: OpenStreetMap.

**Dziennik** (`#/jedzenie`) — plan żywienia, który się nagina:

- **Profil diety** (podstrona): płeć, wiek, wzrost, waga startowa i docelowa, aktywność i kroki.
  Na bieżąco liczy podstawowe spalanie (wzór Mifflina-St Jeora), spalanie dzienne, deficyt, tempo
  i datę dojścia do celu; ostrzega, gdy cel kalorii jest poniżej podstawowego spalania albo tempo
  przekracza 1% masy ciała na tydzień. Sposób odżywiania: redukcja wysokobiałkowa, zbilansowany,
  low carb, keto albo sportowy — każdy wyznacza cele makro i ocenia jedzenie („pasuje”, „może być”,
  „nie pasuje”, zawsze z powodem).
- **Plan z Excela**: „Wczytaj plan z Excela” czyta arkusz w przeglądarce — dni wzorcowe, warianty,
  potrawy z kaloriami i makro, parametry. Plik nigdzie nie trafia.
- **Dziś**, od góry: **pytanie o wagę** („Ile dziś ważysz?” z ostatnim ważeniem i radą „rano, po
  toalecie, przed jedzeniem”; po zapisie jedna linijka „Waga: 82,4 kg” ze „Zmień”), bilans dnia
  z „Dodaj zjedzone” i „Ulubione (N)”, **zjedzone** zaraz pod nimi, plan dnia (z nazwą planu
  z zakupami, a gdy plan zaczyna się później — „Plan „…” zaczyna się …”), „Co teraz?”, kroki i ruch,
  na końcu wejścia do Planu posiłków, Moich planów, Postępu i Profilu diety. Bilans dnia z paskami
  kalorii, białka, węglowodanów i tłuszczu. Pozycje planu można
  odhaczyć, pominąć albo zamienić na coś o podobnej kaloryczności (±12%); bez planu „Propozycja
  dnia” układa posiłki z tego, co w pobliżu i w domu. „Dodaj zjedzone” szuka we własnych
  zestawach i jedzeniu, planie, przepisach, menu lokali („big mac”, „latte grande”) i produktach —
  najbliższe nazwy pierwsze; gramaturę da się zmienić, a obiad poza sieciami wpisać samymi
  kaloriami. **Zestaw** składa kilka rzeczy jedzonych razem („Banan + batonik”): każda z gramaturą,
  suma na bieżąco, w dzienniku jeden wpis. Zaznaczone „Zapisz jako mój zestaw” zostawia go na
  później — wraca pierwszy w wyszukiwaniu i w propozycjach („Twój zestaw”), a usuwa się go
  w Profilu diety → Twoje dane. Zestaw trzyma kopie części, jak wpisy dziennika, więc nowa baza
  produktów nie zmienia tego samego śniadania. **Ulubione**: gwiazdką oznacza się dowolne jedzenie —
  w „Dodaj zjedzone”, w szczegółach produktu, w karcie pozycji lokalu i przy tym, co już zjedzone.
  „Ulubione (N)” pod bilansem otwiera arkusz z pełną listą i „+ Zjadłem” (zapis jednym stuknięciem,
  w ilości z gwiazdki; arkusz zostaje otwarty, a jego pasek potwierdza zapis), najczęściej jedzone na
  górze — każdy zapis takiego jedzenia liczy się do kolejności, ale w otwartym arkuszu wiersze stoją
  w miejscu; od dziewięciu ulubionych — z szukaniem.
  W „Dodaj zjedzone” ulubione stoją pierwsze, z „+” do zapisu bez otwierania, a w „Co teraz?” dostają
  niewielką premię („Twoje ulubione”). Ulubione to migawki jak zestawy: działają bez bazy produktów
  i offline; listę widać i czyści się w Profilu diety → Twoje dane. Cel dnia koryguje się według
  tygodnia — nadwyżka rozkłada się na kolejne dni (najwyżej 10% celu dziennie), niedojedzone kalorie
  wracają. „Co teraz?” podpowiada resztę dnia z gwiazdką
  przy najlepszych i powodem.
- **Postęp** (podstrona): wykres wagi z planem, prognozą od ostatniego ważenia i celem, kalorie
  z 14 dni i średnie makro z tygodnia.

**Cel w trzech kierunkach.** Tempo w profilu diety to −1…−0,25 kg na tydzień, **utrzymanie**
i **+0,25 kg/tydz.** (spokojne budowanie masy). Kierunek wynika z wagi docelowej wobec startowej:
przy celu wyżej nadwyżka nie jest ostrzeżeniem, ostrzeżeniem jest deficyt i przybieranie szybsze niż
0,5% masy ciała na tydzień (zwykle więcej tłuszczu niż mięśni); data celu to pierwszy dzień na celu
albo nad nim, a przy utrzymaniu daty nie ma.

**Plan z zakupami (meal prep)** — u góry „Planu posiłków” (`#/jedzenie/plan`). Jedzenie na 5–14
kolejnych dni dla jednej osoby, kupione w **jednym sklepie stacjonarnym albo w sklepie i jednym
sklepie internetowym** — nigdy w dwóch stacjonarnych, jak w przepisach. Formularz: od kiedy, na ile
dni, 3, 4 albo 5 posiłków, „Obiad z pudełka” albo „Obiad i kolacja z pudełka”, sklep (najbliższy
z „W pobliżu”, potem ten z profilu), zamówienie przez internet (przy każdym sklepie: ile przepisów
dokłada), „Bez mięsa”, „Bez ryb i owoców morza”, „Bez jajek”.

- **Gotowanie na zapas**: dni dzielą się na bloki najwyżej czterech — danie ugotowane pierwszego
  dnia bloku je się tego dnia i trzy kolejne (USDA FSIS: ugotowane jedzenie 3–4 dni w lodówce).
  Tydzień to 4 + 3, czyli klasyczne gotowanie w niedzielę i w środę. Każdy blok ma własne danie na
  obiad (przy „obiad i kolacja” — dwa), równe pudełka i ilości na całość; śniadania i przekąski idą
  dwoma na zmianę, kolacje na świeżo do 20 minut, gotowce tylko jako przekąski. To samo danie nie
  trafia dwa razy na jeden dzień.
- **Pod styl i cel**: tylko przepisy kupione w całości w koszyku planu, nigdy „nie pasuje” do
  sposobu odżywiania (przy limicie węglowodanów — keto, low carb — tylko „pasuje”, a limitu nie
  przekracza żaden dzień). Porcje co ćwierć (½–3), a do nich dodatki: ryż albo ziemniaki do
  pudełka, bułka i awokado do wytrawnego śniadania, banan i orzechy do słodkiego, oliwa w łyżeczkach
  (4,5 g) i łyżkach (13,5 g); przy keto i low carb bez skrobi i banana, za to z orzechami i oliwą.
  Dodatki rosną z wielkością posiłku, więc plan karmi od 1200 do 3500 kcal. Dzień trafia w cel
  kalorii (nigdy ponad 5% — tyle dziennik nazywa „ponad cel” — najwyżej 7% pod; na prawdziwych danych
  zwykle ±2%), białko i tłuszcz nie spadają poniżej minimum; dzień, którego koszyk nie domyka, plan
  pokazuje i mówi, co pomoże. Ulubione przepisy mają pierwszeństwo, wspólne składniki też (jedno
  opakowanie skyru na dwa przepisy). „Inny plan” i „Wymień” zmieniają plan od dziś: zjedzone dni
  i ugotowane pudełka zostają. **„Wymień” otwiera listę przepisów, które mogą zająć to miejsce** —
  według tych samych zasad co plan (rola, koszyk, styl, przy limicie węglowodanów w pudełkach tylko
  „pasuje”), najlepszy dla planu na górze („najlepiej pasuje”), z kaloriami i makro na porcję,
  czasem, „pasuje do stylu”, „wspólne zakupy” i gwiazdką ulubionych; od dziewięciu — z szukaniem.
  Wybrany wchodzi do całego planu, a porcje i lista idą za nim. Wymieniony wcześniej też jest na
  liście („wcześniej wymieniony”): „Inny plan” go nie przywróci, ale można go wybrać samemu.
- **Plan idzie za postępami (check-in)**: przed każdym planem 28 ostatnich dni — trend z ważeń
  i średnia z zapisów jedzenia — mówi, ile naprawdę spalasz (zjedzone minus zmiana wagi razy energia
  w kilogramie). Różnicę wobec wzoru check-in przyjmuje tylko w części pewnej (ponad dwa błędy
  standardowe trendu — skacząca waga i rzadkie ważenia nie ruszają celu), od 100 kcal, najwyżej
  o 250 kcal naraz, nigdy poniżej podstawowej przemiany materii albo 1500 kcal u mężczyzn i 1200
  u kobiet. Zmierzona różnica zostaje w profilu jako **korekta spalania** — część wzoru od tej pory:
  tempo, cele według tempa, prognoza i kolejny check-in liczą z nią, więc ten sam błąd nie odejmuje się
  dwa razy (w „Zaawansowanych” można ją zmienić albo wyzerować). Po dojściu do wagi docelowej —
  utrzymanie, krokami do 500 kcal. Potrzeba co najmniej 5 ważeń z 14 dni i pełnych zapisów z ¾ tych
  dni (dzień zapisany poniżej połowy celu to dzień niedopisany); spalanie poza 0,8–2,5 × BMR to
  niepełne zapisy albo woda. Dopasowany cel jest zaznaczony jako zalecany, a plan zapisuje go
  w profilu razem z planem — dziennik i plan liczą tak samo. Nowy cel zaczyna własny bilans tygodnia
  (dni zjedzone na stary cel nie są nadwyżką), a nadwyżka tygodnia rozkłada się od dziś na dni do
  niedzieli, raz.
- **Lista zakupów** (`#/jedzenie/zakupy`, także skrót aplikacji): wizyta w sklepie dział po dziale,
  zamówienie przez internet z odnośnikami do produktów, „Sprawdź w domu” (oliwa, przyprawy, białko
  w proszku). Opakowania wybranego produktu („3 opak. · po 450 g”, puszki tuńczyka i fasoli liczone po
  odsączeniu), sztuki zaokrąglone w górę („10 szt.” jajek) albo gramy; ceny orientacyjne, a suma
  tylko wtedy, gdy cenę ma co najmniej połowa pozycji. Surowe mięso
  i ryba potrzebne od trzeciego dnia: „zamroź po zakupach”, a dzień przed gotowaniem dziennik
  przypomina, co przełożyć do lodówki. Odhaczenia zostają przy planie i działają bez zasięgu i bez
  bazy produktów; „Udostępnij listę” wysyła ją jako tekst.
- **W dzienniku**: w dni planu „Plan na ten dzień” z nazwą planu — posiłki z porcją i dodatkami do
  odhaczenia („Zjadłem” zapisuje je jak każde jedzenie), w dniu gotowania „Dziś gotujesz”. Plan
  z zakupami ma w swoje dni pierwszeństwo przed planem z arkusza i „Propozycją dnia”; gdzie plany
  się nakładają, obowiązuje **ten ustawiony ostatnio** (ułożony, przesunięty albo wybrany przez
  „Ustaw w dzienniku”), więc następny tydzień można ułożyć zawczasu — plan i lista pokazują wtedy
  bieżący, a ułożony na kolejne dni jest pod przełącznikiem („Teraz” · „Następny”, adres `?plan=`).
- **Moje plany** (`#/jedzenie/plany`, „Moje plany (N)” nad planem): każdy plan na urządzeniu,
  najpóźniej zaczynające się na górze, z nazwą, datami, sklepami i stanem (trwa — dzień n z N,
  od…, zakończony). Plan ma **własną nazwę** (pole w formularzu albo „Zmień nazwę”); bez niej
  nazywa się stylem i sklepem („Sportowa · Biedronka”) — daty stoją obok, nie w nazwie.
  **„Zmień daty”** przesuwa cały plan na nowy pierwszy dzień (13 dni wstecz do 90 naprzód): te same
  przepisy, porcje, pudełka i lista, przesunięte gotowanie i rozmrażanie; odhaczone zostają, chyba że
  plan zaczyna się po swoim dawnym końcu — wtedy lista startuje czysta (do zmiany jednym polem).
  Zakończony plan otwiera się z listy i tak się go powtarza. Gdy w część dni plan zasłania inny,
  plan i lista mówią to wprost, z „Ustaw w dzienniku”.
- Plan to migawka w bazie diety (tabela `prep`; bez nazwy — 12 najnowszych, z nazwą — dopóki się go
  nie usunie): przepisy, porcje, gotowanie
  i lista nie zmieniają się z nową bazą produktów. Jest w kopii zapasowej i znika z „Usuń wszystkie
  dane”. `npm run food:check-prep` układa tydzień na prawdziwych danych w czterech najlepszych
  sklepach (i z zamówieniem) w każdym stylu.

**Jedno ciało, jedno źródło.** Waga z dziennika jedzenia to ta sama waga co w profilu i na karcie
ważenia — zapis z diety trafia do dziennika wagi. Kroki dieta bierze z wpisów, zegarka Garmin i telefonu,
a wpis kroków z diety staje się zwykłym wpisem kroków (z doświadczeniem i odznakami jak każdy inny).
Wzrost jest jeden. Dzień z treningiem i „Ruch dziś” (kalorie treningu i cardio) dieta czyta
z dziennika treningów — **jako informację, nie dodatek do celu**: współczynnik aktywności w profilu
już zakłada treningi, a doliczanie spalonych kalorii liczyłoby je dwa razy. Prognoza wagi liczy
kroki z każdego dnia, także z dni bez wpisu w diecie.

**Przepisy** (`#/przepisy`): zawsze więcej białka niż węglowodanów i więcej białka niż tłuszczu —
na porcję, z prawdziwych produktów. Na początku listy **gotowce** (rodzaj „Gotowiec”): 11 zestawów
kupowanych w jednym sklepie i jedzonych z opakowania, bez gotowania i bez naczyń — banan i baton
białkowy, serek wiejski z bułką grahamką, kefir z bułką, łosoś na pieczywie chrupkim… Gotowiec ma
własną zasadę, **co najmniej 15 g białka w zestawie**, bo banan z batonem to przekąska
węglowodanowa z białkiem, a nie przepis białkowy; baton i napój proteinowy liczą się całym
opakowaniem wybranego produktu. Trzy grupy czasu (szybkie do 7 minut, chwilę dłużej do 20,
dłużej w domu), rodzaje i sklep. Każda karta pokazuje sklep, w którym kupisz **wszystkie**
składniki naraz, z przełączaniem na inny; każdy składnik da się zamienić na inny produkt z tego
samego sklepu, a zamiana łamiąca zasadę jest oznaczona. Niżej gotowe produkty spełniające zasadę
na 100 g.

**Produkty** (`#/produkty`): prawie 40 tysięcy produktów sprzedawanych w Polsce (29 tysięcy z Open Food Facts, reszta ze sklepów internetowych i z Selgrosa) — zdjęcia, wartości
odżywcze, skład, alergeny, dodatki, Nutri-Score, NOVA, Eco-Score i ceny. Karty albo tabela,
sortowanie po każdej wartości, filtry z licznikami w arkuszu („Pokaż N produktów”), wyszukiwanie
po nazwie, marce i kodzie kreskowym bez względu na polskie znaki. Cały stan ekranu stoi w adresie
(`#/produkty?q=skyr&ns=a`), więc link albo odświeżenie odtwarza widok, a Wstecz zamyka otwarty
produkt.

**Lokale** (`#/lokale`, kafelek na górze Produktów): menu 18 sieci gastronomicznych działających
w Polsce — 1189 pozycji z kaloriami, białkiem, węglowodanami (z cukrami), tłuszczem (z nasyconymi)
i solą **na porcję, tak jak podaje sieć**, a przy znanej masie porcji także na 100 g. Wyszukiwanie
idzie przez wszystkie menu naraz; menu sieci (`#/lokale/kfc`) ma źródło z datą sprawdzenia,
„Najwięcej białka” (co najmniej 15 g w porcji, najwięcej na kalorię), kategorie, kolejność, ocenę
pod profil diety i „Dodaj do dziennika”. Podstrona Produktów, a nie piąta sekcja: pięć pozycji
przełącznika nie mieści się na ekranie 320 px.

| Rodzaj | Sieci (źródło: własna tabela sieci) |
| --- | --- |
| Fast food | McDonald's (10.2026), KFC (09.2026), Burger King (09.2026), MAX Premium Burgers, Popeyes (10.2026), Subway (05.2024, tabela dla Europy Środkowo-Wschodniej), Pasibus (09.2026) |
| Kawiarnie | Starbucks, Costa Coffee (10.2026), Green Caffè Nero (09.2026) |
| Pizzerie | Pizza Hut (**tabela z 05.2019** — jedyna, jaką sieć podlinkowuje), T-Pizza, dawniej Telepizza (12.2025), Da Grasso (08.2026) |
| Bary | Salad Story (09.2026) |
| Stacje i sklepy | ORLEN Stop Cafe, Circle K, bp / Wild Bean Cafe (10.2026), Żabka Café (04.2025) |

Liczby są przepisane z tabel PDF, stron i API samych sieci — bez agregatorów typu fatsecret.
`src/food/restaurants/catalog.test.ts` sprawdza każdą pozycję jak bazę produktów: energia z makro
(4/4/9 kcal na gram) w granicach ±15 % (±25 kcal dla małych pozycji), cukry nie ponad węglowodany,
nasycone nie ponad tłuszcz. Pozycje, które tak podaje **sama sieć** (23, sprawdzone ze źródłem),
stoją w `source.inconsistent` — zostają, ale lista i karta mówią „liczby sieci się nie zgadzają”,
a do „Najwięcej białka” nie trafiają. Pełnych makroskładników nie publikuje Domino's, Sphinx, Shell
i Bobby Burger; Tim Hortons, Dunkin' i Krispy Kreme nie działają w Polsce, a North Fish ogłosił
upadłość — tych sieci nie ma. Menu przychodzi własną paczką (`restaurants/catalog`, ok. 49 kB
gzip), dopiero z Lokalami albo z „Dodaj zjedzone”.

Aktualizacja: plik sieci w `src/food/restaurants/data/<sieć>.json` (schemat w `types.ts`: porcja,
masa porcji, wartości na porcję, źródło z datą `checked`, rynek); test powie, które liczby się nie
zgadzają.

**Sklepy internetowe**: do bazy dochodzą produkty dziesięciu sklepów i producentów — Myprotein,
GuiltFree, Diet-Food, BeKeto, Cocoa, FitIron, Bezmięsny Mięsny, PrepMyMeal oraz strony producentów
Feel Fit i CocoFarm (ich produkty kupuje się w innych sklepach internetowych) — 3208 pozycji
z wartościami odżywczymi na 100 g, ceną i odnośnikiem do strony produktu; najwięcej w GuiltFree
(2678, sklep z produktami wielu marek). PrepMyMeal to 21 mrożonych dań z „BOX 24 DAŃ” — każde danie
to opakowanie XL na 2 porcje po 500 g, więc w dzienniku domyślnie jedna porcja. Produkt z kodem EAN,
który jest już w Open Food Facts albo w innym sklepie, nie dubluje się: dostaje ofertę sklepu (sklep,
link, cenę) — tak 139 produktów z Open Food Facts ma dziś link do sklepu, a 35 jest w dwóch sklepach
naraz. Baza rośnie do 32 289 produktów. Karta
produktu mówi „Sklep internetowy: …”, szczegóły mają odnośniki z ceną i datą sprawdzenia, filtry —
„W sklepach internetowych”. Z danych sklepów wzięte są tylko fakty: nazwa, gramatura, wartości
odżywcze, cena, adres strony, EAN — bez opisów i zdjęć, zebrane zgodnie z `robots.txt` sklepu.
Dane leżą w `src/food/online/data/<sklep>.json` (schemat w `types.ts`), a test sprawdza je jak
menu lokali; to, co błędnie podaje sama strona sklepu (np. słodycze bez cukru liczące poliole),
stoi w `inconsistent` — produkt zostaje z liczbami sklepu, szczegóły o tym mówią, a do przepisów
i gotowych produktów białkowych nie trafia. Paczka (`shopData`, ok. 295 kB po kompresji) ładuje się
razem z bazą produktów i jak ona nie wchodzi do instalacji aplikacji: service worker zapisuje jedną
kopię przy pierwszym wejściu w Jedzenie. Gdy się nie wczyta, baza przychodzi bez niej.

**Selgros**: produkty sieci hal Selgros (cash & carry) — 9931 produktów spożywczych z wyszukiwarki
na selgros.pl (`/znajdz-produkt`): nazwa, marka, EAN, wartości odżywcze na 100 g, alergeny i cena
regularna z jednej hali (Kraków), z datą. To sklep stacjonarny, nie internetowy: produkt dostaje
Selgros jako sklep (filtr sklepu, przepisy „Wszystko kupisz w: Selgros”, „W pobliżu”), cenę
„Selgros, Kraków” i odnośnik „Karta produktu w sieci” do strony produktu na selgros.pl — bez oferty
„kup przez internet”. Łączenie po EAN: 2698 produktów było już w Open Food Facts i zostają sobą
(nazwa, zdjęcia, Nutri-Score, cena z Open Prices), dostając Selgros jako sklep i odnośnik; 7233 są
nowe, więc baza rośnie do 39 497 produktów, a 833 z nich ma co najmniej 20 g białka w 100 g. Do bazy
trafiają tylko produkty z prawidłowym EAN-em i pełną, możliwą etykietą (kcal, białko, węglowodany,
tłuszcz; cukry nie więcej niż węglowodany, nasycone nie więcej niż tłuszcz); etykieta, w której
energia nie zgadza się z makro, stoi w `inconsistent` (179) — jak w sklepach internetowych.
Kategorie Selgrosa („Nabiał/Sery białe”) zamieniają się w tagi Open Food Facts z rodzicami, więc
filtry i dopasowania przepisów traktują produkt jak każdy inny; nazwy z wielkich liter zamieniają
się w zdania, a marka w nazwie zachowuje pisownię. Hala hurtowa (karta klienta, często duże
opakowania) w domyślnych propozycjach przepisów stoi **po** supermarketach — wybrana wprost
(filtr, „W pobliżu”, profil diety) działa jak każdy sklep. „W pobliżu” szuka też hal Selgros
i Makro (OpenStreetMap: `shop=wholesale` z marką). Dane zbiera `npm run food:selgros`: Playwright
przegląda dział po dziale tak, jak przeglądarka odwiedzającego, i bierze dane, które strona sama
pobiera — bez wyciągania klucza wyszukiwarki, z przerwą między stronami, zgodnie z `robots.txt`;
każda strona trafia do `node_modules/.cache/selgros`, więc przerwany przebieg się wznawia, a strona
starsza niż tydzień jest czytana ponownie; data przy cenie to dzień najstarszej strony. Cena
i gramatura dotyczą tej samej jednostki co EAN (sztuka, zgrzewka albo karton). Plik
`src/food/chains/data/selgros.json` (jeden produkt w wierszu, adres strony z szablonu i numeru
artykułu) jedzie w tej samej paczce co sklepy internetowe. Makro nie ma danych: makro.pl odpowiada
403 każdej automatycznej wizycie.

**Przepisy z produktów sklepów internetowych i zakupy w jak najmniej sklepach.** Czternaście
przepisów zbudowanych na tym, co sprzedają sklepy internetowe — naleśniki z białkowej mieszanki,
ciasto w kubku, jogurt z masłem orzechowym w proszku, wegański shake z białkiem roślinnym, skyr
z syropem zero, tosty na chlebie keto, keto penne z roślinnym boczkiem, pizza na keto spodzie,
wrap z roślinnym kebabem, makaron konjac z kurczakiem, kurczak w sosie zero z ryżem konjac i dwa
gotowce. Każdy przepis kupuje się w **koszyku**: w jednym sklepie, a gdy żaden
nie ma wszystkiego — w sklepie i sklepie internetowym albo w dwóch sklepach internetowych (nigdy
w dwóch stacjonarnych: jedna wizyta w jednym sklepie zostaje zasadą). Karta mówi „Kupisz
w 2 sklepach: Biedronka + Myprotein (sklep internetowy)” z odnośnikami do sklepów, linijka
składnika — z którego sklepu jest i prowadzi do strony produktu, a żetony przełączają koszyki.
Przepisy mają **„Układ listy: Według sklepów”** (`#/przepisy?uklad=sklepy`): zachłannie, najpierw
koszyk, w którym zrobisz najwięcej przepisów (także te z jednego jego sklepu), potem następny —
najmniej planów zakupów dla całej listy, z nagłówkiem „wizyta w sklepie i zamówienie przez
internet”. Filtr sklepu obejmuje sklepy internetowe („BeKeto · online”). „Co teraz?” i „W pobliżu”
zostają przy jednym sklepie stacjonarnym — przepis, który wymaga zamówienia, planuje się
w Przepisach.

**Klasyki kuchni polskiej w wersji białkowej.** Szesnaście przepisów na motywach otwartej
Książki kucharskiej z Wikibooks (pl.wikibooks.org, CC BY-SA 4.0): pyry
z gzikiem, leniwe, ryba po grecku, bigos z indykiem, ogórkowa z kurczakiem, potrawka, gołąbki
z indykiem, mielone z mizerią, szaszłyki z tzatziki, sałatka gyros, śledź w skyrze, jajka w sosie
szczypiorkowym, placki z cukinii z twarogiem, sernik na zimno bez cukru, pasta z twarogu
z awokado i białkowe racuchy z jabłkami. Z Wikibooks pochodzi danie i jego pomysł; ilości, zamiany
(skyr zamiast śmietany, indyk zamiast wieprzowiny, chudy twaróg, słodzik zamiast cukru) i tekst są
własne, a karta kończy się odnośnikiem „Na motywach przepisu …” do strony w Wikibooks i licencji
(tytuł z angielskiej książki kucharskiej ma `lang="en"`).
Każdy trzyma zasadę na porcję i ma koszyk jak reszta: piętnaście kupisz w jednym sklepie
stacjonarnym (ryba po grecku, bigos i gołąbki — w każdym), racuchy w sklepie i sklepie
internetowym (mieszanka na białkowe naleśniki z Myproteina). Nowe składniki: filet z indyka,
kapusta kiszona, biała i pekińska, ogórki kiszone, marchew, ziemniaki, awokado, mąka pszenna,
filety śledziowe i żelatyna.

**W pobliżu** (`#/w-poblizu`): lokalizacja (albo kliknięcie na mapie), sklepy spożywcze
z OpenStreetMap w promieniu od 500 m do 10 km i przepisy, które zrobisz w jednym pobliskim sklepie
(„Wszystko kupisz w: Żabka · 250 m”). Pozycja zaokrąglona do ok. 100 m idzie do serwera Overpass
(overpass-api.de, zapasowo overpass.private.coffee), kafelki mapy z tile.openstreetmap.org. Pozycji
nie ma w adresie, a ostatnie miejsce zostaje tylko na tym urządzeniu; odpowiedzi są pamiętane dobę.
Dziennik sam nie łączy się z siecią — sklepy w podpowiedziach bierze z ostatniego wyszukiwania.

**Dane produktów są w repozytorium**: `data/food/products.json.gz` (3,3 MB zamiast 24 MB JSON-a).
Build wydaje go jako `data/products.<hasz>.json.gz`, a przeglądarka rozpakowuje go sama
(`DecompressionStream`, a w starszych przeglądarkach fflate). Plik pobiera się dopiero przy wejściu
w produkty, przepisy, sklepy albo wyszukiwanie w dzienniku — nie ma go w zapisanej powłoce aplikacji.
Ekrany treningu nie wczytują ani jego, ani kodu mapy i bazy diety; ten kod service worker trzyma
w zapasie na pracę offline, ale uruchamia go dopiero Jedzenie. Hasz w nazwie zmienia się tylko
z nowymi danymi, więc service worker trzyma jedną kopię bazy, dopóki nie przyjdzie nowa.

Nowa baza: `npm run food:data` (taksonomie, ceny w PLN i złożenie pliku) z wyciągu produktów
z `countries_tags` = `en:poland` pełnego zrzutu Open Food Facts w `data/food/raw/off_poland.csv`
(surowe pliki nie trafiają do gita):

```bash
LC_ALL=C awk -F'\t' 'NR==1 || $41 ~ /(^|,)en:poland(,|$)/' en.openfoodfacts.org.products.csv > data/food/raw/off_poland.csv
npm run food:data
npm run food:check-recipes   # pokrycie przepisów na nowych danych
```

Licencje: baza Open Food Facts — ODbL, zdjęcia — CC BY-SA, mapa — © autorzy OpenStreetMap.
Dane tworzą użytkownicy, więc bywają niepełne; wartości spoza fizycznego zakresu (np. 3000 kcal
w 100 g) są odrzucane.

## Zegarek Garmin

Kroki, przejazdy rowerem, tętno, stres i Body Battery przychodzą z zegarka same, bez
przepisywania. Na zegarku działa mała aplikacja GYM TRACKER (`garmin/`, Connect IQ), która co
pół godziny wysyła zaszyfrowany ostatni tydzień, a aplikacja w przeglądarce odbiera go przy
otwarciu i po powrocie na ekran.

**Dlaczego własna aplikacja na zegarek.** Oficjalne API Garmina przyjmuje tylko firmy, a od
wiosny 2026 roku nowych zgłoszeń nie przyjmuje wcale. Logowanie do Garmin Connect cudzym
hasłem łamie regulamin i kazałoby serwerowi trzymać hasła. Apple Health i Health Connect są
poza zasięgiem strony — czyta je osobna aplikacja na telefon (niżej, „Zdrowie z telefonu”). Aplikacja Connect IQ czyta dane na zegarku i wysyła je przez aplikację
Garmin Connect na telefonie — bez niczyjej zgody i bez haseł.

**Serwer nie umie przeczytać ani jednej liczby.** W karcie „Zegarek Garmin” w ustawieniach
powstaje klucz (32 losowe bajty), który wkleja się raz w ustawieniach aplikacji na zegarku,
w Garmin Connect na telefonie. Zegarek szyfruje paczkę AES-256 i podpisuje HMAC-SHA256 kluczami
wyprowadzonymi z tego klucza; serwer przechowuje tylko najnowszy szyfrogram, najwyżej tydzień.
Tętno i stres to dane o zdrowiu, więc serwer, który miał nic nie wiedzieć o ludziach,
dalej nic nie wie. Klucz nie trafia do eksportu danych — plik z kopią treningów nie otwiera
danych o zdrowiu. Na drugim urządzeniu wkleja się ten sam klucz przez „Mam już klucz”.

**Jak to się liczy.**

- **Kroki** — z dwóch liczb na ten sam dzień, wpisanej i z zegarka, liczy się **wyższa**.
  Niższa nie przepada: czeka w zapisie i wraca, gdyby druga zniknęła. Przy remisie zostaje
  wpis ręczny, bo ten da się usunąć. Formularz mówi, co podał zegarek, zanim ktoś wpisze swoją.
- **Przejazdy rowerem** z drogą stają się wpisami „Rower”: średnia prędkość z drogi i czasu.
  Formularz roweru ostrzega, że ten przejazd już jest — drugi wpis policzyłby się dwa razy.
- **Biegi i marsze nie stają się wpisami.** Ich kroki są już w krokach dnia.
- **Tętno, stres i Body Battery** tylko się pokazują, na ekranie kroków i cardio, bez
  punktów i bez oceny — „za wysokie” albo „w normie” mówi lekarz, nie aplikacja.

Wpisy z zegarka nie leżą w zapisie: w zapisie są liczby z zegarka (`watch`), a wpisy ruchu
wyprowadza z nich `cardioOf` przy każdym otwarciu — tak jak wszystko inne. Dlatego kalorie,
minuty ruchu, doświadczenie i odznaki działają bez jednej zmiany, a wpisu z zegarka nie da się
usunąć (nie ma krzyżyka): zegarek przysłałby go znowu. Nowa paczka, która obniża kroki dnia
(zegarek poprawił licznik), cofa progi tak samo jak poprawka wpisu. Paczki nie odbiera się
w trakcie treningu — okno z odznaką w środku serii to ostatnie, czego ktoś potrzebuje.

Zegarek wysyła za każdym razem cały tydzień, więc dzień bez telefonu w pobliżu uzupełni się
przy następnej wysyłce. Minimalny zegarek to Connect IQ 3.2; stres i Body Battery wymagają 3.3 —
gdzie ich nie ma, stoi „—”.

**Snu nie ma i z tej drogi nie będzie.** Wynik snu Connect IQ podaje tylko przez Complications,
a te może czytać wyłącznie tarcza zegarka — aplikacja dostaje odmowę już przy kompilacji.
Paczka ma na niego miejsce, a ekran umie go pokazać, gdyby kiedyś przyszedł z innego źródła.

Karta zegarka pojawia się, gdy build zna adres serwera i adres aplikacji w Connect IQ Store
(zmienna `GARMIN_APP_URL` w GitHubie). Wdrożenie: `garmin/README.md` i `server/api/README.md`.

## Zdrowie z telefonu

Kroki, przejazdy rowerem, tętno, sen i waga z **Apple Zdrowie** (iPhone) i **Health Connect**
(Android) przychodzą same — razem z tym, co zapisują tam zegarki i wagi innych firm: Garmin
Connect, Fitbit, Samsung Health, Withings czy Oura piszą do tych dwóch miejsc, więc jedno
połączenie z telefonem obejmuje większość urządzeń.

**Zegarek Garmin — najprostsza droga.** Kto ma Garmina, ma też na telefonie Garmin Connect.
Wystarczy w nim włączyć udostępnianie do Apple Zdrowie albo Health Connect (Ustawienia →
Połączone aplikacje), a dalej wszystko idzie tą drogą: kroki, sen, tętno, waga i treningi
z zegarka. Karta mówi o tym w pierwszym kroku, a aplikacja na telefonie przypomina, gdy nie
dostaje żadnych danych. Przycisku „Zaloguj przez Garmin” nie ma i na razie nie będzie: oficjalne
API Garmina przyjmuje tylko firmy, a od wiosny 2026 roku nowych zgłoszeń nie przyjmuje wcale.
Własna aplikacja na zegarek (część „Zegarek Garmin”) dokłada tylko stres i Body Battery — tych
dwóch liczb Garmin Connect do Zdrowia ani Health Connect nie przekazuje.

**Dlaczego osobna aplikacja na telefon.** Żadna przeglądarka nie daje dostępu do Apple Zdrowie
ani Health Connect, także strona dodana do ekranu początkowego. Czyta je tylko kod natywny.
Zamiast przenosić całą aplikację do natywnej skorupy (dane w niej leżałyby osobno od tych w
przeglądarce, a przypomnienia web push i service worker przestałyby działać), na telefonie
działa mała aplikacja **GYM TRACKER Zdrowie** (`health/`): czyta dane, szyfruje je i wysyła.
Strona zostaje jedynym miejscem, w którym dane żyją.

**Ta sama droga co zegarek.** W karcie „Zdrowie z telefonu” w ustawieniach powstaje klucz —
osobny od klucza zegarka, więc oba urządzenia mają własne skrzynki i odłącza się je osobno.
Klucz kopiuje się do schowka i wkleja w aplikacji przyciskiem „Wklej klucz”. Link z kluczem
otwierający aplikację byłby o stuknięcie szybszy, ale własny schemat adresu może zarejestrować
każda inna aplikacja i dostałaby klucz do danych o zdrowiu. Aplikacja pieczętuje paczkę tą
samą kopertą co zegarek (AES-256-CBC i HMAC-SHA256, `src/watchseal.ts`) i odkłada ją na tym
samym serwerze, w tych samych skrzynkach (`/garmin/*` — nazwa historyczna, serwer nie wie, kto
pisze). Wspólny wektor `health/vectors.json` sprawdzają testy strony, Androida i iPhone'a: jeśli
któraś strona się rozjedzie, test przestanie przechodzić.

**Co przychodzi.** Ostatnie dwa tygodnie, dzień po dniu według zegara telefonu: kroki, droga,
piętra, minuty „Ćwiczenia” (tylko iPhone — Android takiej liczby nie ma), tętno spoczynkowe,
tętno najniższe, średnie i najwyższe, sen z nocy, która skończyła się tego dnia (bez
przebudzeń, noc z iPhone'a i zegarka liczona raz), ostatnie ważenie dnia i przejazdy rowerem
z drogą. Innych treningów, surowych pomiarów ani położenia telefon nie wysyła — aplikacja ich
nie używa. iPhone budzi aplikację przy nowych danych (kroki najwyżej co godzinę), Android
sprawdza co godzinę; dane przychodzą też przy każdym otwarciu aplikacji na telefonie.

**Jak to się liczy.**

- **Kroki** — z trzech liczb na ten sam dzień, wpisanej, z zegarka i z telefonu, liczy się
  **najwyższa**, nigdy suma: mierzą to samo chodzenie, a telefon często ma już w sobie kroki
  zegarka. Przy remisie zostaje wpis ręczny, potem zegarek.
- **Przejazdy rowerem** stają się wpisami „Rower”, chyba że zegarek przysłał przejazd, który
  zaczął się w tych samych dziesięciu minutach — Garmin Connect kopiuje go do Apple Zdrowie.
- **Tętno, sen i waga** tylko się pokazują, w sekcji „Z telefonu” na ekranie kroków i cardio,
  bez punktów i bez oceny.
- **Waga nie wchodzi do dziennika sama.** Gdy telefon ma ważenie nowsze niż ostatnie w
  dzienniku (z ostatnich dwóch tygodni), karta „Waga i wzrost” proponuje „Wpisz do dziennika”
  z dniem tego ważenia. Kalorie liczą się z wagi z dnia ruchu — ciche nadpisanie mogłoby
  przykryć ważenie wpisane świadomie.

Wpisy z telefonu, jak z zegarka, wyprowadza `cardioOf` z liczb w zapisie (`phone`), więc mają
dopisek „z telefonu” i nie mają krzyżyka. „Usuń wszystkie dane” odłącza też telefon.

Karta pojawia się, gdy build zna adres serwera i adres co najmniej jednej aplikacji (zmienne
`HEALTH_IOS_URL` i `HEALTH_ANDROID_URL` w GitHubie). Pokazuje instrukcję dla telefonu, na
którym ją otwarto, a na komputerze obie. Build, podpis i publikacja: `health/README.md`.

## Atlas i sprzęt

Biblioteka ma **114 ćwiczeń** w siedmiu partiach ruchu: zawias biodrowy, przysiad, ciągnięcie,
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

Każde ćwiczenie z przypisanym wzorcem ruchu ma w atlasie animowaną sylwetkę rysowaną
w przeglądarce z kątów stawów — ruch wykonuje Gustaw albo Gosia. Szkielet jest ten sam, co
w wersji patyczkowej (te same osiemnaście ruchów, te same klatki, ta sama mimika), zmienia się
kreska: sierść z konturem, tors w kolorze koszulki postaci i profil goryla. **Nic tu nie pochodzi z cudzych nagrań,
bibliotek ruchu ani sklepów z modelami** — nie ma czyjegoś prawa autorskiego do pilnowania,
licencji do odnawiania, reklam przed odtworzeniem ani zapytań na zewnątrz. Sam manekin
nie kosztuje ani jednego zapytania — rysuje się z kilku kilobajtów liczb zapisanych
w paczce aplikacji. Filmy z YouTube stoją niżej na tej samej podstronie i są tam od wejścia:
miniatury dociągają się leniwie z `i.ytimg.com`, gdy dojedziesz do nich przewijaniem,
a odtwarzacz razem z ciasteczkami wchodzi dopiero po kliknięciu.

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

## Prowadzenie sesji i przerwy

**Na ekranie jest tylko to, co trzeba zrobić teraz.** Sesja domyślnie idzie seria po serii:
nazwa ćwiczenia, „Seria 2 z 3” (w obwodzie „Runda 2 z 3 · stacja 3 z 6”), cel — „10 powt. ·
16 kg” — i pole z celem już wpisanym, więc zwykle wystarczy jedno stuknięcie w „Zrobione”.
Wtedy rusza przerwa: duży licznik, „+30 s”, „Pomiń przerwę” i zapowiedź następnej serii.
Po ostatniej serii ćwiczenia, w trakcie przerwy, pada pytanie o zapas — na nim stoi
progresja. Lista ćwiczeń zostaje pod ręką i czyta ten sam zapis, więc przełączanie niczego
nie gubi, a trening skończony w połowie ćwiczenia zapisuje serie, które naprawdę zrobiono.

**Przerwa liczy się dalej po zgaszeniu ekranu i odświeżeniu strony**, bo w sesji zapisany jest
jej koniec jako chwila, a nie licznik. Ekran w trakcie sesji nie gaśnie (Screen Wake Lock),
a koniec przerwy telefon sygnalizuje dwoma piknięciami i wibracją (iPhone ze stron nie wibruje).

**Ile trwa przerwa.** Punkt wyjścia to rodzaj pracy, za ACSM: ciężkie wielostawowe 2 minuty,
izolacje i ciężar ciała krócej, balistyka najkrócej; para na zmianę ma 75 s między
partnerami. Trening może podać własną przerwę — „3 serie, 2 minuty przerwy” od trenera
dostaje dokładnie dwie minuty.

**Czy przerwy zmieniają się z treningu na trening?** W treningu siłowym — nigdy w dół.
Postęp idzie z powtórzeń i ciężaru, a dłuższa przerwa pozwala zrobić więcej pracy
w kolejnych seriach (Schoenfeld i in. 2016: 3 minuty dały więcej siły i masy niż minuta;
przegląd Grgica i in. 2018: w ćwiczeniach wielostawowych ponad 2 minuty). Przerwa rośnie
za to o 30 s, najwyżej o minutę, gdy w ostatnich sesjach ostatnia seria wyraźnie odstawała
od pierwszej (o 20% i więcej) — i wraca do punktu wyjścia, gdy serie pójdą równo. Ekran
przerwy mówi wtedy, dlaczego jest dłuższa. **W obwodzie odwrotnie:** celem jest kondycja,
więc ta sama praca w krótszym czasie to postęp. Każdy obwód zrobiony równo skraca przerwę
po rundzie o 15 s (do minuty), a rundy, które wyraźnie słabły, albo „Na maksa” wydłużają ją
z powrotem. Wszystko wynika z historii — nic nie jest zapamiętywane osobno.

**Obwód** to nowy rodzaj bloku obok serii pod rząd i pary: stacje po kolei, ok. 20 s na
przejście, pełna przerwa po rundzie. Rund jest tyle, ile serii ma najdłuższa stacja, a stacja
z mniejszą liczbą serii odpada z ostatnich rund — liczbę serii dalej prowadzi silnik progresji.
Doradca pilnuje, żeby sąsiednie stacje nie brały tej samej partii, a czas i kalorie treningu
liczą przejścia i przerwy po rundach. We własnym treningu: „Obwód — rundy” i przerwa po rundzie,
a dla serii pod rząd — przerwa z rodzaju ćwiczenia albo 60–180 s.

**Treningi od trenera.** Dwa plany trenera personalnego są w bibliotece: „3 serie, 2 minuty
przerwy” (swing, wyskoki z przysiadu, wyciskanie, goblet, podciąganie, pompki, core) i „Obwód
× 3” (wyskoki, pompki, unoszenie nóg, przysiad ze sztangą, unoszenie hantli bokiem, scyzoryki,
a po obwodzie podciąganie). Kolejność poprawiona tylko tam, gdzie łamała zasady — wyskoki
i swing na świeżo, stacje obwodu na zmianę partii — a brzuszki zostały poza obwodem, bo trzecia
stacja na brzuch dawała 12 serii na jedną partię. Do nich doszły cztery ćwiczenia z ciężarem
ciała: wyskoki z przysiadu, brzuszki, unoszenie nóg w leżeniu i scyzoryki. Ustalone przez
trenera 10/10/10 to punkt wyjścia — dalej powtórzenia i ciężar prowadzi progresja.

## Czas treningu

**Zegar w pasku.** Od „Zaczynam” do „Zamknij trening” w pasku aplikacji stoi licznik całego
treningu. Liczy się z chwili startu, a nie z tyknięć, więc odświeżenie strony ani zgaszony ekran
go nie cofają; w karcie w tle nie odświeża się wcale. Pokazywanie da się wyłączyć w Ustawieniach
(„Czas treningu w pasku”) albo na ekranie startu sesji — mierzenie trwa i tak, bo stoją na nim
statystyki i odznaki. Pauzy nie ma: trening z rozmową przy ławce też trwa tyle, ile trwa.

**Trening część po części.** Część to blok treningu: ćwiczenie robione seriami pod rząd, para
albo obwód — w parze i obwodzie ćwiczenia przeplatają się z założenia, więc liczenie ich osobno
byłoby zmyślaniem. Ekran startu pokazuje plan sesji („1. Przysiad · 3 × 8”, „2. Para: A + B”,
„3. Obwód: 5 stacji × 3 rundy”). Pierwsza część rusza z „Zaczynam”, a każda kolejna ze stuknięcia
**„Start: …”** na karcie przejścia. Część kończy się ostatnią zapisaną serią albo pominięciem tego,
co w niej zostało.

**Karta przejścia** stoi między częściami. Liczy w górę czas od końca poprzedniego ćwiczenia — to
jest liczba, o którą chodziło: ile mija, zanim zacznie się następne — a obok odlicza zalecaną
przerwę z paskiem, „+30 s” i tym samym sygnałem na koniec. Niżej pytanie o zapas po skończonym
ćwiczeniu, zapowiedź następnej części z celami i ciężarem, „Pomiń” oraz duży przycisk startu.
W trakcie części pasek nad serią mówi „Część 2 z 6 · na tym ćwiczeniu 04:12”, a podtytuł w pasku
aplikacji — „Część 2 z 6 · seria 5 z 18”.

**Po treningu** podsumowanie mówi: „Czas: 52 min · ćwiczenia 41 min · przejścia 6 min” i które
przejście było najdłuższe. Historia w profilu ma przy każdym treningu czas i rozwijany przebieg —
każda część i przejście przed nią. Podgląd treningu obok szacunku pokazuje „Twój średni czas”
z ostatnich sesji tego treningu, a karta do udostępnienia — minuty na treningu.

Widok listy też mierzy: zegar startuje z pierwszym zapisanym ćwiczeniem (od początku sesji),
ale części nie mają tam zaznaczonego startu, więc przejść się nie liczy. Treningi krótsze niż
3 minuty i dłuższe niż 4 godziny zostają w historii z czasem, ale poza statystykami i odznakami —
to zwykle zapomniane „Zamknij trening”.

**Cztery rodziny odznak w grupie „Czas na treningu”:**

| Rodzina | Co liczy | Progi |
| --- | --- | --- |
| Godziny na treningu | czas wszystkich treningów z zegarem | od 1 do 500 h |
| Dwie godziny w tygodniu | tygodnie pn–nd z co najmniej 120 minutami treningu | od 1 do 104 |
| Bez przestojów | treningi z co najmniej trzema częściami, w których każde przejście trwało do 4 minut | od 1 do 100 |
| Najdłuższy trening | najdłuższy pojedynczy trening | od 30 do 120 min |

**Żadna odznaka nie nagradza krótkiego treningu.** W treningu siłowym przerwa nie jest dźwignią
(patrz „Prowadzenie sesji i przerwy”), a odznaka za tempo pchałaby do jej skracania. Nagradzane
są tylko płynne przejścia — czas, którego nikt nie zaplanował.

## Ważenie

Ekran Dziś pyta o wagę raz dziennie, dopóki dzisiejszej nie ma w zapisie albo ktoś nie powie
„Nie dziś”, i mówi, jak ważyć: rano, po toalecie, przed jedzeniem i piciem, na tej samej wadze.
Po zapisie pokazuje dzisiejszą liczbę, **średnią z 7 dni** i zmianę średniej tydzień do tygodnia
— bo waga z dnia na dzień skacze o kilogram czy dwa z wodą i solą, a o kierunku mówi dopiero
średnia. Profil ma wykres ostatnich 30 ważeń. Liczby stoją bez oceny: bez „brawo” i bez
„uwaga” — co z nich wynika, to rozmowa z trenerem albo lekarzem. Na życzenie przychodzi też
przypomnienie o 7:00 (domyślnie wyłączone, żeby nikt nie dostał nagle trzeciego powiadomienia
dziennie); pół godziny przed porannym treningiem, a w dniu, w którym waga już jest — wcale.

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
  routing.ts                trasy w hashu adresu: pięć zakładek, sekcje Treningu i Jedzenia z pamięcią ostatniej, podstrony, stan strony w zapytaniu, stare adresy
  routing.test.ts           35 testów tras, zakładek, sekcji i ich pamięci, podstron, zapytania w hashu, przekąsek i starych adresów
  routing.dom.test.ts       5 testów routera w przeglądarce: `hashchange`, pamięć sekcji i jej kopia w `sessionStorage`
  data/exercises.ts         biblioteka 114 ćwiczeń, drabiny sprzętu, lista „bez sprzętu”, cztery treningi, treningi profili
  data/exjokes.ts           dopiski do 114 ćwiczeń i do gotowych treningów
  data/moves.ts             osiemnaście wzorców ruchu jako klatki kluczowe
  data/anim.ts              przypisanie ćwiczeń do wzorców
  data/exercises.test.ts    14 testów spójności biblioteki i drabin
  data/videos.ts            filmy instruktażowe, 4 na ćwiczenie
  data/plans.ts             54 plany klasyczne, 16 planów z celem i 16 ogólnorozwojowych z profilem
  data/workouts.ts          biblioteka 32 treningów: podziały, całe ciało i partie na trzy zestawy sprzętu
  data/muscles.ts           16 grup mięśni, główne i pomocnicze każdego ćwiczenia, izolacje
  data/scenes.ts            sceny ilustracji: 38 treningów, 16 planów z celem, 3 poziomy i własne
  data/stations.ts          stanowisko każdego ćwiczenia: sprzęt, maszyna, zamienniki; dom i siłownia
  data/profiles.ts          sześć profili: priorytet, dodatki, przekąski, uzasadnienie ze źródłami
  data/profiles.test.ts     5 testów profili: priorytet na początku, dodatki, limity serii, sceny
  engine/
    math.ts                 wzór Epleya, tonaż, wskaźnik obciążenia w czasie
    reminders.ts            lista przypomnień na 21 dni: trening z planu o 7:30, ruch o 19:30
    blocks.ts               bloki treningu: serie pod rząd, para na zmianę albo obwód
    steps.ts                kolejka serii sesji: pod rząd, para na zmianę, obwód runda po rundzie
    steps.test.ts           4 testy kolejności serii, rund obwodu i kursora po zapisie
    clock.ts                zegar sesji: start, części, przejścia, oś czasu i czas do dziennika; skrajne czasy poza statystyką
    clock.test.ts           39 testów startu, końca części, cofania, pomijania, osi czasu, przejść i skrajnych czasów
    rests.ts                przerwy: z rodzaju ćwiczenia, z treningu, dłuższe po słabnących seriach, obwód coraz gęstszy
    rests.test.ts           11 testów przerw, słabnięcia serii, przerwy po rundzie obwodu i skracania przerw z historii
    session.ts              zapis seria po serii, ocena zapasu, przerwa jako chwila końca, koniec w połowie
    session.test.ts         6 testów zapisu serii, cofania, zamknięcia i przerwy
    structure.ts            zasady par, przerwy, przygotowanie stanowiska, rozgrzewka
    structure.test.ts       20 testów par i obwodów w całej bibliotece, stanowisk, talerzy, rozgrzewki i zamian
    planedit.ts             zmiany planu od dziś: dni z datą, przedłużenie, równe przerwy
    boost.ts                podpowiedzi postępu w dzień wolny: przekąska i trening dodatkowy
    planedit.test.ts        9 testów zmian bez przepisywania historii, rytmu i podpowiedzi
    reminders.test.ts       13 testów list, godzin, dnia lokalnego, ważenia i kontraktu z serwerem
    plan.ts                 stan początkowy, recepta na dziś, mieszane obciążenie
    progression.ts          silnik: ocena sesji, awanse, przejścia, regres, przerwy
    hints.ts                teksty podpowiedzi i wyjaśnień
    schedule.ts             rozpisanie planu na daty, przypisanie sesji do terminów, rotacja
    score.ts                punkty, premie za serię, stopnie
    metrics.ts              sumy, rekordy z okna czasu, miary utrzymania poziomu
    history.ts              dziennik przewrócony na ćwiczenia: sesje, rekordy, kierunek zmiany
    pose.ts                 szkielet manekina: kąty, klatki, dosunięcie do podłoża
    share.ts                treść wpisu, karta 1080×1080, wysyłka i ścieżka zapasowa
    share.test.ts           20 testów treści wpisu, adresów, blankietu, wprowadzenia i poleceń
    snacks.ts               przekąski ruchowe: zapis, skróty, podpowiedź, dzień po ćwiczeniu, liczby
    snacks.test.ts          17 testów zapisu, skrótów, granicy z treningiem i liczb przekąsek
    volume.ts               objętość ćwiczenia w dniu, tygodniu i miesiącu kalendarzowym
    design.ts               doradca: serie ułamkowe na partie, kolejność, przegląd treningu i planu
    design.test.ts          24 testy mięśni, doradcy, biblioteki, bez sprzętu, planów z celem i tygodnia lżejszego
    energy.ts               kalorie: równania ACSM, tabela roweru i tańca z Compendium, profile MET ćwiczeń
    energy.test.ts          26 testów równań, płynności marsz–bieg, kroków, roweru, tańca i kalorii z serii
    body.ts                 dziennik wagi, waga obowiązująca w danym dniu, średnia z 7 dni, wzrost
    body.test.ts            3 testy średniej z tygodnia i zmiany tydzień do tygodnia
    cardio.ts               kroki, bieżnia, rower i taniec: zapis, zakresy, minuty ruchu WHO, statystyki
    burn.ts                 kalorie z zapisów: wpis, trening, ćwiczenie, przekąska, cały dzień
    cardio.test.ts          32 testy wpisów, tańca, wagi w czasie, kalorii i minut ruchu według WHO
    watch.ts                dane z zegarka: paczka, scalanie po czasie, kroki i przejazdy jako wpisy w locie
    watch.test.ts           15 testów paczki, scalania, wyższej liczby kroków, przejazdów i importu
    phone.ts                dane z telefonu: paczka, scalanie, kroki i przejazdy w locie, propozycja ważenia
    phone.test.ts           18 testów paczki, wspólnego wektora, trzech źródeł kroków, tego samego przejazdu, importu i ważenia
    find.ts                 wyszukiwanie ćwiczenia: polski alfabet, ogonki opcjonalne, podświetlenie
    find.test.ts            9 testów kolejności, dopasowania i podświetlenia
    similar.ts              zamienniki ćwiczenia (wzorzec, mięśnie, sprzęt) i sprzęt treningu z jego ćwiczeń
    similar.test.ts         7 testów zamienników, pasowania do sprzętu i sprzętu treningu
    exbadges.ts             odznaki ćwiczeń: cztery rodziny na ruch, progi z objętości sesji
    exbadges.test.ts        15 testów okresów, progów, zdobywania i cofania odznak ćwiczeń
    xp.ts                   punkty doświadczenia, poziomy i tytuły postaci
    xp.test.ts              14 testów źródeł doświadczenia, sufitów przekąsek i cardio, poziomów
    quips.ts                humor: porównania liczb, odmiana, zestawy tekstów
    quips.test.ts           23 testy puent, odmiany, dopisków i granic porównań
    pose.test.ts            24 testy szkieletu, cyklu, katalogu ruchów i mimiki
    badges.ts               katalog odznak z progami, postęp, migracja starych kluczy
    journal.ts              dziennik zdarzeń wyprowadzany z kalendarza
    advice.ts               podpowiedzi: nadrobienie, przerwa, zmiana częstotliwości
    snapshot.ts             jedno wyliczenie stanu planu na dziś
    progression.test.ts     40 testów silnika progresji
    schedule.test.ts        30 testów kalendarza, przypisania i rotacji
    score.test.ts           15 testów punktacji i dziennika
    badges.test.ts          37 testów odznak, dorobku, kroków, cardio i tańca, czasu na treningu oraz podpowiedzi
    history.test.ts         14 testów historii ćwiczenia i kierunku zmiany
    metrics.test.ts         43 testy warstwy liczb, także czasu na treningu
  storage/storage.ts        zapis z kolejkowaniem, dwa środowiska; mówi, czy dany zapis trafił na dysk
  storage/storage.test.ts   2 testy wyniku zapisu i kolejki po odmowie przeglądarki
  components/
    ui.tsx                  modal, toast, baner, pusty stan, kafelek, przełącznik, dwa wykresy
    ExerciseCard.tsx        karta ćwiczenia z formularzem serii
    views.tsx               sesja, obciążenie, ustawienia
    atlas.tsx               spis ćwiczeń i podstrona pojedynczego ćwiczenia
    Workouts.tsx            zakładka Treningi: biblioteka z filtrami, podgląd, kreator z doradcą
    Plans.tsx               katalog planów, podgląd planu ze startem, kreator planu na 4–48 tygodni
    Design.tsx              paski mięśni, uwagi doradcy, przełącznik sekcji i filtry
    PlanView.tsx            konfigurator klasyczny, kalendarz, punkty i dziennik
    SessionHome.tsx         ekran „co robię dzisiaj”, z kartą jedzenia u tych, którzy prowadzą dietę
    Guided.tsx              prowadzenie sesji: jedna seria na ekranie, odliczana przerwa, ocena zapasu, karta przejścia „Start: …”
    SessionClock.tsx        zegar sesji: licznik w pasku aplikacji i pasek części nad serią
    Sections.tsx            przełącznik sekcji zakładki: Plan · Treningi · Ćwiczenia i Dziennik · Przepisy · Produkty · W pobliżu
    Weigh.tsx               karta ważenia na ekranie Dziś: waga z rana, średnia z 7 dni
    Profile.tsx             profil: liczby, lista zrobionych ćwiczeń, historia i podstrony
    Timer.tsx               stoper i odliczanie dla ćwiczeń na czas
    Timer.test.ts           4 testy zapisu czasu: sekundy, minuty, godziny, zaokrąglenie
    BadgeArt.tsx            medale odznak: tworzywa, piktogramy, pasma progów
    Celebrate.tsx           moment zdobycia — medal, promienie, konfetti
    icons.tsx               ikony nawigacji
    Mannequin.tsx           postać wykonująca ruch i jej zegar, w budowie atlasu i sceny
    SceneArt.tsx            ilustracje kart treningów i planów 2:1 z systemu projektowego
    scenes.test.ts          12 testów zgodności scen z biblioteką, sprzętem, dymkiem i obrazkiem
    Intro.tsx               opcjonalne wprowadzenie, cztery ekrany
    Share.tsx               przycisk udostępniania, obsada blankietu i ścieżka zapasowa
    Promo.tsx               „Poleć znajomym”: plakat Trenera Siwego, wpis, udostępnienie i pobranie
    Snacks.tsx              przekąski ruchowe: karta na ekranie sesji, widok zapisu i historia
    Cardio.tsx              kroki, cardio i taniec: karta, formularz z podglądem kalorii, historia, waga
    Character.tsx           postać: karta w profilu, pasek na ekranie sesji, okno awansu
    ExerciseBadges.tsx      wiersz odznaki ćwiczenia z bieżącym okresem i rekordem
    ExercisePicker.tsx      pole wyboru ćwiczenia z podpowiedziami (wzorzec combobox)
    Support.tsx             złoty pasek wsparcia pod paskiem aplikacji i baner Siwego z espresso
    Support.test.ts         4 testy chowania paska, długości i głosu jego tekstów
    Support.links.test.tsx  2 testy kawy według kraju w pasku i banerze
    TopBar.tsx              przyklejony pasek aplikacji: tytuł, wstecz, ustawienia, zegar sesji, pasek wsparcia
    Install.tsx             iPhone w Safari: niebieski pasek „dodaj do ekranu początkowego” i instrukcja w oknie
    Install.test.tsx        4 testy paska w miejscu paska wsparcia i kroków instrukcji
    Gorilla.tsx             obsada: Gustaw, Gosia i Trener Siwy, siedemnaście min
    cast.test.ts            18 testów obsady, pasm, blankietu, miny postaci i rady dnia
    Achievements.tsx        zakładka osiągnięć: dorobek w liczbach i odznaki z progami
    VideoEmbed.tsx          odtwarzacz YouTube ładowany dopiero po kliknięciu
    Reminders.tsx           karta przypomnień w ustawieniach: zgoda, rano i wieczorem
    Structure.tsx           „przed treningiem”: przygotuj, rozgrzewka; nagłówki par i wskazówki serii
    Health.tsx              zastrzeżenie zdrowotne: krótka wersja, pełna karta i uwagi do liczb z zegarka i telefonu
    Garmin.tsx              karta zegarka w ustawieniach: klucz, kroki połączenia, stan, odłączenie
    Phone.tsx               karta „Zdrowie z telefonu”: klucz, instrukcja dla iPhone'a albo Androida, stan, odłączenie
    Phone.test.tsx          8 testów karty (adresy z buildu, Android, komputer, zły klucz, stan), wpisów i liczb „z telefonu” i propozycji ważenia
    Boost.tsx               „Na postęp w dzień wolny” na zakładce Plan i ekranie Dziś
    Feedback.tsx            okno „Napisz do autora”: e-mail, wiadomość, zrzut ekranu
    Contact.tsx             okno „Kontakt z autorem” i lista odnośników (Instagram, Discord w Polsce, kawa według kraju)
    Contact.test.tsx        7 testów „@” w pasku, okna w Polsce i poza nią, zamykania, fokusu i przejścia do wiadomości
    LoadBoundary.tsx        granica błędu zakładki Jedzenie: niewczytana paczka albo błąd zamyka tylko ten ekran
    RootBoundary.tsx        granica błędu całej aplikacji: „Coś poszło nie tak” i „Odśwież”, które wpuszcza poprawioną wersję
    RootBoundary.test.tsx   3 testy ekranu awarii: bez błędu, po błędzie i „Odśwież” bez ruszania danych
    UpdateBar.tsx           pasek „Nowa wersja aplikacji” z „Odśwież” i „Później” — nigdy w trakcie treningu
  food/                     zakładka Jedzenie (dawne Produkty PL): osobna paczka, wczytywana dopiero w Jedzeniu
    FoodRoot.tsx            wejście do paczki: przełącznik sekcji, strony sekcji, podstrony diety i lokale, każda leniwie
    TodayFoodCard.tsx       karta jedzenia na ekranie Dziś: kalorie i białko wobec celu dnia, „Dodaj zjedzone”
    FoodCardPlaceholder.tsx miejsce na tę kartę, zanim przyjdzie jej paczka — w głównej paczce, bez importów
    dietFlag.ts             znacznik „prowadzi dietę” (`gt:diet`): ekran Dziś czyta go, zanim wczyta cokolwiek z jedzenia
    bridge.ts               most do danych treningu: waga, wzrost, kroki i ruch dnia z jednego źródła
    backup.ts               jedzenie w kopii i w resecie: kopia dziennika, odtworzenie, czyszczenie, zapominanie przeniesionych ważeń
    data.ts                 baza produktów: adres z buildu, pobranie, gzip albo czysty JSON, indeks do wyszukiwania
    hash.ts                 stan stron w zapytaniu wewnątrz hasha (`#/produkty?q=skyr&ns=a`)
    food.css                miejsce na style wspólne całej zakładce; obszary mają arkusze obok swoich stron
    *.test.ts(x)            35 testów karty Dziś, kopii i resetu, arkuszy bez zderzeń klas, bazy produktów i hasha
    lib/                    produkty: filtry, fasety, sortowanie, wyszukiwanie bez względu na ogonki, stan w adresie, formaty, opakowania — 51 testów
    recipes/                przepisy białkowe i gotowce: katalog, składniki, koszyki sklepów i grupowanie, zamiany, progi, makro, gotowe produkty, hale po supermarketach — 319 testów
    online/                 sklepy internetowe: rejestr, dane sklepów (`data/*.json`), scalanie z bazą po EAN, kontrola liczb — 36 testów
    chains/                 sieci z własnymi danymi (Selgros): rejestr, dane (`data/*.json`), scalanie po EAN bez oferty online, kontrola liczb — 10 testów
    nearby/                 w pobliżu: odległości, zapytanie do Overpass (z halami Selgros i Makro) z zapasowym serwerem, kopia na dobę, promień — 33 testy
    diet/                   dieta: baza Dexie (`produkty-pl-dieta`, wersja 4 z zestawami, ulubionymi i planami z zakupami), model energii z kierunkiem celu, sposoby odżywiania, dzień, plan z Excela, zestawy, ulubione, wyszukiwanie, podpowiedzi — 137 testów
    prep/                   plan z zakupami (meal prep): bloki gotowania, przepisy z koszyka, wybór ról i lista zamienników, porcje i dodatki, cele dni, check-in, lista zakupów, nazwa, przesuwanie dat, pierwszeństwo w dzienniku, migawka w bazie, odczyt z kopii — 120 testów
    restaurants/            lokale: dane sieci (`data/*.json`), kontrola liczb, wyszukiwanie, kolejność, „Najwięcej białka”, stan w adresie — 101 testów
    hooks/                  baza produktów, menu lokali, dieta na żywo i scalona z treningiem, stan w adresie, lokalizacja, sklepy w pobliżu — 22 testy
    components/common/      karta i szczegóły produktu, zdjęcie, oceny, cena, arkusz od dołu, ekrany stanu
    components/products/    przeglądarka produktów: pasek narzędzi, filtry w arkuszu, fasety, aktywne filtry, tabela, strony
    components/recipes/     przepisy: lista z filtrami, karta ze sklepem, zamiana składnika, gotowe produkty
    components/nearby/      „W pobliżu”: mapa Leaflet, promień, sklepy i przepisy z nich
    components/diet/        dziennik (pytanie o wagę, arkusz ulubionych), plan posiłków, postęp, profil diety, pierwsze kroki, wybór jedzenia i zestawy, import z Excela
    components/prep/        plan z zakupami: formularz z check-inem, plan (przepisy, gotowanie, dzień po dniu), okna nazwy, dat i wymiany przepisu, „Moje plany”, lista zakupów, plan dnia w dzienniku
    components/restaurants/ Lokale: lista sieci z wyszukiwaniem, menu sieci, karta pozycji z dodaniem do dziennika
    components/**/*.test.tsx 156 testów stron pod jsdom — przez role i etykiety, nie znaczniki
    test/                   dane do testów: produkty, most do treningu, arkusz Excela
  api.ts                    adres serwera aplikacji z buildu (`VITE_API_URL`)
  push.ts                   przypomnienia w przeglądarce: zgoda, subskrypcja Web Push, wysyłka listy
  coach.ts                  ekran, który nie gaśnie w trakcie sesji (Wake Lock), i sygnał końca przerwy
  trail.ts                  ślad wizyty: ekrany, stuknięcia, błędy, czas — tylko w pamięci
  trail.test.ts             4 testy kolejności, maskowania liczb, limitu i czasu aktywnego
  feedback.ts               wiadomość do autora: kontekst, zrzut ekranu, obraz z galerii, wysyłka
  contact.ts                kontakt z autorem: Instagram, Discord (Polska), kawa według kraju, „Polska” z języka i strefy czasowej
  contact.test.ts           7 testów kraju, kawy, adresów i kolejności odnośników
  push.test.ts              5 testów stanu przypomnień na telefonie i klucza serwera
  install.ts                czy i skąd podpowiadać dodanie do ekranu: Safari, inna przeglądarka, przeglądarka w Instagramie
  install.test.ts           2 testy miejsca: iPhone w karcie, w aplikacji z ikony, Android
  watchseal.ts              koperta zegarka: klucz, klucze pochodne, AES-256-CBC i HMAC-SHA256
  watchseal.test.ts         5 testów: wektor wspólny z zegarkiem, podróbki, czytanie klucza
  mailbox.ts                skrzynka na serwerze, wspólna dla zegarka i telefonu: klucz w pamięci strony, odbiór, odłączenie
  garmin.ts                 zegarek w przeglądarce: klucz, odbiór paczki, odłączenie
  garmin.test.ts            3 testy odpowiedzi serwera i godziny ostatnich danych
  phone.ts                  telefon w przeglądarce: klucz, adresy aplikacji z buildu, odbiór, rodzaj telefonu
  phone.test.ts             3 testy wspólnego wektora, cudzej paczki w skrzynce i rozpoznania telefonu
  pwa.ts                    service worker od strony aplikacji: rejestracja, „nowa wersja czeka”, wpuszczenie poprawki z ekranu awarii
  pwa.test.ts               12 testów rejestracji, pytań o nową wersję i obu „Odśwież” — bez service workera
  sw.ts                     service worker (Workbox, injectManifest): powłoka offline, baza produktów, zdjęcia, kafelki mapy, Web Push
  csp.test.ts               5 testów polityki bezpieczeństwa: każdy obcy adres z kodu przepuszczony, serwer aplikacji, miejsce znacznika
  styles.css                arkusz stylów
  styles.contrast.test.ts   9 testów kontrastu tokenów, liczonych wprost z arkusza
  vite-env.d.ts             typy modułu `virtual:food-data`
  test/setup.ts             przygotowanie testów: IndexedDB w pamięci, jest-dom i sprzątanie pod jsdom
  App.tsx                   spina stan i widoki
  main.tsx                  punkt wejścia: kroje pisma, rejestracja service workera (`pwa.ts`), granica błędu wokół aplikacji
server/api/                 serwer aplikacji: przypomnienia, uwagi i skrzynki zegarka (Cloudflare Worker, cron, D1)
  webpush.ts                szyfrowanie RFC 8291 i podpis VAPID na samym WebCrypto
  schedule.ts               co komu wysłać: czas lokalny, okno 90 minut, raz dziennie
  api.ts                    subskrypcje, przebieg crona, uwagi i lista dla autora za hasłem
  discord.ts                kopia nowej uwagi na kanale autora przez webhook Discorda, w tle
  garmin.ts                 skrzynki zegarka: tylko szyfrogram, limity, odbiór i odłączenie
  store.ts                  subskrypcje, uwagi i skrzynki w D1 albo w pamięci
  worker.ts                 punkt wejścia Workera
  *.test.ts                 45 testów: wektor RFC, VAPID, harmonogram, API, cron, uwagi, podgląd, Discord i skrzynki
  README.md                 wdrożenie krok po kroku
garmin/                     aplikacja na zegarek (Connect IQ, Monkey C) — opis i build w garmin/README.md
  store/                    publikacja w Connect IQ Store po angielsku: teksty, notatka dla recenzentów, hero, zrzuty
public/privacy.html         polityka prywatności (EN i PL) — strona, aplikacja na zegarek i GYM TRACKER Zdrowie
health/                     GYM TRACKER Zdrowie — aplikacje na telefon, opis w health/README.md
  vectors.json              wspólny wektor koperty dla strony, Androida i iPhone'a
  android/                  Android: Health Connect, Kotlin, WorkManager (Gradle)
  ios/                      iPhone: HealthKit, Swift, SwiftUI (XcodeGen)
vite/                       wtyczki Vite
  csp.ts                    polityka bezpieczeństwa treści (`<meta>` w zbudowanej stronie) z jednej listy obcych adresów
  foodData.ts               baza produktów jako `data/products.<hasz>.json.gz` i moduł `virtual:food-data`; w trybie deweloperskim podaje ją serwer Vite
  foodData.test.ts          4 testy daty, wersji z hasza, braku pliku i modułu w Vitest
data/food/products.json.gz  baza produktów (3,3 MB) z `npm run food:data`; surowe pliki (`data/food/raw/`) poza gitem
scripts/food/               przygotowanie bazy produktów (`npm run food:*`, przez tsx)
  fetch-taxonomies.ts       polskie nazwy kategorii, etykiet, alergenów i dodatków z taksonomii Open Food Facts
  fetch-prices.ts           wszystkie ceny w PLN z Open Prices
  extract-priced.ts         produkty z ceną w PLN z pełnego zrzutu — połowy brakuje w wyciągu „en:poland”
  prepare-data.ts           złożenie `data/food/products.json.gz` z wyciągu, cen i taksonomii
  check-recipes.ts          pokrycie przepisów na dołączonej bazie: kandydaci, sklepy, domyślny wariant
  check-prep.ts             plan z zakupami na dołączonej bazie: tydzień w najlepszych sklepach i każdym stylu, trafienie w cel, lista
  fetch-selgros.ts          produkty Selgrosa z wyszukiwarki selgros.pl (Playwright, pamięć stron, wznawianie)
  http.ts                   przedstawienie się API Open Food Facts i przerwy między zapytaniami
  lib/                      przekształcenie wiersza, ceny, sieci sklepów, taksonomie, pisownia, TSV, rekordy Selgrosa — 61 testów
scripts/demo-videos/        filmy demo (`npm run demo:*`): scenariusze potrzeb, nagrywanie przez Playwright, opisy
  record.ts                 build, `vite preview`, ujęcie na scenariusz, MP4 30 kl./s, kontrola 25–45 s, opis i arkusz kadrów
  explore.ts                ekran z danymi demo (drzewo dostępności i zrzut) — do pisania i poprawiania scenariuszy
  scenarios/                po jednym pliku na potrzebę: kroki na ekranie i teksty do postprodukcji (PL/EN)
  lib/                      ujęcie (screencast 2×), ruchy jak u człowieka, import danych demo, pamięć zapytań na zewnątrz
  seed/                     generator osoby demo przez silnik aplikacji (`generate.seed.ts`) i gotowe kopie `full.json`, `fresh.json`
demo-videos/                filmy demo: opisy `.md` w repozytorium, nagrania `.mp4` i arkusze `.jpg` z `npm run demo:videos`
public/icons/               ikony: zwykłe, maskowalna, iOS i wektorowa
index.html                  szkielet strony: kolor paska, ikony i tryb pełnoekranowy na iOS; build dopisuje CSP i manifest
vite.config.ts              wtyczki: React, CSP, baza produktów, PWA (service worker i manifest); ustawienia Vitesta
tsconfig.json               typy kodu przeglądarki i serwera — bez typów node'a
tsconfig.test.json          testy: te same ustawienia plus typy node'a
tsconfig.node.json          node: konfiguracja Vite, `vite/` i `scripts/`
tsconfig.demo.json          filmy demo (`scripts/demo-videos/`): node z typami DOM dla funkcji wysyłanych do przeglądarki
tsconfig.sw.json            service worker: typy WebWorker zamiast DOM
.oxlintrc.json              lint (`npm run lint`, oxlint)
```

Silnik jest w całości oddzielony od interfejsu. `engine/` nie importuje niczego z Reacta, funkcje
przyjmują stan i zwracają zmiany, więc dają się testować bez DOM-u. Funkcje mutujące (`applyResult`,
`applyLayoff`) działają na przekazanym obiekcie — `App.tsx` woła je zawsze na kopii stanu.

Jedzenie ma ten sam podział: `food/lib`, `recipes`, `nearby`, `diet`, `prep`, `restaurants` i `online` to czysta logika bez Reacta
(testowana w node), a komponenty tylko wyświetlają — ich testy renderują strony pod jsdom. Do głównej
paczki trafia z jedzenia tylko to, czego potrzebuje ekran Dziś i App, zanim ktoś wejdzie w Jedzenie:
znacznik diety, most, zaślepka karty i stan w hashu (`dietFlag.ts`, `bridge.ts`,
`FoodCardPlaceholder.tsx`, `hash.ts`) — reszta przychodzi leniwie.

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

**Listy filmów są rozwinięte od wejścia.** Stała przed nimi przez chwilę bramka „Pokaż
filmy z YouTube", żeby podstrona nie odpytywała nikogo z zewnątrz, dopóki ktoś sam nie
poprosi. Kosztowała kliknięcie w każdej wizycie za oszczędność, której nikt nie widział —
po atlas przychodzi się właśnie po to, żeby zobaczyć ruch. Bramki nie ma, a prywatności
pilnuje sam odtwarzacz.

**Odtwarzacz wchodzi dopiero po kliknięciu.** Cztery osadzone ramki na stronę ściągałyby
megabajt skryptów i ustawiały ciasteczka, zanim ktokolwiek naciśnie play, więc do tego
czasu stoi tam sama miniatura z `loading="lazy"` — obrazek z CDN, bez skryptów i bez
ciasteczek, dociągany dopiero wtedy, gdy zbliży się do ekranu. Adres `youtube-nocookie.com`
odkłada śledzenie do momentu odtworzenia, a zwykły link do YouTube pod spodem działa nawet
wtedy, gdy autor skasuje film.

## Plan, który się zmienia — i podpowiada, co dorzucić

**Zmiana od dziś, bez przepisywania historii.** Na zakładce Plan karta „Zmień plan od dziś”:
inne dni treningowe, zasada dla przepadłych terminów („trening czeka” albo „przepada”)
i przedłużenie o 4 tygodnie, gdy plan się kończy. Dni zapisują się jako zmiana z datą
(`plan.changes`), a kalendarz liczy każdy dzień z dni, które obowiązywały wtedy — terminy
sprzed zmiany, realizacja, punkty i odznaki zostają takie, jakie były. Rotacja treningów idzie
dalej. Zmiana trafia do dziennika planu.

**Doradca rytmu dla każdego planu.** Realizacja poniżej 60% po sześciu terminach: rzadziej;
95% po ośmiu: gęściej. Plan klasyczny dostaje wtedy inny wariant z konfiguratora, a plan z celem,
z profilem i własny — nowe dni od dziś, dobrane tak, żeby przerwy były jak najrówniejsze
(najpierw żadnych dwóch dni z rzędu, potem najmniejszy rozrzut), jednym przyciskiem.

**Na postęp w dzień wolny** — na zakładce Plan i na ekranie Dziś, gdy plan ma wolne:

- **przekąska**: najpierw z profilu planu, potem ćwiczenie, które od dwóch sesji stoi w miejscu
  (bez sprzętu albo z tym, co i tak jest pod ręką), potem duża partia z mniej niż 10 seriami
  tygodniowo. 1–3 serie po ok. 60% dzisiejszego celu, z zapasem, rozłożone w ciągu dnia —
  częstszy bodziec bez zmęczenia przed terminem (Grgic i in., 2018: przy tej samej objętości
  wyższa częstotliwość pomaga sile);
- **trening dodatkowy** tylko z zapasem: termin najwcześniej pojutrze, obciążenie ostatnich
  tygodni w normie (stosunek tygodnia do miesiąca do 1,3), realizacja od 70%. Zawsze lekki —
  dzień lekki D albo brzuch — a nie kolejny ciężki.

W dzień terminu, przy zaległym terminie i po zrobionym dziś treningu podpowiedzi nie ma:
wtedy liczy się termin albo przerwa.

## Plan treningowy

Plan klasyczny rozpisuje dwanaście tygodni na konkretne daty i pilnuje terminów także wtedy,
gdy trening się nie odbył (plany z celem i własne — w części „Treningi, plany i doradca”). Dzień startu i dni tygodnia wybiera użytkownik — to jedyne dwie
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

## Kolejność, pary i przygotowanie stanowiska

Każdy trening mówi, **co i kiedy robić**. Podgląd i sesja zaczynają się od karty „Przed
treningiem”, a ćwiczenia stoją w blokach: `1`, `2A`/`2B`, `3`…

- **Przygotuj.** Konkretne kettlebelle z wagami z twojego poziomu („16 kg — swing, goblet”),
  sztanga z talerzami na stronę („60 kg — po 20 kg na stronę”), hantle, a do tego ławka, drążek,
  krzesło oparte o ścianę, stół do australijskiego podciągania, mata. Na siłowni lista maszyn
  do znalezienia, zanim padnie pierwsza seria — każde ćwiczenie z własnym zamiennikiem na
  wypadek, gdy maszyna jest zajęta. W sesji przycisk „Zamień” podmienia ćwiczenie tylko na dziś:
  wynik i progresja idą do tego, co naprawdę zrobiono, a trening zostaje bez zmian.
- **Rozgrzewka.** Ogólna (siłownia: 5 min rower, bieżnia albo ergometr; dom: marsz, pajacyki,
  krążenia) i serie dochodzące: do każdego ciężkiego ruchu ze sztangą pusty gryf × 10, ok. 50% × 5
  i 75% × 3, zaokrąglone do 2,5 kg; pierwsze ćwiczenie treningu dostaje swoje wejście zawsze.
- **Serie pod rząd albo na zmianę.** Para to seria A, 60–90 s przerwy, seria B, przerwa — aż obie
  skończą serie. Skraca trening bez straty powtórzeń, gdy ćwiczenia nie męczą tych samych mięśni
  (Robbins i in., 2010; przegląd Weakley i in., 2017), najlepiej przeciwstawnych, jak pchanie
  i ciągnięcie. Zasady, których pilnuje test na całej bibliotece:
  - ruch wybuchowy (swing, burpee) i ciężki ruch ze sztangą (przysiad, martwy ciąg, wyciskanie)
    zawsze sam, z pełną przerwą 2–3 min;
  - para nie męczy tej samej partii — dwa uginania na biceps na zmianę to dwa słabsze uginania;
  - na siłowni para trzyma najwyżej jedno stanowisko: ten sam wyciąg (rozpiętki i prostowanie
    ramion), tę samą suwnicę (wypychanie i wspięcia) albo maszynę z hantlami obok. Dwie maszyny
    naraz w szczycie to maszyna, którą ktoś zajmie, zanim się wróci;
  - dni samego pchania i samego brzucha zostają bez par — każda para męczyłaby te same mięśnie.
- **Przerwy** z rodzaju pracy: ciężkie wielostawowe 2–3 min, pozostałe 60–90 s, brzuch i łydki
  30–60 s. Czas treningu liczy pary uczciwie — przerwa jednego ćwiczenia to praca drugiego.

Przegląd biblioteki dał 44 pary w 36 treningach, np. trening A: swing sam, goblet ↔ wiosłowanie,
floor press ↔ podciąganie, spacer sam, brzuch ↔ łydki. Kreator własnego treningu ma przycisk ↔
„na zmianę z poprzednim” i od razu mówi, gdy para łamie którąś z zasad. Doradca liczy kolejność
po blokach: para stoi na miejscu ważniejszego ćwiczenia, więc łydki na suwnicy zaraz po
wypychaniu to jedno stanowisko, a nie „łydki przed izolacją”.

## Plany ogólnorozwojowe z profilem

Sześć profili: **podciąganie, chwyt, piłka nożna, bieganie, padel i tenis, zdrowe plecy**.
Każdy to całe ciało trzy razy w tygodniu przez 60 dni (A i B na zmianę, tydzień lżejszy
w szóstym), z akcentem na jeden cel — 16 planów na sprzęt, na którym profil ma sens
(podciąganie i chwyt potrzebują drążka i ciężaru), i 32 treningi.

- **Ćwiczenie priorytetowe na początek**, zaraz po ruchu wybuchowym: siła rośnie najbardziej
  w tym, co idzie pierwsze, na świeżo (Simão i in., 2012; Nunes i in., 2021). Gdy ma ten sam
  wzorzec co ćwiczenie bazy, zastępuje je — wykrok zamiast gobleta, przysiad bułgarski zamiast
  przysiadu bez obciążenia. Wskoki niczego nie zastępują: dokładają moc, siłę dalej buduje przysiad.
- **Dwa dodatki na koniec** zamiast zwykłej końcówki (brzuch, łydki) — trening nie rośnie,
  zmienia akcent. Spacer zostaje, chyba że dodatek robi to samo (zwis i spacer farmera to oba
  chwyt).
- **Przekąski profilu** w podglądzie planu — 1–3 krótkie serie z zapasem w dni bez treningu.

| Profil | Priorytet | Dodatki | Dlaczego |
| --- | --- | --- | --- |
| Podciąganie | podciąganie | zwis na drążku, hollow | chwyt i napięcie ciała to dwa najczęstsze hamulce podciągania |
| Chwyt | — | zwis, spacer farmera | chwyt rośnie od trzymania ciężaru w czasie |
| Piłka nożna | przysiad bułgarski / wykrok, na siłowni wskoki | nordic curl, plank kopenhaski | nordic: ok. połowa mniej naderwań tyłu uda (van der Horst 2015, van Dyk 2019); kopenhaski: ok. 40% mniej urazów pachwiny (Harøy 2019) |
| Bieganie | jedna noga | wspięcia jednonóż, plank kopenhaski | siła poprawia ekonomię biegu (Blagrove 2018) |
| Padel i tenis | — | tył barków (y-raise, face pull), tułów (skręty, Pallof, dead bug) | bark nad głową setki razy w meczu, skręt przez tułów |
| Zdrowe plecy | — | dead bug, wyprosty albo tył barków | ćwiczenia zmniejszają ból krzyża i nawroty (Cochrane, Hayden 2021) |

Profil może też **zdjąć ćwiczenie z bazy**, gdy dodatki robią to samo: plany profili trzymają
się tych samych zasad co plany z celem — test pilnuje, żeby żadna partia nie przekroczyła
ok. 20 serii tygodniowo. Tak wypadł RDL w piłce na siłowni (tył uda robi nordic, zawias —
martwy ciąg w B), a w padlu bez sprzętu zwykłe pompki zastąpiły pompki w podporze przodem
(tył barków robi już y-raise). Nowe ćwiczenie w atlasie: **zwis na drążku**.

## Treningi, plany i doradca

Treningi i plany da się układać samemu, a doradca na bieżąco mówi, czy to ma sens. Liczy to,
co da się policzyć z listy ćwiczeń, i porównuje z badaniami oraz stanowiskami ACSM. Nie ocenia
gustu — trening z samych przysiadów jest dozwolony, tylko doradca powie, ile z tego to już
głównie zmęczenie.

**Własna wersja gotowego treningu.** Karta każdego treningu ma „Zmień pod siebie”: kreator
dostaje kopię („… — moja wersja”), a oryginał zostaje bez zmian, także w planach. Stuknięcie
w nazwę ćwiczenia otwiera zamianę **w tym samym miejscu** — z podpowiedziami ćwiczeń, które
robią podobną robotę (ten sam wzorzec ruchu albo te same mięśnie główne) i dadzą się zrobić
sprzętem tego treningu, a niżej z całym atlasem. Zamiennik przejmuje parę i miejsce w obwodzie;
× usuwa ćwiczenie, „dodaj ćwiczenie” dopisuje dowolne. Z atlasu prowadzi „Dodaj do treningu”:
do jednego z własnych albo do nowego — kreator otwiera się z ćwiczeniem dopisanym na końcu,
a zapisuje dopiero „Zapisz trening”. Zapisana wersja pamięta, od czego się zaczęła („Twoja
wersja treningu …” w podglądzie), a sprzęt bierze z ćwiczeń: bez sprzętu, kettlebell albo
siłownia — od niego zależą stanowiska i podpowiedzi zamienników.

**Mięśnie, nie wzorce.** Każde ze 114 ćwiczeń ma główne i pomocnicze mięśnie z szesnastu grup
(`data/muscles.ts`): klatka, plecy (najszersze i środek), trzy aktony barku, biceps, triceps,
przedramiona, brzuch, prostowniki, pośladki, czworogłowe, tył uda, przywodziciele i łydki. Serie
liczą się **ułamkowo**, jak w metaanalizie Pelland i in. (2025): główny mięsień dostaje całą serię,
pomocniczy pół. Seria wybuchowa (swing) i podchód na czas (deska, spacer) nie idą do upadku, więc
same liczą się za pół. Przysiad nie liczy się tyłowi uda — u Kubo i in. (2019) nie urósł ani
przy płytkim, ani przy głębokim.

**Zasady doradcy — i skąd się biorą:**

| Zasada | Próg | Źródło |
| --- | --- | --- |
| Serie na partię w jednej sesji | ostrzeżenie powyżej ok. 11 | Remmert i in. 2025 (preprint SportRxiv): wypłaszczenie przyrostu ok. 11 serii ułamkowych na sesję |
| Serie na partię tygodniowo | poniżej 4 — podtrzymanie; 10–20 — cel; powyżej 20 — wskazówka | Iversen i in. 2021; Schoenfeld, Ogborn i Krieger 2017; Baz-Valle i in. 2022; stanowisko ACSM 2026 |
| Częstotliwość | partia z 8+ seriami raz w tygodniu — wskazówka, żeby rozłożyć na dwa dni | Schoenfeld i in. 2016 i 2019: przy tej samej objętości częstotliwość ma małe znaczenie dla masy, pomaga sile |
| Przerwa dla tej samej partii | wskazówka, gdy partia trenuje ciężko dwa dni z rzędu (także z niedzieli na poniedziałek) | ACSM 2011 (Garber i in.): 48 godzin — zalecenie ekspertów |
| Kolejność ćwiczeń | wybuchowe → wielostawowe → izolacje → brzuch, łydki, spacery | ACSM 2009; Nunes i in. 2021: siła rośnie najbardziej w ćwiczeniu robionym pierwsze, na masę kolejność wpływa niewiele |
| Pchanie i ciągnięcie | tygodniowo pchanie ponad 1,2× ciągnięcia, w treningu góry ponad 1,5× — wskazówka | praktyka trenerska; Kolber i in. 2014, 2017 — obserwacje u ćwiczących z bólem barku |
| Tydzień lżejszy | co 6 tygodni (4–8), o ok. 40% mniej serii | Rogerson i in. 2024: średnio co 5,6 tygodnia; Bell i in. 2023 (Delphi): objętość ma spaść — o ile, to już praktyka |
| Dni w tygodniu | 1 — wskazówka (WHO: co najmniej 2); 7 — ostrzeżenie, zero dnia wolnego | WHO 2020 (Bull i in.) |
| Czas treningu | powyżej 75 minut — wskazówka, powyżej 90 — ostrzeżenie | brak twardych badań — praktyka; przerwy liczone jak w ACSM 2009 (2 min przy wielostawowych) |

Brzuch, chwyt i łydki pracują pomocniczo w prawie każdym ćwiczeniu i szybko się regenerują —
liczone połówkami z każdego ruchu dałyby dwadzieścia kilka serii „na brzuch” w zwykłym planie,
więc dla nich doradca nie stosuje górnej granicy tygodnia ani zasady 48 godzin. **Ostrzeżenie**
(czerwone) pojawia się tylko tam, gdzie badania są twarde albo ryzyko oczywiste; reszta to
**wskazówki**, bo zalecenia ekspertów to nie wyroki.

**Kreator treningu** pokazuje to wszystko na żywo: po każdym dodanym ćwiczeniu przelicza paski
mięśni z kreską limitu sesji, czas i uwagi. Rodzaj treningu (push, pull, nogi, góra, dół, całe
ciało, partia) mówi mu, czego się spodziewać — od push nikt nie oczekuje wiosłowania, od nóg oba
wzorce: kolano i biodro. Przycisk „Ułóż kolejność według zasad” przestawia listę jednym dotknięciem.
Gotowy trening da się skopiować i zmienić pod siebie. Liczba serii należy do ćwiczenia, nie do
treningu — kreator mówi to wprost, bo zmiana działa wszędzie tam, gdzie ćwiczenie występuje.

**Biblioteka**: 38 treningów, każdy przechodzi przez doradcę bez uwag — pilnuje tego test. Trzy
zestawy sprzętu — bez sprzętu, kettlebell z masą ciała i siłownia — a w każdym całe ciało, podziały
i partie: pośladki, klatka, plecy, barki, ramiona, brzuch. Treningi A–D zostały, zmieniła się tylko kolejność: spacer z ciężarem przed podciąganiem
albo pompkami zabierał chwyt ruchowi, któremu był bardziej potrzebny.

**Plany z celem** — szesnaście, na 30, 60 i 90 dni: start od zera, brzuch i core, pośladki (bez
sprzętu, z kettlebell i na siłowni), góra/dół, push/pull/nogi, mocna klatka, plecy i postawa, siła
całego ciała i siła z masą ciała. Każdy daje głównym partiom 10–20 serii tygodniowo, rozkłada je na co najmniej
dwa dni i nie trenuje tej samej partii ciężko dwa dni z rzędu — to też sprawdza test. Plany na 60
i 90 dni mają tydzień lżejszy (szósty, przy 90 dniach także dwunasty), nigdy ostatni.

**Bez sprzętu znaczy naprawdę bez sprzętu**: podłoga, ściana, krzesło albo kanapa i solidny stół.
Drążek, guma, kółko i skakanka to już sprzęt, choć mały — lista `NO_EQUIPMENT` w `data/exercises.ts`
mówi, co się mieści, a test pilnuje, żeby treningi i plany bez sprzętu brały tylko z niej. Na tę
okazję atlas dostał cztery ćwiczenia, których brakowało: wykrok wsteczny bez obciążenia, przysiad
bułgarski z nogą na krześle, mostek biodrowy jednonóż i unoszenie ramion w literę Y leżąc (na tył
barków i dolne kaptury — u ćwiczących z bólem barku bywają słabsze, Kolber i in. 2017). Bez drążka
jedynym porządnym ciągnięciem jest australijskie podciąganie pod stołem, dlatego zamiast dnia pull
są treningi góry z wiosłowaniem i literą Y, a biceps pracuje tylko pomocniczo — doradca to zaznacza
i plany mówią o tym wprost. Progresja idzie powtórzeniami i etapami trudności (pompki, przysiad
jednonóż, pompki w staniu na rękach), a nie ciężarem. Dziewięć treningów i sześć planów: start
i brzuch na 30 dni, całe ciało, pośladki oraz góra/dół na 60, siła z masą ciała na 90. W atlasie
filtr „bez sprzętu” pokazuje 26 takich ćwiczeń.

**Czego się spodziewać — uczciwie.** Każdy plan mówi, co zwykle daje taki czas u zaczynających:
po 30 dniach głównie siła i technika (mięśnie rosną już po 3–4 tygodniach o kilka procent — Seynnes
i in. 2007, DeFreitas i in. 2011 — ale w lustrze tego nie widać), po 60 dniach zwykle +5–10%
przekroju mięśni, po 90 — do tego często +20–30% siły w głównych ćwiczeniach (Kubo i in. 2019).
U kogoś, kto trenuje od lat, te liczby będą mniejsze, i plan mówi to wprost.

**Plan własny** układa się na 4–48 tygodni: dni tygodnia, trening na każdy dzień i tydzień lżejszy
(co 4, 5, 6 albo 8 tygodni, albo wcale). Doradca planu liczy tydzień po tygodniu — gdy rotacja jest
dłuższa niż tydzień, aż wzorzec wróci do początku — i pokazuje serie tygodniowo na tle zielonego
pola 10–20. Start każdego planu, także z celem i własnego, pyta o dzień, dni tygodnia, zasadę
opuszczonego treningu i punkt wyjścia ciężarów (poziom i płeć — tylko dla ćwiczeń jeszcze bez
wyniku).

**Tydzień lżejszy działa w sesji, nie tylko w kalendarzu.** Trening z planu w takim tygodniu ma
o ok. 40% mniej serii i bez testu „ile dasz radę”, a wynik trafia do historii, ale nie rusza poziomów
— ani w górę, ani w dół. Lżejszy tydzień ma dać zmęczeniu zejść, a nie zostać źle oceniony. Sesja
dodatkowa w tym tygodniu idzie normalnie.

Plan klasyczny (poziom × płeć × 2–7 treningów w tygodniu na A–D) działa jak dotąd, pod
`#/plany/klasyczny`. Tylko w nim jest podpowiedź „przejdź na rzadszy/gęstszy wariant” — plany
z celem i własne mają rotację ułożoną pod konkretną liczbę dni. Trening użyty w planie własnym albo
w uruchomionym planie nie da się usunąć, dopóki plan go wskazuje.

**Źródła:** ACSM 2009 (MSSE 41:687), ACSM 2011 (Garber i in., MSSE 43:1334), ACSM 2026 (Currier
i in., MSSE 58:851), WHO 2020 (Bull i in., BJSM 54:1451), Schoenfeld, Ogborn i Krieger 2016 (Sports
Med 46:1689) i 2017 (J Sports Sci 35:1073), Schoenfeld, Grgic i Krieger 2019 (J Sports Sci 37:1286),
Baz-Valle i in. 2022 (J Hum Kinet 81:199), Pelland i in. 2025 (Sports Med, doi 10.1007/s40279-025-02344-w),
Remmert i in. 2025 (SportRxiv, doi 10.51224/SRXIV.537), Iversen i in. 2021 (Sports Med 51:2079),
Nunes i in. 2021 (Eur J Sport Sci 21:149), Simão i in. 2012 (Sports Med 42:251), Bell i in. 2023
(Sports Med Open 9:87), Rogerson i in. 2024 (Sports Med Open 10:26), Kolber i in. 2014 (JSCR 28:1081)
i 2017 (JSCR 31:1024), Kubo i in. 2019 (Eur J Appl Physiol 119:1933), Plotkin i in. 2023 (Front
Physiol 14:1279170), Seynnes i in. 2007 (J Appl Physiol 102:368), DeFreitas i in. 2011 (Eur J Appl
Physiol 111:2785).

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

**Osiem stopni**, od „Gościa z ulicy” po „Pomnik za życia” — to stopień w planie, nie poziom postaci. Pierwszy awans wypada po niecałym tygodniu regularnych
treningów, żeby pierwsza nagroda nie była odległa o miesiąc.

**Odznaki mają progi, nie jeden koniec.** 73 rodziny ogólne i 430 progów, a do tego po cztery
rodziny na każde ćwiczenie biblioteki (o nich niżej). Rodzina „Powtórzenia" ma dziesięć
progów od 500 do miliona, „Utrzymany rytm" siedem od czterech tygodni do dwóch lat. Zdobyty próg
nie kończy tematu, tylko odsłania następny — a pasek postępu mówi, ile brakuje. Zamiast ściany
„zablokowane" jest zawsze widoczny kolejny krok. Wszystko mieszka w zakładce **Osiągnięcia**.

Drabiny są mniej więcej geometryczne (kolejny próg to zwykle dwa razy tyle, co poprzedni) i sięgają
dalej, niż da się dojść w rok regularnych treningów. Ostatni próg ma być odległy, a nie osiągalny
w sezon — inaczej po roku aplikacja przestaje mieć cokolwiek do zaproponowania.

Grupy:

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
- **Czas na treningu** — godziny z zegarem sesji, tygodnie z dwiema godzinami treningu,
  treningi bez przestojów między ćwiczeniami i najdłuższy trening (więcej w „Czas treningu”).
- **Przekąski ruchowe** — ile w sumie, najwięcej jednego dnia, dni z rzędu, pełne tygodnie
  z przekąską codziennie i liczba różnych ćwiczeń zrobionych jako przekąska.
- **Terminy** — zależne od uruchomionego planu: seria w terminie, brak pudła, czyste tygodnie,
  nadrobienia.

**Odznaki ćwiczeń.** Każde ze 114 ćwiczeń ma cztery rodziny: rekord dnia, tygodnia i miesiąca
kalendarzowego oraz sumę z całej historii — razem 440 rodzin i 2 310 progów. To jedyne odznaki,
do których przekąska dokłada się na równi z treningiem: pompka przy biurku jest tą samą pompką.

- **Okresy są kalendarzowe, nie przesuwane.** Tydzień od poniedziałku, miesiąc od pierwszego.
  Tylko wtedy da się uczciwie powiedzieć „dziś 30 z 50”, a nowy tydzień zaczyna od zera i daje
  nową szansę. Rekordy przesuwanego okna mają już swoje miejsce w „Szczytach”.
- **Pasek mierzy bieżący okres, nie stary rekord.** Kolejny próg dnia zdobywa się jednego dnia,
  więc „Najbliżej zdobycia” pokazuje, ile brakuje dziś — i przekąska jeszcze dziś może go domknąć.
- **Progi liczone, nie wpisane.** Podstawą jest typowa sesja z biblioteki (serie × cel), więc
  dwadzieścia podciągnięć i dwadzieścia wspięć na palce nie stoją na tym samym progu. Dzień to
  1, 2, 3, 5 i 8 sesji, tydzień 2–20, miesiąc 6–60, suma 5–1 200 — zaokrąglone do okrągłych
  liczb, a przy czasie powyżej dwóch minut do pełnych minut. Pompki: dzień 25 / 50 / 75 / 120 /
  200, suma od 120 do 30 000.
- **Liczy się to, co wpisane.** Przy ruchu na stronę — powtórzenia na stronę, przy ćwiczeniu na
  czas — sekundy. Medale okresów noszą napis 24H, 7D i 30D, medal sumy — figurkę ruchu.
- **Widać tylko ruchy, które już robisz.** Czterysta rodzin dla ćwiczeń, których ktoś nigdy nie
  dotknął, to ściana, a nie zachęta. W zakładce Osiągnięcia każde ćwiczenie jest osobno zwijane,
  a pełny zestaw stoi też na jego podstronie w profilu. Odznaki ćwiczeń nie trafiają do dziennika
  planu — po imporcie historii zasypałyby terminy.

## Postać i punkty doświadczenia

Punkty planu pilnują terminów i istnieją tylko przy uruchomionym planie. **Doświadczenie (XP)
liczy każdy ruch** — trening, przekąskę, zdobyty próg — także bez planu, i z niego rośnie
postać: Gustaw albo Gosia, do wyboru w profilu.

| Źródło | XP |
| --- | --- |
| Pierwszy zamknięty trening danego dnia | 100 |
| Każdy kolejny trening tego samego dnia | 20 |
| Przekąska ruchowa | 15, do sześciu dziennie |
| Kroki i cardio: minuta ruchu umiarkowanego (intensywna ×2, kroki ponad 5 000) | 1, do 50 dziennie |
| Próg odznaki: brąz / srebro / złoto / platyna / szmaragd | 20 / 40 / 80 / 150 / 300 |
| Próg odznaki ćwiczenia | połowa powyższego |

Zasady te same, co przy punktach planu. **Obecność, nie objętość:** trening płaci stałą pulę,
ciężar i tonaż nie dają niczego — doświadczenie za kilogramy rosłoby najszybciej tuż przed
kontuzją. Drugi trening tego samego dnia płaci mało, bo te same wzorce dwa razy dziennie nie
budują dwa razy szybciej. **Przekąski mają dzienny sufit:** szósta jeszcze płaci, siódma liczy
się już tylko do odznak. Chodzi o ruch rozłożony w ciągu dnia, nie o klikanie. **Odznaki ćwiczeń
płacą połowę**, bo jest ich po cztery na każdy ruch.

**Poziom n → n+1 kosztuje 100·n XP.** Pierwszy awans wypada po pierwszym treningu, dziesiąty po
mniej więcej półtora miesiąca regularnego ruchu, trzydziesty po roku. Tytuły idą za życiem
goryla — od „Świeżo z dżungli” przez „Czarny grzbiet” i „Pierwszy siwy włos” po „Srebrny
grzbiet”, „Przywódcę stada” i dalej. Żart jest o goryla, nie o człowieku, który dopiero zaczyna.

**Gdzie to widać.** Na ekranie sesji stoi pasek postaci: poziom, tytuł, ile brakuje i ile
wpadło dziś — bez rysunku, bo ten ekran ma już trenera w banerze. W profilu jest pełna karta:
goryl z miną zależną od tego, kiedy był ostatni ruch (i zawsze tym samym zdaniem obok), pasek,
najbliższy nowy tytuł, skąd przyszło doświadczenie i wybór postaci. Po treningu podsumowanie
mówi, ile doszło, a awans dostaje własne okno po odznakach.

**Nic nie jest zapamiętane.** Suma liczy się od zera z dziennika, przekąsek, wpisów kroków
i cardio oraz dat zdobycia odznak. Nie ma licznika, który mógłby rozjechać się z historią po imporcie danych.

## Kolory

Ikony, grafiki i odznaki chodzą na palecie Claude: pomarańcz `#d97757`, błękit `#6a9bcc`,
zieleń `#788c5d` i ciepłe neutralne (`#141413`, `#faf9f5`, `#b0aea5`, `#e8e6dc`). Typografia,
układ i nazwa zostają własne — paleta spina rysunki w jeden zestaw, ale aplikacja nie udaje
cudzego produktu.

**Każdy akcent ma dwie wersje i to nie jest ozdoba.** Czysty kolor idzie w wypełnienia:
paski postępu, kropka pod aktywną zakładką, kropelki potu, konfetti, sprzęt w dłoni manekina.
Do tekstu wchodzi wersja przyciemniona (`--c-orange-ink` i reszta), bo czysty pomarańcz
na jasnym tle daje 2,99:1, a błękit 2,80:1 — poniżej progu czytelności. Wersje `ink`
trzymają się powyżej 4,5:1 na wszystkich trzech tłach aplikacji. Podział jest tu po to,
żeby przy następnym kolorowaniu nie trzeba było liczyć od nowa: nazwa tokenu mówi,
gdzie wolno go użyć.

Czyste akcenty zostają przy dwóch i pół do trzech do jednego, więc **nic, co niesie
informację samo, nie stoi na nich**. Ikona ma obok siebie podpis, aktywna zakładka —
pogrubienie i ciemniejszy tekst, kropelki potu i konfetti nie mówią niczego, czego nie
widać gdzie indziej. Tam, gdzie kolor jest jedynym nośnikiem — rysunek wygrawerowany
na medalu — próg 3:1 jest trzymany z zapasem.

**Krawędź kontrolki to osobny token.** `--line` rysuje podziały w treści i przy 1,2–1,7:1
jest dokładnie tym, czym ma być: ledwie widoczną kreską. Ta sama kreska na przycisku znaczy
jednak co innego — to ona mówi „tu się klika”. Segmenty, wybór częstotliwości, dni tygodnia,
filtry sprzętu i pola formularzy chodzą więc na `--edge` (4,10 / 3,74 / 3,01 na trzech tłach),
a nierozpoznawalny przycisk przestał być nierozpoznawalny. Zaciemnienie samego `--line`
zamieniłoby spokojną kartę w kratkę, więc tokeny są dwa.

**Wygaszenie nie znaczy nieczytelność.** Pominięte ćwiczenie, opuszczony termin i niezdobyta
odznaka były wcześniej przygaszane kryciem całego wiersza, co spychało tekst do 2,3–3,8:1.
Krycie zostaje tam, gdzie tłumi rysunek (kafelek ciężaru, medal), a tekst wygasza się własnym
kolorem — `--ink-soft` trzyma 5,7:1, a nazwa pominiętego ćwiczenia dostaje jeszcze przekreślenie,
bo stan nie może zależeć od samego koloru. Trzy tusze stanów (`--ink-soft`, `--ok`, `--warn`)
zostały przyciemnione, bo na najciemniejszym tle miały 4,22 / 4,21 / 3,80:1 — teraz 4,61 / 4,63
/ 4,61. Znaczniki, które niosą informację (kółko odhaczenia, kropka terminu), przeszły z hairline
`--line` na `--edge`.

**Numer na kafelku ciężaru chodzi za kolorem kettlebla.** Kolory są kodem zawodowym i zostają —
ale biała liczba na żółtej szesnastce dawała 1,8:1. Teraz biel wchodzi tylko na ciemne odważniki
(12, 14, 20, 24, 32, 36 kg), reszta dostaje `--ink`, a dwa odcienie (12 i 24) są o włos ciemniejsze
niż standard, żeby biel trzymała 4,6:1. Kafelek w trakcie przejścia ma dwa kolory naraz, więc
numer siedzi tam na własnej, stalowej etykiecie.

**Progi pilnuje test, nie pamięć.** `styles.contrast.test.ts` czyta arkusz, wyciąga z niego
tokeny i liczy kontrast po WCAG: wersje `ink` powyżej 4,5:1 na każdym tle (także złota wsparcia),
`--edge` powyżej 3:1, biel na złotym przycisku kawy i tekst na złotym tle wsparcia powyżej 4,5:1,
tusze stanów powyżej 4,5:1 i każdy kafelek ciężaru
z właściwym kolorem liczby. Sprawdza też rzecz odwrotną — że czyste akcenty
nadal **nie** nadają się na tekst, bo gdyby kiedyś przeskoczyły próg, podział na dwa tokeny
byłby już tylko zabobonem.

**Tworzywa odznak wyprowadzone są z tych samych akcentów** — brąz z pomarańczu, platyna
z błękitu, szmaragd z zieleni; srebro i złoto zostają przy neutralnych. Rysunek na medalu
jest wszędzie ciemny, „grawerowany": jasny piktogram na stopie o średniej jasności schodził
do 2,74:1 i po prostu znikał. Ciemny trzyma od 4,16:1 wzwyż na każdym z pięciu pasm.

## Jak wyglądają odznaki

Odznaka jest przedmiotem, nie znakiem typograficznym. Każda to sześciokątny medal z tworzywem,
które rośnie razem z postępem w rodzinie: **brąz → srebro → złoto → platyna → szmaragd**.
Tworzywo liczy się z udziału zdobytych progów w rodzinie, nie z gołego numeru progu — dzięki
temu domknięcie dowolnej rodziny kończy się szmaragdem, także tej trzyprogowej, a rodzina
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

**Odznaki nie dają punktów planu.** Punkty pilnują terminów, odznaki nagradzają dorobek — gdyby
objętość płaciła punktami, ranga rosłaby najszybciej tuż przed kontuzją. Dają za to jednorazowo
doświadczenie postaci: próg to rzecz skończona, więc nie da się go wyciskać w nieskończoność.

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

## System projektowy

Paleta, obsada i reguły kontrastu mają jedno źródło poza kodem: system projektowy GYM TRACKER
(artefakt „Design System”), zbudowany z tego repozytorium i rozwinięty o rzeczy, których w nim
nie było. Ten kierunek — z systemu do kodu — dotyczy czterech rzeczy: poprawek kontrastu,
obsady goryli, baneru z radą dnia i ilustracji treningów i planów. Reszta poszła w drugą stronę: tokeny, komponenty i teksty
system wziął stąd.

Czego z systemu **nie** ma w aplikacji i dlaczego:

- **ShareCard** — system rysuje kwadratową grafikę w DOM-ie. Aplikacja ma własne blankiety
  („ŚWIADECTWO POCIĘŻAROWE”, „LEGITYMACJA SIŁOWA”) rysowane na płótnie 1080 × 1080, bo tylko
  z płótna da się zrobić plik do udostępnienia. Dwie implementacje tego samego rozjechałyby się
  po pierwszej zmianie, więc zostaje ta, która działa w arkuszu udostępniania.
- **AchievementCard** jako osobna karta — moment zdobycia ma w aplikacji własną scenę
  (medal wjeżdża z przeskalowaniem, promienie, konfetti). Postać z pasmem doszła do tej sceny
  zamiast ją zastępować.
- **Popiersia w plikach SVG i PNG** — obsada jest komponentem, a nie zestawem obrazków, więc
  nie ma czego kopiować do paczki. Grafiki poza aplikacją bierze się z systemu.
- **Ilustracje treningów i planów w PNG** — z tego samego powodu: scena jest komponentem
  (`SceneArt.tsx`), a 57 plików po ok. 90 kB to 5 MB w pamięci service workera za obrazki,
  które kod rysuje w kilku kilobajtach.

## Aplikacja do zainstalowania (PWA)

GYM TRACKER instaluje się na ekranie głównym telefonu i działa bez sieci od pierwszej wizyty.

- **vite-plugin-pwa ze strategią `injectManifest`.** Service worker jest własny, w TypeScripcie
  (`src/sw.ts`, moduły Workboxa), a build dopisuje do niego tylko listę plików powłoki z haszami.
  Zastąpił ręczny `public/sw.js` i skrypt, który po buildzie wpisywał do niego listę plików.
- **Co gdzie leży.** Powłoka — skrypty, style, strona, ikony i kroje pisma w alfabecie łacińskim —
  jest zapisana przy instalacji, a każda nawigacja dostaje zapisaną stronę. Baza produktów: kopia
  na zawsze, jedna (nowa wersja ma nowy hasz w nazwie). Zdjęcia produktów: 400 ostatnich na 30 dni.
  Kafelki mapy: tylko oglądane, 500 na 7 dni. Overpass i serwer przypomnień idą prosto do sieci.
- **Rejestracja w `main.tsx`, poza Reactem** (`registerSW` z `virtual:pwa-register`, stan w `src/pwa.ts`):
  ustawiona przed pierwszym renderem, a nie w komponencie, który montuje się dopiero po wczytaniu
  danych; sama rejestracja rusza po wczytaniu strony, żeby nie konkurować z pierwszym ekranem.
  Dzięki temu o nową wersję pyta nawet taka, która wywraca się na starcie.
- **Nowa wersja czeka na „Odśwież”.** Gdy wdrożenie przyniesie nową wersję, na dole pojawia się
  pasek „Nowa wersja aplikacji” z „Odśwież” i „Później” — **nigdy w trakcie treningu**: przeładowanie
  w środku serii gubiłoby miejsce, a pasek pod kciukiem łatwo trącić. Do tego czasu działa stara
  wersja ze swoimi plikami. O nowe wersje aplikacja pyta przy starcie, po powrocie i co godzinę.
- **Ekran awarii zamiast białej strony.** Błąd w renderze poza zakładką Jedzenie (ta ma własną granicę)
  łapie `RootBoundary`: goły ekran „Coś poszło nie tak” bez stanu aplikacji. Od razu pyta o nowszą
  wersję, a jego „Odśwież” wpuszcza czekającą (albo kończącą instalację) i dopiero wtedy przeładowuje
  stronę — bez tego zapisana strona wczytywałaby wciąż tę samą zepsutą wersję, dopóki aplikacji nie
  zamknie się do końca. Zapisanych danych nie rusza: trening i dziennik jedzenia czekają w przeglądarce.
- **Manifest** generuje wtyczka (jedno źródło w `vite.config.ts`): nazwa, tryb `standalone`,
  orientacja pionowa, kolory, start na ekranie Dziś, adresy względne (działa pod dowolną ścieżką)
  i skróty z ikony: „Przekąska ruchowa”, „Jedzenie dziś”, „Przepisy”, „Sklepy w pobliżu”,
  „Osiągnięcia”.
- **Kroje pisma z aplikacji** (`@fontsource`: Oswald i IBM Plex Sans), nie z Google Fonts — działają
  offline od pierwszej wizyty, nikt nie trafia na cudzy serwer, a obrazki do udostępnienia dostają
  prawdziwe litery.
- **Polityka bezpieczeństwa treści** (`vite/csp.ts`) w zbudowanej stronie: skrypty tylko własne,
  obrazy z Open Food Facts, kafelków OSM i miniatur YouTube'a, połączenia z Overpass i serwerem
  aplikacji (`VITE_API_URL`), ramki z YouTube'a. Test przegląda kod i pilnuje, żeby każdy adres
  `https://`, z którym aplikacja rozmawia, był w polityce.
- **Ikony** w `public/icons/`: zwykła 192 i 512 px, maskowalna 512 px, 180 px dla iOS i wektorowa.
- **iPhone instaluje ręcznie.** Android sam proponuje instalację, iOS nie zrobi tego nigdy — nie ma
  ani okna, ani zdarzenia dla strony. Dlatego na iPhonie i iPadzie poza aplikacją z ikony
  (`src/install.ts`) pod paskiem aplikacji stoi niebieski pasek „Dodaj do ekranu początkowego”,
  w miejscu paska wsparcia i na tych samych zasadach: nie w trakcie treningu, nie pod wprowadzeniem.
  Otwiera instrukcję w trzech krokach — inny pierwszy krok w Safari, w innej przeglądarce
  i w przeglądarce wbudowanej w Instagram czy Facebooka, skąd najpierw trzeba przejść do Safari.
  Powód jest ważniejszy niż wygoda: Safari kasuje dane strony nieotwieranej przez tydzień, a tu
  w przeglądarce leży cała historia; aplikacja z ikony tego limitu nie ma. Ma za to własne miejsce
  na dane, więc instrukcja mówi, jak przenieść zapisy kopią. × chowa pasek na stałe, instrukcja
  zostaje w Ustawieniach.
  **iOS**: `apple-touch-icon`, tryb pełnoekranowy, tytuł pod ikoną; pasek u góry i dolna nawigacja
  mają marginesy na wycięcie ekranu (`safe-area-inset`).
- **Tryb deweloperski bez service workera** — trzymałby stare pliki i każda zmiana wymagałaby
  twardego odświeżenia. Pracę offline sprawdza się na `npm run build && npm run preview`.

## Uwagi do autora

Dymek w pasku aplikacji — na każdym ekranie — i przycisk w Ustawieniach otwierają małe okno:
**e-mail** (opcjonalnie, tylko do odpowiedzi), **wiadomość** i **zrzut ekranu**. Zrzut robi się
sam, z ekranu pod oknem (`html-to-image`, ładowane dopiero przy otwarciu okna), można go
odznaczyć albo podmienić obrazem z galerii — zmniejszonym do 1600 px i JPEG-a.

Razem z wiadomością idzie **ślad wizyty**, który pozwala odtworzyć problem: ekran, z którego
ktoś pisze, czas wizyty i czas z aplikacją na ekranie, kolejne ekrany i stuknięcia po kolei,
błędy aplikacji, przeglądarka, rozmiar ekranu, strefa czasowa, liczba zapisanych treningów
i nazwa planu. Ślad zbiera jedno nasłuchiwanie kliknięć (`src/trail.ts`), więc nie rozjedzie się
z aplikacją, gdy dojdzie nowy przycisk.

**Dlaczego nie całkiem niewidocznie.** Wprowadzenie obiecuje „bez kont, bez reklam, bez
śledzenia”, a RODO wymaga powiedzenia, co się zbiera, w chwili zbierania. Dlatego ślad żyje
tylko w pamięci karty, nie zapisuje się w przeglądarce i wychodzi wyłącznie z wiadomością,
którą ktoś sam wysyła; liczby w etykietach (wagi, kroki) są zamienione na `#`, a samo okno
nie trafia do śladu. W oknie stoi jedna linijka „wysyłam też informacje techniczne” i rozwijane
„co dokładnie” — bez przeszkadzania, ale bez ukrywania.

Wiadomości trafiają do serwera aplikacji (`server/api`, ten sam co przypomnienia), a autor
czyta je na stronie za hasłem — z miniaturą zrzutu i rozwijanym śladem — a z webhookiem
Discorda także na swoim kanale, zaraz po wysłaniu (ślad zostaje w bazie). Szczegóły, limity
i ochrona przed botami: `server/api/README.md`.

## Przypomnienia

Rano o 7:30 — w dni, w które plan ma trening („Dziś trening: Trening A”). Wieczorem o 19:30 —
codziennie, żeby wpisać kroki, bieżnię, rower albo taniec z całego dnia. Na życzenie o 7:00 —
o porannym ważeniu (domyślnie wyłączone; patrz „Ważenie”). Godziny według zegara
telefonu, na Androidzie i na iPhonie. Włącza się je w Ustawieniach, każde osobno.

**Dlaczego potrzebny jest serwer.** Strona nie umie zaplanować powiadomienia na 7:30. API, które
miało to robić (Notification Triggers), wycofano z Chrome, Safari nigdy go nie miał, a iOS
usypia aplikację w tle — żaden zegar w JavaScripcie nie dotrwa do rana. Działa tylko Web Push:
o czasie wysyła serwer, a telefon pokazuje. Na iPhonie od iOS 16.4 i tylko w aplikacji dodanej
do ekranu początkowego; karta mówi wtedy wprost, jak ją dodać.

**Serwer nic nie wie o treningach.** Aplikacja sama układa listę gotowych przypomnień na trzy
tygodnie i przysyła ją przy każdym otwarciu; serwer (`server/api`, Cloudflare Worker z cronem
co 5 minut) tylko pilnuje zegara. Dostaje adres powiadomień telefonu, strefę czasową i teksty
— bez planu, historii i danych o człowieku. Gdy ktoś przestaje otwierać aplikację, przypomnienia
same się kończą. Konta nie ma: subskrypcję zna tylko telefon, który ją założył.

**Zgoda dopiero po stuknięciu** w „Włącz przypomnienia”, nigdy przy starcie aplikacji —
pytanie bez kontekstu przeglądarki karzą wyciszeniem, a ludzie odmawiają, zanim wiedzą, o co
chodzi. Teksty przypomnień zapraszają, nie naciskają, i nie mają rodzaju gramatycznego, bo
dostaje je i Gustaw, i Gosia — pilnuje tego test.

Wdrożenie serwera i dwie zmienne w GitHubie (`API_URL`, `VAPID_PUBLIC_KEY`): `server/api/README.md`.
Ten sam serwer przyjmuje uwagi od użytkowników (o nich wyżej).
Bez nich karty przypomnień nie ma, a aplikacja działa jak dotąd.

## Publikacja

Aplikacja stoi na GitHub Pages: <https://aleksanderdudek.github.io/gym-training-tracker/>

Wdrożenie prowadzi `.github/workflows/deploy.yml` — każdy push na `main` uruchamia
`typecheck`, lint, testy i build, a dopiero potem publikuje `dist/`. Błąd typów, błąd lintu
(ostrzeżenia nie) albo nieprzechodzący test zatrzymują wdrożenie.

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

Przekąski mają w zapisie własną listę (`snacks`), obok dziennika treningów, a wybrana postać
siedzi w ustawieniach (`cfg.avatar`). Zapis sprzed przekąsek wczytuje się z pustą listą, a przy
wczytaniu i imporcie odpadają wpisy z nieznanym ćwiczeniem, zepsutą datą albo zerowym wynikiem.
Doświadczenie i poziom postaci — jak punkty planu — są wyprowadzane, nie zapisywane.

Kroki, bieżnia i rower mają listę `cardio`, a ważenia — listę `body` (po dniu, jedno na dzień);
wzrost siedzi w `cfg.height`. Zapisywane są liczby z wyświetlacza, **nigdy kalorie**: kalorie
liczą się przy każdym otwarciu z wpisu i wagi z jego dnia, więc poprawka wzoru albo pierwsze
ważenie od razu obejmuje całą historię. Przy wczytaniu i imporcie odpadają wpisy spoza zakresów
(to literówki) i ważenia z zepsutą datą; wzrost spoza ludzkiego zakresu jest pomijany.

Dane z zegarka mają osobne pole `watch`: dni kroków, aktywności i zdrowie po dniach, czas
ostatniej przyjętej paczki i chwilę odbioru. To liczby z zegarka, a nie wpisy — wpisy ruchu
wyprowadza z nich `cardioOf`. Przy wczytaniu i imporcie przechodzą te same zakresy co paczka
z zegarka. Klucza do zegarka w zapisie nie ma: leży osobno w pamięci strony (`gt-garmin-key`),
więc eksport niesie liczby, które już przyszły, ale nie otwiera skrzynki z nowymi.

Dane z telefonu mają pole `phone` tej samej budowy: system (`ios`/`android`), dni z krokami,
tętnem, snem i wagą, przejazdy rowerem, czas paczki i chwila odbioru. Klucz telefonu leży
w `gt-phone-key`, też poza eksportem.

Trwająca sesja trzyma zegar (`session.clock`): start i części jako chwile, nie liczniki — tak jak
koniec przerwy, więc odświeżenie strony i zgaszony ekran niczego nie gubią. Zamknięty trening
zapisuje w dzienniku `time`: sekundy całości i części (początek i koniec od startu). Przy wczytaniu
i imporcie zepsuty zegar albo czas odpada, a trening zostaje.

**Jedzenie leży osobno, w IndexedDB** (baza `produkty-pl-dieta`, Dexie): profil diety, dni, wpisy,
plan z Excela, własne potrawy, zestawy i ulubione (wersje 2 i 3 bazy; starsza baza i starsza kopia
bez nich wczytują się bez zmian) — jest ich za dużo i są po dniach, więc nie pasują do jednego zapisu
`localStorage`. Waga ma jedno źródło: ważenia z diety, z kopii diety albo z planu z Excela przy
wejściu w Jedzenie przechodzą do dziennika wagi i znikają z diety; kroki dieta czyta z wpisów
i zegarka. Eksport z Ustawień zapisuje jeden plik — trening, a gdy dziennik jedzenia ma cokolwiek
(rozstrzyga zawartość bazy, nie to, czy jest profil diety), także jego kopię pod `diet`; gdy bazy nie
da się odczytać, plik i tak powstaje, a komunikat mówi, że jest bez dziennika. Import odtwarza oba,
a „Usuń wszystkie dane” czyści oba, razem z zapamiętanym miejscem sklepów i kopiami kafelków mapy
i zdjęć produktów (kafelki zdradzają, jakie okolice ktoś oglądał). Baza ma tę samą nazwę co
w Produktach PL — na tej samej domenie dawny dziennik pojawia się w aplikacji sam.

## Zastrzeżenie

Aplikacja nie zastępuje fizjoterapeuty, dietetyka ani konsultacji lekarskiej. Zanim zaczniesz,
porozmawiaj z lekarzem, jeśli masz chorobę serca, nadciśnienie, cukrzycę albo inną chorobę
przewlekłą, jesteś w ciąży lub po porodzie, wracasz po urazie albo operacji, czujesz ból w klatce
piersiowej przy wysiłku albo zdarzają ci się zawroty i omdlenia (za PAR-Q+ i ACSM). Przerwij
trening przy bólu w klatce, duszności większej niż zwykła zadyszka, zawrotach, kołataniu serca
albo ostrym bólu stawu czy kręgosłupa. Kalorie są szacunkiem, nie zaleceniem żywieniowym. Dziennik
jedzenia liczy i podpowiada, ale nie zastępuje dietetyka: przy chorobach przewlekłych, w ciąży,
przy zaburzeniach odżywiania i przy szybkim chudnięciu ustal cele z lekarzem. Dane o produktach
pochodzą od użytkowników Open Food Facts i bywają niepełne albo błędne.

W aplikacji krótka wersja stoi we wprowadzeniu (na każdym ekranie, bo da się je pominąć
z pierwszego), przed startem planu, pod podglądem treningu i przy kaloriach, a pełna — w Ustawieniach
(„Zdrowie i bezpieczeństwo”). Tekst ma jedno źródło: `components/Health.tsx`.

