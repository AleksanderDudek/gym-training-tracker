# Sztab: dane do obejrzenia, prowadzący na pierwszym planie, powiadomienia push

25 listopada 2026, po wdrożeniu funkcji z `2026-11-25-sztab-funkcje-konkurencji-design.md`. Zlecenie autora
(z wolną ręką, „pick recommended”, autor poza komputerem):

1. Wygenerować dane dla nowych rodzajów w Sztabie, żeby zobaczyć, jak to działa.
2. Po przyjęciu zaproszenia plany i wytyczne prowadzącego mają być w GYM TRACKERze pierwsze i widoczne.
3. Powiadomienia push na telefon o komunikacji, zaleceniach, zmianach.

**Decyzje podjęte samodzielnie na prośbę autora.**

## Decyzje

| Temat | Decyzja | Dlaczego |
|---|---|---|
| Dane do obejrzenia | **W samym Sztabie**: „Dodaj przykłady” (przykładowa biblioteka: treningi, plan, cele, badania, zalecenia, 5 formularzy, nawyki, 2 jadłospisy, program 4-tygodniowy) i „Podopieczny demonstracyjny” (telefon symulowany w przeglądarce prowadzącego: prawdziwa współpraca przez te same funkcje co telefon, siedem tygodni danych, wiadomości, zdjęcia; „Symuluj telefon” odpowiada na to, co prowadzący wysłał) | Działa u każdego prowadzącego, nie tylko na koncie autora; nie wymaga wpisywania czegokolwiek do produkcji kluczem administratora; pokazuje szyfrowanie end-to-end w działaniu. Odrzucone: skrypt wpisujący dane na konto autora w produkcji (dostęp administratora bez autora przy komputerze) |
| Demo widać jako demo | Etykieta „DEMO” na liście i na karcie, „Usuń demo” kończy współpracę i czyści telefon symulowany | Nie myli się z prawdziwym podopiecznym, nie zostaje na zawsze |
| Prowadzący na pierwszym planie | **Karta „Od prowadzącego” na górze ekranu Dziś** (dzisiejszy trening z planu prowadzącego, formularz do wypełnienia, nawyki z odhaczaniem na miejscu, jadłospis dnia, wizyta, wiadomości, nowe zalecenia z „Uruchom”), **plany prowadzącego przypięte na górze listy planów**, **cele prowadzącego do przyjęcia jednym przyciskiem**, **jadłospis prowadzącego na górze dziennika jedzenia** | „Pierwsze i widoczne” tam, gdzie człowiek i tak patrzy codziennie; bez szóstej zakładki (decyzja z 3.11: współpraca należy do Profilu) |
| Kanał push | **Serwer aplikacji GYM TRACKERa (Worker)**, ten sam klucz VAPID co przypomnienia | Przeglądarka ma jedną subskrypcję push na klucz; drugi serwer z innym kluczem zabrałby przypomnienia |
| Kto wyzwala | **Przeglądarka prowadzącego** po swojej akcji woła Workera tokenem powiadomień; zaplanowane (zalecenie „pokaż od”, przypomnienie o wizycie) trzyma kolejka Workera i wysyła cron | Bez sekretów w bazie i bez funkcji brzegowych Supabase do wdrażania; cron Workera już chodzi co 5 minut |
| Co wie serwer push | **Tylko token i rodzaj zdarzenia.** Treść powiadomienia ogólna („Nowa wiadomość od prowadzącego”), bez treści, bez nazwiska, bez numeru współpracy | Zasada „serwer widzi szyfrogram”; podgląd na zablokowanym ekranie nie zdradza niczego |
| Token | Losowy, 32 bajty, osobny dla każdej współpracy; Worker trzyma jego SHA-256; w Sztabie leży **zapieczętowany kluczem współpracy** (AAD `notify|<współpraca>`) i otwiera go tylko przeglądarka prowadzącego w chwili wysyłki; koniec współpracy go kasuje, a doręczone `ended` kasuje go też na serwerze aplikacji | Wyciek jednej z baz nie pozwala wysyłać ani połączyć urządzenia z prowadzącym (po przeglądzie bezpieczeństwa — pierwsza wersja trzymała token jawnie) |
| Numery zaplanowanych | `ref` = HMAC-SHA256(token, numer zalecenia albo rezerwacji), 32 hex — liczą go telefon i Sztab | Serwer aplikacji nie dostaje numerów z bazy Sztabu; obie strony odwołują to samo |
| Limity | 20 powiadomień na godzinę na token (także zaplanowane), jedno tego samego rodzaju na minutę, 200 w kolejce; 30 rejestracji na godzinę z jednego adresu; sprawdzane atomowo w D1 | Prowadzący nie zaleje telefonu; równoległe zapytania nie przejdą limitu |
| Kolejka | Sprawiedliwa (najwyżej 3 na token i 5 na subskrypcję w przebiegu, na zmianę), ponowienia po 5 i 20 min, po trzecim błędzie odpada; dzierżawa przed wysyłką; przeterminowanie (`visit-soon` godzinę po czasie, reszta po dobie) | Jedna zepsuta albo złośliwa subskrypcja nie wstrzyma cudzych powiadomień (przegląd: dało się zablokować całą kolejkę) |
| Co widzi usługa push | Stały `Topic: coach`, treść dopełniona do 160 bajtów, TTL zależny od drogi (natychmiast / z kolejki), nie od rodzaju | Rodzaj zdarzenia nie wychodzi z nagłówków ani z długości szyfrogramu |
| Cele od prowadzącego | Przyjmowane tylko po potwierdzeniu, przez te same reguły co cel wpisany ręcznie (podstawowa przemiana materii, minimum, niepełnoletni); w ciąży, karmieniu i przy BMI < 18,5 kalorii poniżej zapotrzebowania **nie** przyjmujemy (informacja z powodem) | Prowadzący proponuje, aplikacja pilnuje bezpieczeństwa |
| Domyślnie | Przy przyjęciu zaproszenia pole „Powiadamiaj mnie” zaznaczone, gdy telefon obsługuje push; na iPhonie wskazówka „dodaj do ekranu początkowego” | Autor chce powiadomień; zgoda przeglądarki i tak pyta osobno |
| Powiadomienia dla prowadzącego (nowa wiadomość od podopiecznego) | **Nie w tej rundzie** | Sztab nie jest aplikacją instalowaną (PWA) i nie ma service workera; osobna praca |

