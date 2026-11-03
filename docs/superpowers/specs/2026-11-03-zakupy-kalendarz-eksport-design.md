# Zakupy z dziennika, kalendarz z Google, raport Excel dla dietetyka/lekarza

Data: 2026-11-03. Prośba właściciela (w skrócie):

1. Planer zakupów na podstawie historii odżywiania, z interwałem, kiedy robi zakupy.
2. Prosty kalendarz, który da się zintegrować z Kalendarzem Google: kiedy trening / zakupy / badania (przypomnienia).
3. Excel z całością informacji (makro, kcal, składniki) — maksymalnie pełny dla dietetyka albo lekarza: same fakty o
   jedzeniu, piciu, godzinach wpisów, treningach (dni i godziny), wynikach badań i pomiarach w czasie.

Tryb autonomiczny („Pick recommended”): decyzje poniżej podjęte bez pytania, z uzasadnieniem.

## Wspólny fundament (zrobiony przed rozdzieleniem pracy)

- `src/food/shop/rhythm.ts` — `ShopRhythm`: stałe dni tygodnia (`{kind:'weekdays', days, at}`) albo co N dni od daty
  (`{kind:'every', days, from, at}`), `at` to godzina wyjścia (wydarzenie w kalendarzu). `nextShopDay`, `shopDays`,
  `shopPeriod` (zakupy w dniu X kupują do dnia przed następnymi), `cleanRhythm`. Domyślnie sobota 10:00.
  - Zapis: `Profile.shopping?: ShopRhythm | null` (pole opcjonalne — stare profile i fikstury bez zmian), czyszczone
    w `cleanProfile`, więc idzie w kopii zapasowej.
  - Dlaczego na profilu diety: lista z dziennika istnieje tylko z dziennikiem (a ten wymaga profilu), kopia zapasowa
    przenosi rytm bez nowej tabeli. Kalendarz bez profilu pokazuje treningi i badania, bez zakupów.
  - Dlaczego dwa rodzaje: „wt i pt” nie da się zapisać jako „co N dni”, a „co 10 dni” jako dni tygodnia.
- `src/food/labs/retest.ts` — `retestOf(plan)` (data i markery badania kontrolnego), wyjęte z `DietView`, żeby strona
  badań, kalendarz i raport liczyły termin jedną regułą.
- `src/food/diet/parts.ts` — `entryParts(entry, sets)`: z czego był wpis (porcja przepisu = jego składniki × porcje,
  zestaw = części, reszta = sam wpis), `gramsOf`, `servingsIn`, `recipeOf`. Wspólne dla listy zakupów i raportu.

## A. Zakupy z dziennika

Miejsce: istniejąca strona „Lista zakupów” (`#/jedzenie/zakupy`). Dziś pokazuje tylko listę z planu meal prep, a bez
planu pusty ekran. Teraz dwa źródła:

- „Z dziennika” (nowe, domyślne, gdy nie ma otwartego planu) i „Z planu” (dotychczasowe; przełącznik tylko, gdy jest
  otwarty plan). Ostatni wybór zapamiętany na urządzeniu; w adresie `?z=dziennik|plan`.
- Nowy kafelek „Zakupy” w rzędzie skrótów dziennika (6 kafelków, siatka 3×2 — większe pola do stuknięcia niż 6 w rzędzie
  przy 320 px).

Rytm zakupów: karta na górze listy („Robię zakupy: w stałe dni / co kilka dni”, chipy pn–nd albo liczba dni + data
następnych, godzina). Dopóki nieustawiony, lista liczy się z domyślnej soboty i karta prosi o ustawienie.

Reguła listy (`src/food/shop/history.ts`, czysta funkcja):

- Okno: 28 dni przed dziś (dziś jeszcze trwa). Dzielnik to dni z choć jednym wpisem, nie dni kalendarzowe — dzień bez
  zapisu to brak danych, nie post. Mniej niż 3 zapisane dni: pusty stan „zapisz jedzenie z kilku dni”.
