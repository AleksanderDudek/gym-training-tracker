# Sztab: funkcje FitFive i Trainero — analiza luk i projekt

25 listopada 2026. Zlecenie autora: „skopiować wszystkie ficzery fitfive.app i trainero.com/pl do
Sztabu”, z wolną ręką co do kształtu („pick recommended”, autor poza komputerem). **Decyzje podjęte
samodzielnie na prośbę autora** — każda z uzasadnieniem w tabeli niżej.

Kopiujemy **możliwości**, nie teksty, nazwy, wygląd ani znaki towarowe. Nic z ich stron nie trafia
do kodu ani do interfejsu.

## Źródła (przegląd z 25.11.2026, własnymi słowami)

- **FitFive** (fitfive.app, PL): panel w przeglądarce + aplikacje iOS/Android; podopieczny ma darmowe
  konto z zaproszenia. Karta klienta (pomiary, historia, plany, nawyki, suplementy, płatności),
  kreator treningu i jadłospisu (z wymianą posiłku), atlas z wideo, plany nawyków i suplementów
  (codzienna lista), ankiety i wywiad, czat 1:1 i z zespołem + kanał ogłoszeń, rozmowy wideo,
  kalendarz z dostępnością, strony rezerwacji, zajęcia grupowe, synchronizacja z Google Calendar,
  płatności przez Stripe trenera, karnety i pakiety, faktury i KSeF, statystyki biznesowe (LTV,
  retencja), zespół z rolami i zadaniami, publiczna strona trenera, AI do szkiców planów i diet
  (szkic zatwierdza trener), eksport planu do PDF, przypomnienia (push, mail, SMS płatny).
- **Trainero** (trainero.com/pl): aplikacja trenera, aplikacja klienta (38 języków), CRM i sklep.
  Kreator treningu (2000+ ćwiczeń, ~100 szablonów) i diety (4000+ produktów, makro), biblioteka
  mediów, **oś czasu** (kurs 1–52 tygodnie: zdarzenia wypuszczane automatycznie o dacie, 14 rodzajów,
  zablokowane/ukryte do daty, kopiowanie tygodni między klientami i grupami, odhaczanie, wątek przy
  zdarzeniu, cotygodniowy raport), kalendarz tygodnia klienta, zapis treningu z oceną i komentarzem,
  dieta z odhaczaniem posiłków i światłami (zielone/żółte/czerwone), lista zakupów z diety, 20+
  mierników i własne, wykresy, porównanie zdjęć, kalendarz rezerwacji z limitem miejsc i kolejką,
  kreator formularzy (wywiad, ankiety, raporty tygodniowe), czat 1:1 i grupowy z plikami, forum
  grupy, banery w aplikacji, sklep (produkty, subskrypcje, kody rabatowe, umowy), wiele lokalizacji,
  API i webhooki, white label.

## Co Sztab już ma (etap 1)

Lista podopiecznych, pulpit (przegląd, trening, jedzenie, ciało, badania), zaproszenia z linkiem
i QR, biblioteka (plan, trening, cele, badania, zalecenie z listą), wysyłka pięciu rodzajów
zaleceń, potwierdzenia (zobaczone / rozpoczęte / zrobione / nie tym razem + odhaczenia), własne
wideo do ćwiczeń, ustawienia, RODO. Wszystko end-to-end: serwer widzi szyfrogram.

## Analiza luk i decyzje