## Zdarzenia

`message` (nowa wiadomość), `assignment` (nowe zalecenie; zaplanowane — o czasie „pokaż od”), `withdrawn`
(wycofane), `visit` (prowadzący zapisał na wizytę), `visit-cancel` (odwołał), `visit-soon` (2 h przed
wizytą — planuje prowadzący przy zapisie albo telefon przy rezerwacji), `ended` (koniec współpracy).

## Kontrakt Workera

- `POST /link/register {token, subscription, tz, lang}` — z aplikacji: zakłada albo odświeża subskrypcję
  (bez ruszania listy przypomnień) i wiąże z nią token. Odświeżane przy synchronizacji co kilka dni.
- `POST /link/unregister {token}` — z aplikacji.
- `POST /link/notify {token, kind, at?, ref?}` — ze Sztabu (i z aplikacji dla przypomnienia o wizycie):
  teraz albo do kolejki na `at`. Zawsze 204 (bez wyroczni, który token istnieje).
- `POST /link/cancel {token, ref}` — odwołuje zaplanowane.

Treść: `{title, body, url: '#/wspolpraca', tag: 'coach-<rodzaj>'}` w języku zapisanym przy rejestracji
(szyfrowana kluczem urządzenia, dopełniona do stałej długości).

## Po przeglądzie (25.11.2026)

Dwa niezależne przeglądy (bezpieczeństwo, poprawność) znalazły m.in.: blokadę kolejki jedną zepsutą
subskrypcją, nieatomowe limity, token żywy po „Usuń wszystkie dane”, token jawnie w bazie Sztabu, deficyt
kalorii od prowadzącego w ciąży, rozjazd formatu `at` między telefonem a serwerem, przypomnienie o wizycie
odwołanej przez prowadzącego. Wszystko poprawione; umowę trzech stron pilnuje test
`src/link/notify.contract.test.ts` (telefon + prawdziwy `handle` serwera + `notify.ts` Sztabu + cron).

## Wdrożenie (dla autora)

Kolejność: migracja `…_powiadomienia` w Supabase → `schema.sql` w D1 i `wrangler deploy` Workera (nowe
trasy, adres Sztabu w `ALLOWED_ORIGINS`) → build i deploy Sztabu (`VITE_TRACKER_API_URL`) → push GYM TRACKERa.