- Każdy wpis rozpisany przez `entryParts`. Linia na produkt (klucz `product:EAN`), na składnik przepisu (IngredientId)
  albo na własne jedzenie (`custom:`). Pomijane: restauracje, dania ze zdjęcia, pozycje planu (catering), szybkie wpisy
  bez źródła (też szacunek napoju słodzonego), woda i lód.
- Ilość na zakupy = średnia na zapisany dzień × liczba dni okresu (`shopPeriod`). Opakowania jak w liście z planu
  (`packSize`, `packsFor`), sztuki dla jaj, bananów itd. (`PIECE_GRAMS`).
- Regularne (jedzone w ≥ 2 różne dni okna) to lista główna; jednorazowe zwinięte w „Czasem” — sugestia, nie zakup.
  Składniki „pantry” (przyprawy, olej) w „Sprawdź w domu”.
- Kolejność działami sklepu jak lista z planu (składnik → `AISLE`; produkt → dział pierwszego składnika, którego matcher
  go przyjmuje, inaczej „inne”).
- Odhaczanie per dzień zakupów (localStorage), udostępnianie tekstem jak w liście z planu.

Uczciwość: nagłówek mówi, z czego to policzone („z 19 zapisanych dni z ostatnich 4 tygodni”), stopka: „to średnia
z dziennika, nie zapas w domu — zajrzyj do lodówki”.

## Wynik i odstępstwa — A

Zrobione na gałęzi `feat/zakupy-z-dziennika`: silnik `src/food/shop/history.ts` (`historyList`, `historyAmount`,
`historyText`), zapis `src/food/shop/store.ts`, ekran `components/prep/DiaryShopping.tsx` + `RhythmCard.tsx`,
wiersze listy wyjęte do `ShoppingRows.tsx` (wspólne dla obu źródeł), kafelek „Zakupy” w dzienniku.

Doprecyzowania i odstępstwa:

- Rytm zapisuje `saveShopping` (tylko pole `shopping` w zapisanym wierszu, jak `saveFast`), nie `saveProfile`
  z całym profilem z `useProfile` — tamten zapisałby z powrotem `dailyKcal` i resztę z chwili odczytu.
- Składniki przepisów idą przez `shoppingList` z listy planu (jako `SideUse` na dzień zakupów), więc mają produkt
  z koszyka (`preferredStore` profilu, bez niego „dowolny sklep”), opakowania, sztuki, dział i cenę jak plan. Bez
  podpowiedzi „zamroź” — z dziennika nie wiadomo, którego dnia co zostanie zjedzone. Jedna lista działami, bez
  podziału na wizytę i zamówienie (koszyk to jeden sklep).
- Produkt z dziennika, który jest tym samym produktem, co wybrany dla składnika przepisu (skyr w misce i skyr
  osobno), to jedna linia z sumą obu ilości (pierwszy przegląd na danych demo pokazał dwie linie „Skyr Natural”).
- Produkt zapisany bez gramów („1 opak.”): gramy z kcal wpisu i kcal/100 g z etykiety. Własne jedzenie bez gramów:
  porcje jak w dzienniku („7 × 1 kromka”). Przepis w zestawie rozpisany na składniki.
- Liczone są tylko składniki przepisów, `product:` i `custom:`; wszystko inne (lokale, zdjęcia, plan, szybkie wpisy,
  przepis usunięty z katalogu) pominięte, a stopka mówi, ile wpisów pominięto.
- „Sprawdź w domu” = składniki `pantry`, niezależnie od tego, ile dni były jedzone; „Czasem” = reszta jedzona
  jednego dnia (zwinięte `<details>`, też do odhaczenia).