| Funkcja (kto ma) | Decyzja | Dlaczego |
|---|---|---|
| Czat 1:1 (oba) | **Robimy: Wiadomości** — szyfrowane E2E jak paczka, tekst + odnośniki, odczytane/nieodczytane, komentarz do konkretnego treningu jednym kliknięciem | Najczęściej używana funkcja prowadzenia. Pliki w czacie — później (patrz niżej) |
| Ogłoszenia / kanał grupy (FF), czat grupowy (TR) | **Robimy: wiadomość do wielu** (zaznaczeni podopieczni albo grupa) | Grupowy pokój ujawniałby uczestników sobie nawzajem i wymaga wspólnego klucza; kopia do każdego zachowuje E2E i anonimowość |
| Formularze, wywiad, raporty tygodniowe (oba) | **Robimy: Formularze** — nowy rodzaj zalecenia `form`: tekst, liczba, skala, wybór, wielokrotny wybór, tak/nie; jednorazowe albo co tydzień / codziennie; wywiad (`intake`) wisi na telefonie, aż odpowiedź pójdzie. Odpowiedzi w Sztabie: historia i wykresy pytań liczbowych | Jedno narzędzie pokrywa wywiad, check-in, skalę bólu w rehabilitacji („program ze skalą bólu” z etapu 2) i własne mierniki (TR: „20+ mierników i własne”) |
| Nawyki i suplementy (FF) | **Robimy: Nawyki** — rodzaj `habits`: lista punktów na dni tygodnia z porą i dawką; telefon odhacza dzień po dniu; Sztab: realizacja 7/30 dni | Mały koszt, codzienny kontakt z planem |
| Jadłospis z wymianą, odhaczanie, światła, lista zakupów (oba) | **Robimy: Jadłospis** — rodzaj `meals`: dni × posiłki (nazwa, przepis z katalogu GYM TRACKERa albo własny opis, kcal i makro), cykl dni; telefon pokazuje dzisiejszy dzień, odhacza posiłki, otwiera przepis; Sztab: realizacja ze światłami | Etap 2 z planu Sztabu. Baza produktów zostaje w GYM TRACKERze — Sztab nie ładuje 50 MB danych jedzenia, więc makro wpisuje prowadzący albo bierze z przepisu |
| Oś czasu, wypuszczanie o dacie, kopiowanie tygodni (TR) | **Robimy: Harmonogram i Programy** — zalecenie z datą „pokaż od” (serwer nie oddaje go telefonowi wcześniej); Program = szablon w bibliotece „dzień N, godzina → element biblioteki”; „Uruchom program” dla podopiecznego albo wielu naraz | Rdzeń automatyzacji TR przy minimalnym koszcie: jedna kolumna i filtr w funkcji odbioru |
| Grupy klientów (TR) | **Robimy: grupy jako prywatne etykiety** w przeglądarce prowadzącego (jak skróty), filtr i wysyłka do grupy | Etykiety bywają opisowe („kolano”) — zostają poza serwerem, jak skróty |
| Raport tygodniowy, aktywność (TR), statystyki (FF) | **Robimy: „Do przejrzenia”** na liście podopiecznych: wiek danych, nowe wiadomości i odpowiedzi, treningi 7 dni wobec planu, realizacja nawyków i jadłospisu, alarmy (brak danych 7 dni, zaległy check-in) | Statystyki biznesowe (LTV, przychód) nie mają sensu bez płatności — poza zakresem |
| Kalendarz, dostępność, rezerwacje, limit miejsc (oba) | **Robimy: Kalendarz wizyt** — terminy prowadzącego (pojedyncze albo co tydzień, limit miejsc, miejsce albo link do rozmowy wideo), podopieczny rezerwuje i odwołuje z telefonu, plik .ics | Sesje na żywo to codzienność trenera i fizjoterapeuty. Godziny wizyt nie są danymi o zdrowiu — leżą jawnie, z RLS |
| Synchronizacja z Google Calendar (FF) | **Nie teraz** | Wymaga klienta OAuth i weryfikacji aplikacji u Google; plik .ics pokrywa potrzebę |
| Zdjęcia sylwetki, porównanie (oba) | **Robimy: Zdjęcia** — osobna zgoda (`photos`), telefon wysyła zaszyfrowane zmniejszone zdjęcia z „Sylwetki”, Sztab porównuje obok siebie | GYM TRACKER już robi zdjęcia; osobna zgoda, bo to najwrażliwsze dane |
| Eksport planu do PDF (FF) | **Robimy: Drukuj / PDF** — widok do druku planu, treningu, jadłospisu, formularza | Przeglądarka robi PDF sama |
| MFA (FF dla administratorów; etap 2 Sztabu) | **Robimy: MFA TOTP w ustawieniach i przy logowaniu** | Supabase ma je włączone, brakowało interfejsu |
| Szablony gotowe (TR ~100) | **Robimy: gotowe formularze, nawyki i jadłospis startowy** obok gotowych planów GYM TRACKERa | Szybki start bez pisania od zera |
| AI do szkiców planów i diet, agent odpowiadający za trenera (FF) | **Nie w tej rundzie** | Etap 3 ma już ustaloną drogę (własny klucz z przeglądarki albo MCP); wybór dostawcy, kosztów i zgody na wysyłkę danych zdrowotnych do modelu należy do autora. Agent udający trenera w rozmowie — odrzucony (podopieczny powinien wiedzieć, z kim pisze) |
| Płatności, karnety, subskrypcje, sklep, kody, faktury, KSeF, umowy (oba) | **Nie** | Wymaga firmy, konta Stripe/Przelewy24, regulaminu sprzedaży i przeglądu prawnego — decyzje autora, nie do sprawdzenia bez prawdziwych pieniędzy |
| Zespół, role, studio, wiele lokalizacji, zadania zespołu (oba) | **Nie teraz** | Przy E2E zespół potrzebuje dzielenia kluczy współpracy między kontami — osobny projekt (etap 3 „widok drużyny”) |
| Publiczna strona trenera, marketing, banery, piksele reklamowe, white label, API, webhooki, magazyn (oba) | **Nie** | Inny produkt; piksele reklamowe kłócą się z zasadą „zero wglądu” |
| Pliki i wideo w czacie, biblioteka mediów (oba) | **Nie teraz** | Szyfrowany magazyn plików (Storage + klucz współpracy) to osobna praca; wideo do ćwiczeń już jest jako odnośniki |
| Powiadomienia push do podopiecznego (oba) | **Nie teraz** | Push GYM TRACKERa idzie przez jego serwer (Worker), Sztab to inny serwer. Telefon pobiera nowości przy otwarciu i co 20 s na otwartej rozmowie |
| SMS, mail do klienta (FF) | **Nie** | Podopieczny nie ma konta ani adresu w Sztabie — z założenia |

