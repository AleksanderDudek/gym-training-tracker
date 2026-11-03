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