- Źródło: bez otwartego planu zawsze dziennik (bez przełącznika). Z planem: `?z=` z adresu, potem `?plan=` (odnośnik
  z planu → lista planu), potem ostatni wybór na urządzeniu (`gt:zakupy-zrodlo`), domyślnie plan. Przełącznik to
  odnośniki (`seg`), jak `PlanSwitch`. Odhaczenia: `gt:zakupy-dziennik` = `{shop, keys}` — następne zakupy zaczynają
  od zera.
- Strzałka wstecz z `#/jedzenie/zakupy` wraca do dziennika (była do planu): wejście jest teraz z kafelka dziennika.
- Póki baza produktów się wczytuje, lista liczy się bez niej (wartości typowe, bez opakowań i cen) z dopiskiem
  „Wczytuję bazę produktów…”; po wczytaniu linie dostają produkty — klucze odhaczeń się nie zmieniają.
- W „co kilka dni” pole daty pokazuje najbliższy dzień rytmu (a nie zapisane `from`); kafelki dziennika w siatce
  3×2 bez osobnego mniejszego pisma poniżej 360 px.
- Link „Kalendarz — zakupy, treningi, badania” na dole listy (oba źródła) do `#/kalendarz`.

Uwaga dla prowadzącego: fundament dodał `shopping?: ShopRhythm | null` także do interfejsu `Reached` w
`diet/types.ts` — wygląda na przypadek (rytm siedzi w `Profile`); nie ruszałem.

## B. Kalendarz (`#/kalendarz`)

Strona z miesiącem (pn–nd, 7 kolumn) i listą „Najbliższe 14 dni”. Na dniu: trening z planu (zaplanowany / zrobiony /
opuszczony — z `snapshot` i dziennika), zakupy (rytm), badanie kontrolne (`retestOf`) i dni pobrania wyników.
Stuknięcie dnia pokazuje jego wydarzenia. Wejścia: karta/wiersz na ekranie Dziś, link w karcie Przypomnienia
w ustawieniach, link z listy zakupów.

Integracja z Google — decyzja: bez subskrypcji URL. Subskrypcja (`webcal://`) wymaga serwera, który trzyma harmonogram
zdrowotny i odpowiada Google'owi co kilka godzin; aplikacja trzyma dane na telefonie i tak zostaje. Zamiast tego:

1. „Dodaj do Kalendarza Google” — przy każdym rodzaju (treningi, zakupy, badanie) link do formularza wydarzenia Google
   (`calendar.google.com/calendar/render?action=TEMPLATE`) z `recur=RRULE:…` (treningi tygodniowo w dni planu do jego
   końca, zakupy wg rytmu, badanie jednorazowo) i `ctz=<strefa telefonu>`, żeby godzina nie skakała przy zmianie czasu.
   Google zapisuje wydarzenie u siebie z domyślnymi powiadomieniami użytkownika; to są „przypomnienia” z prośby.
   Parametry `recur`/`ctz` są nieoficjalne (społecznościowa dokumentacja, biblioteki `datebook`, `calendar-link`), więc
   test sprawdza tylko kształt adresu, a strona mówi, co zrobić, gdy formularz się nie otworzy (plik .ics).
2. „Pobierz plik .ics” — wszystkie wydarzenia na 12 tygodni jako osobne wydarzenia w UTC (rozpisane dzień po dniu, więc
   zmiana czasu niczego nie przesuwa), z nazwami treningów i `VALARM` (trening 60 min przed, zakupy 30 min przed,
   badanie wieczór przed). Stałe `UID` (`trening-2026-11-05@gym-tracker`), więc ponowny import nadpisuje zamiast
   dublować. Działa w Apple Calendar, Outlooku i w Google (Ustawienia → Importuj).
3. Godzina treningu do ustawienia na stronie (domyślnie 18:00, 60 min) — `cfg.calendar.trainAt`; godzina zakupów
   z rytmu; badanie 08:00, 30 min (laboratoria pobierają rano), opis bez porad medycznych („zapytaj w laboratorium
   o przygotowanie”).