## Architektura (rozszerzenie protokołu v1)

Zasada bez zmian: **serwer widzi szyfrogram**. Wszystko nowe idzie kluczem współpracy z AAD
związanym z miejscem.

### Protokół `@gymtracker/link`

- Nowe rodzaje zaleceń: `form`, `habits`, `meals` (+ czyszczenie pole po polu jak dotąd).
  `KINDS_BY_AREA`: trening + `form`, `habits`; żywienie + `meals`, `form`, `habits`;
  rehabilitacja + `form`, `habits`; wgląd + `form`.
- **Telefon nie myli „nieznanego” z „zepsutym”**: rodzaj spoza listy (z jawnej kolumny `kind`)
  zapisuje jako „wymaga nowszej wersji”, a nie „nie da się otworzyć”. Przyszłe rodzaje nie będą już
  straszyć starych telefonów.
- `MessageV1` (AAD `message|<współpraca>|<numer>`): tekst do 4000 znaków, opcjonalne odniesienie do
  treningu (data) albo zalecenia.
- `PhotoV1` (AAD `photo|<współpraca>|<numer>`): dzień, wymiary, JPEG w base64 (≤ 720 px).
- Paczka dostaje część `coaching` (zawsze, niezależnie od zakresu — to odpowiedzi na zalecenia
  samego prowadzącego): odpowiedzi formularzy, odhaczenia nawyków i posiłków dzień po dniu (okno
  `SNAPSHOT_DAYS`). Po odpowiedzi albo odhaczeniu telefon wysyła paczkę od razu (z limitem serwera
  30 s), jak po treningu.
- Nowy zakres zgody `photos`.

Odrzucone: osobna tabela odpowiedzi. Telefon i tak jest źródłem prawdy, a paczka już niesie całą
historię w oknie pół roku; jedna droga zamiast dwóch.

### Baza (migracja `…_funkcje_prowadzenia.sql`)

- `assignments.visible_from` + `client_pull` oddaje tylko widoczne; rodzaje rozszerzone (także
  `library_items` o `form`, `habits`, `meals`, `program`).
- `messages` (autor, szyfrogram ≤ 20 000, `read_at`): prowadzący przez RLS (wstawia tylko jako
  prowadzący, oznacza przeczytane tylko cudze), telefon przez `client_messages`, `client_message`
  (limit 30 na 10 min), `client_read`.
- `photos` (szyfrogram ≤ 600 000, najwyżej 60 na współpracę): `client_photo_ids`, `client_photo_put`,
  `client_photo_delete`; węższy zakres bez `photos` kasuje zdjęcia od razu.