Strona mówi wprost: Google nie widzi zmian na bieżąco — po zmianie planu dodaj wydarzenia jeszcze raz.

## C. Raport Excel dla dietetyka / lekarza

Prawdziwy plik `.xlsx` (nie CSV): wiele arkuszy w jednym pliku, typowane komórki (daty jako daty, liczby jako liczby —
lekarz sortuje i filtruje), pogrubiony nagłówek, zamrożony pierwszy wiersz, autofiltr, szerokości kolumn. Własny
mały zapis (`src/engine/xlsx.ts`, fflate `zipSync` + SpreadsheetML ze `sharedStrings`), zamiast biblioteki ~1 MB —
tak jak czytnik w `diet/xlsx.ts`; test robi pełny obieg zapis → `readWorkbook`.

Arkusze (PL; EN w wersji angielskiej):

1. Informacje — data pliku, zakres, osoba (płeć, wiek, wzrost), cel diety i dzienne cele makro, objaśnienia jednostek
   i źródeł („pusta komórka = nieznane, nie zero”, kcal z etykiet / szacunki), krótka nota, że to dane wpisane przez
   użytkownika.
2. Dni — dzień po dniu: kcal i cel, białko, węglowodany, tłuszcz, błonnik, cukry, sól, liczba wpisów, godzina
   pierwszego i ostatniego posiłku, napoje (ml), w tym woda, kofeina, kroki, waga, trening (nazwa, minuty), ruch.
3. Jedzenie — wpis po wpisie: data, godzina, posiłek, nazwa, ilość, gramy, źródło, kod EAN, kcal, makro, błonnik,
   cukry, sól.
4. Składniki — z czego były przepisy i zestawy (`entryParts`).
5. Napoje — każdy napój: godzina, rodzaj, ml, kofeina i kcal (szacunek).
6. Treningi — sesja po sesji: data, godzina rozpoczęcia, czas, nazwa, serie, powtórzenia, objętość, notatka.
7. Serie — seria po serii (jak CSV) z notatką ćwiczenia.
8. Ruch — kroki, bieżnia, rower, taniec, przekąski ruchowe; źródło (ręcznie / zegarek / telefon).
9. Pomiary — waga i obwody w czasie.
10. Badania — wynik po wyniku: data pobrania, laboratorium, badanie, wynik, jednostka, zakres referencyjny, ocena.

Zakres: 30 dni / 90 dni / wszystko (domyślnie wszystko). Ustawienia → dane: nowa karta „Raport dla dietetyka lub
lekarza (Excel)” nad kartą CSV (CSV zostaje dla prostych arkuszy).

## Poza zakresem

- Subskrypcja kalendarza przez URL (wymaga serwera z danymi zdrowotnymi).
- Odejmowanie zapasów z domu od listy zakupów (aplikacja nie wie, co jest w lodówce).

## Wynik i odstępstwa — C

Zrobione (gałąź `feat/eksport-excel`):

- `src/engine/xlsx.ts` — zapis .xlsx (fflate `zipSync`): `[Content_Types].xml`, `_rels`, `docProps` (tytuł,
  data utworzenia), skoroszyt, `sharedStrings`, `styles.xml` (pogrubiony nagłówek z wypełnieniem i dolną kreską,
  formaty `yyyy-mm-dd`, `hh:mm`, `yyyy-mm-dd hh:mm`, `0`, `0.0`, `0.00`), na arkuszu szerokości kolumn, zamrożony
  pierwszy wiersz, autofiltr (+ `_xlnm._FilterDatabase`). Komórki: tekst, liczba, `int`, `dec(n, 1|2)`, `day`,
  `clock`, `stamp` (chwila lokalna); brak / NaN / zepsuta data → brak komórki. Znaki zakazane w XML 1.0 wycinane,
  nazwy arkuszy bez `[]:*?/\`, ≤ 31 znaków, bez powtórek. Tekst zawsze `t="s"`, więc „=SUMA(…)” w nazwie potrawy
  nie jest formułą. Sprawdzone: obieg przez `readWorkbook`, openpyxl 3.1.5 (venv w scratchpadzie) i Quick Look.
- `src/food/report.ts` — `buildReport` (czysta funkcja) i `reportFromDb` (Dexie przez te same sita co kopia:
  `cleanProfile`, `cleanEntry`, `cleanDay`, `cleanSet`, `loadReports`). Ładowany dynamicznie z karty (osobny
  chunk `report-*.js`, razem z fflate i Dexie).
- Karta „Raport dla dietetyka lub lekarza (Excel)” nad kartą CSV (`src/components/ReportExport.tsx`): co jest
  w pliku, uwaga o prywatności, zakres 30 dni / 90 dni / Wszystko (domyślnie wszystko), „Pobierz plik .xlsx”,
  komunikat „Raport gotowy: 8 arkuszy, 1200 wierszy danych.”. Plik `gym-tracker-raport-YYYY-MM-DD.xlsx`
  (po angielsku `gym-tracker-report-…`), dzień lokalny. Kotwica `#/ustawienia?karta=raport` (przewija do karty jak
  karty urządzeń). Karta CSV została bez zmian (bez nagłówka „Inne formaty” — dwie karty obok siebie czytają się
  dobrze).

Arkusze (pusty arkusz wypada; „Informacje” mówią, których nie ma w zakresie):

1. Informacje — raport, utworzono, zakres (z datami), płeć, wiek, wzrost, początek diety, waga startowa
   i docelowa, profil diety, tempo, dzisiejszy cel kcal i makro, cel napojów, ciąża/karmienie, cel uzgodniony
   z lekarzem, okno jedzenia; lista arkuszy z liczbą wierszy, „Bez danych w zakresie”, 12 objaśnień, uwaga
   „nie jest wyrobem medycznym; plik nie zawiera diagnozy ani zaleceń”.
2. Dni — Data, Dzień tygodnia, kcal, Cel kcal, Białko, Cel białka, Węglowodany, Tłuszcz, Błonnik, Cukry, Sól,
   Wpisy jedzenia, Wpisy bez makro, Pierwszy wpis, Ostatni wpis, Okno jedzenia (h), Napoje (ml), Woda (ml),
   Kofeina (mg, szacunek), Dziennik dnia (cały / nie wszystko), Waga, Kroki, Treningi, Trening (min),
   Cardio (min), Przekąski ruchowe, Notatka dnia.
3. Jedzenie — Data, Godzina, Pora (wg godziny), Nazwa, Ilość, Gramy, Źródło danych, Kod EAN, kcal, Białko,
   Węglowodany, Tłuszcz, Błonnik, Cukry, Sól.
4. Składniki — Data, Godzina, Wpis, Rodzaj (przepis / zestaw), Składnik, Gramy, Ilość, Kod EAN.
5. Napoje — Data, Godzina, Rodzaj, ml, Kofeina (mg, szacunek), kcal (szacunek), Cukry (g, szacunek).
6. Treningi — Data, Rozpoczęcie, Zakończenie, Czas (min), Trening, Tydzień lżejszy, Samopoczucie przed,
   Ćwiczenia, Serie, Powtórzenia, Sekundy (ćwiczenia na czas), Objętość (kg × powt.), Notatka.
7. Serie — Data, Rozpoczęcie, Trening, Ćwiczenie, Partia, Seria, Powtórzenia, Sekundy, Ciężar, Wysiłek,
   Zapas powtórzeń, Notatka do ćwiczenia.
8. Ruch — Data, Godzina, Rodzaj, Kroki, Minuty, Prędkość, Nachylenie, Moc, Taniec, Droga (km), Ćwiczenie,
   Powtórzenia, Sekundy, Ciężar, kcal ruchu (szacunek), Źródło (wpisane ręcznie / zegarek / telefon).