- `slots` i `bookings` (jawne godziny, tytuł, miejsce/link, limit miejsc): prowadzący przez RLS,
  telefon przez `client_slots`, `client_book` (blokada wiersza, limit miejsc, bez podwójnej
  rezerwacji), `client_cancel_booking`.
- `end_connection` kasuje też wiadomości, zdjęcia i przyszłe rezerwacje.
- Każda nowa tabela dostaje **jawne** `grant`y (lekcja z produkcji 25.11: domyślnych w chmurze nie ma).

### Sztab

Nowe zakładki podopiecznego: Wiadomości, Odpowiedzi, Realizacja (nawyki i jadłospis), Zdjęcia.
Nowa strona Kalendarz. Biblioteka: edytory formularza, nawyków, jadłospisu i programu. Wysyłka:
„pokaż od” i wielu odbiorców. Lista podopiecznych: „Do przejrzenia” i grupy.

### GYM TRACKER (telefon)

Strona współpracy: rozmowa, wizyty, zgoda na zdjęcia. Strona zalecenia: wypełnianie formularza,
nawyki dnia, jadłospis dnia. Ekran Dziś: jedna linia, gdy coś czeka (nowa wiadomość, check-in na
dziś). Wszystko w leniwej paczce współpracy, jak dotąd.

## Kolejność prac

1. Rdzeń (prowadzący sam): protokół z testami, migracja z testami na żywej bazie, odbiór i wysyłka
   po stronie telefonu, Sztab w pamięci dla testów, funkcje danych Sztabu, zaczepy w ekranach
   (puste komponenty w osobnych plikach) — żeby agenci nie dotykali tych samych plików.
2. Agenci równolegle (osobne drzewa robocze, rozłączne pliki): Wiadomości; Formularze; Nawyki
   i Jadłospis; Harmonogram, Programy, grupy, „Do przejrzenia”, druk; Kalendarz wizyt; Zdjęcia;
   MFA.
3. Scalenie, pełne testy, przegląd, poprawki, sprawdzenie na lokalnym Supabase z telefonem demo.

## Wdrożenie (dla autora)

Migracja idzie na produkcję dopiero ręcznie (`npx supabase db push --remote`), potem build
i `npx wrangler deploy` Sztabu oraz push GYM TRACKERa. Kolejność ma znaczenie: najpierw baza
(nowe funkcje), potem obie aplikacje.

## Poprawki po przeglądzie (decyzje samodzielne)

- **Lista i karta liczą jednym kodem.** `apps/sztab/src/lib/coached.ts` wybiera obowiązujące zalecenia
  tak jak ekran Dziś telefonu (otwarte, niewycofane, nieodrzucone, już widoczne, po `parseAssignment`,
  numer w środku = numer wiersza) i trzyma je pod numerem wiersza małymi literami. „Do przejrzenia”
  bierze procenty nawyków i jadłospisu z funkcji zakładki „Realizacja”, a stan formularzy z `formState`
  zakładki „Odpowiedzi”. Okno to 7 pełnych dni przed `min(dziś, dzień paczki)` — także dla treningów
  (dni silnika GYM TRACKERa): dni po paczce są nieznane, nie opuszczone.
- **Zaległy formularz** — jedna reguła (`formStatus`): cotygodniowy po swoim dniu bez odpowiedzi
  w tym tygodniu, codzienny bez wczorajszej odpowiedzi. Powód na liście: „zaległy formularz”.
- **Zaplanowane i odrzucone** nie wiszą jako „czeka na odpowiedź” ani puste karty — tylko wzmianka
  („zaplanowany na …”, „odrzucony przez podopiecznego”). Paczka bez części `coaching` (starszy telefon) —
  „brak danych z tej wersji aplikacji” zamiast 0% i czerwonych świateł.
- **Wysyłka do wielu i „Uruchom program”** nie dają się zamknąć w trakcie (Escape, tło, ×), raport
  zostaje, „Ponów nieudane” wysyła tylko to, co nie poszło. Obszar dla podopiecznych z kilkoma pasującymi
  obszarami wybiera się raz dla całej partii (domyślnie pierwszy). Stała data w treści (koniec nawyków,
  start jadłospisu), która minie przed dniem wypuszczenia — ostrzeżenie, bez blokady.
- **„Skomentuj”** niesie trening przez `sessionStorage` karty (czytane raz), nie przez adres — nazwa
  treningu to odszyfrowana treść, a adres trafia do historii i logów serwera.