9. Pomiary — Data, Waga (kg), BMI, Talia, Biodra, Klatka, Ramię, Udo.
10. Badania — Data pobrania, Laboratorium, Grupa, Badanie, Wynik, Znak (< >), Wynik opisowy, Jednostka,
    Wynik z wydruku, Zakres od, Zakres do, Źródło zakresu, Względem zakresu, Względem celu z wytycznych,
    Wprowadzono z.

Odstępstwa i doprecyzowania:

- **Jedenasty arkusz „Urządzenia”** (tylko gdy są dane): dzień po dniu z zegarka i telefonu — kroki, droga,
  piętra, minuty intensywne, tętno spoczynkowe / min / śr. / maks., stres, Body Battery, sen (wynik zegarka,
  minuty z telefonu), waga z telefonu. Prośba mówiła „maksymalnie pełny” — to fakty, które aplikacja już ma.
- **Czas treningu**: dziennik zapisuje chwilę zamknięcia (ISO) i `time.secs`. Rozpoczęcie = zamknięcie − czas,
  w czasie lokalnym; trening bez zegara sesji ma tylko „Zakończenie”. Dzień treningu w raporcie to dzień lokalny
  rozpoczęcia, nie `dayKey` (UTC) z historii treningów — między północą a 1:00/2:00 różnią się o dzień
  (znane ograniczenie, opisane w nagłówku modułu).
- **Biegi i marsze z zegarka** mają w „Ruchu” własne wiersze z godziną, drogą i prędkością („w krokach dnia”, bez
  kcal — liczą się w krokach). Kroki nie mają godziny (suma dnia; `at` wpisu z urządzenia to umowne 23:59).
- **Nieznane ≠ zero**: dzień bez wpisów ma puste kcal; makro / błonnik / sól to suma z wpisów, które je znają
  (żaden nie zna → pusto). Napoje: woda i napój bez cukru mają kcal 0, kawa i herbata puste kcal (mleko, cukier
  nieznane); kofeina tylko kawa, herbata (szacunek) i woda (0).
- **Napój słodzony** w „Jedzeniu” ma źródło „Napój słodzony (szacunek)” (rozpoznany po `entryId` w napojach dnia).
- **Tryb „bez liczenia kalorii”** (i poniżej 18 lat): bez kolumn celów (puste) i bez celów w „Informacjach”;
  zjedzone kcal zostają, bo to zapis, a plik jest dla specjalisty.
- **Ocena badania** to porównanie z zakresem („poniżej zakresu / w zakresie / powyżej zakresu / bez zakresu”),
  słowami innymi niż w aplikacji („Za nisko”), żeby nie brzmiało jak diagnoza. Bez płci zakres z katalogu nie jest
  stosowany — tylko zakres z wydruku. Wartości wyliczane przez aplikację (eGFR, HOMA-IR, non-HDL) nie trafiają do
  pliku — są tylko wyniki z wydruku.
- **Zakres** 30/90 dni liczy dzień dzisiejszy jako ostatni (30 dni = dziś i 29 wcześniej); nic po dziś (np.
  zaplanowany cheat meal) do pliku nie trafia. Pomijane są też plany (meal prep, plan badań) — to plany, nie fakty.
- **„Informacje”** mają liczby jako tekst w formacie języka (np. „82,00”): w szerokiej kolumnie objaśnień liczba
  stałaby przy prawym brzegu, daleko od etykiety. Daty i liczby w arkuszach danych są typowane.
- **Strona Badań**: pod wynikami zdanie z odnośnikiem „Ustawienia → Raport (Excel)” (`#/ustawienia?karta=raport`),
  tylko gdy jest choć jedno badanie. Bez osobnego pobierania z tej strony — raport potrzebuje stanu treningów,
  którego strona badań nie ma.
