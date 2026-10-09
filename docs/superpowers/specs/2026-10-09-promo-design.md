# Hasło na certyfikatach i plakat „Poleć znajomym” — projekt

Data: 2026-10-09 · Decyzje podjęte samodzielnie na prośbę („wybierz rekomendowane”).

## Prośba

1. Hasło reklamowe w rodzaju „twój trening robi się sam”, które mówi obcym ludziom, co robi aplikacja.
2. To hasło na udostępnianych certyfikatach.
3. Osobny przycisk promocyjny z zabawną grafiką w charakterze aplikacji, zachęcającą do wejścia,
   z informacją, że na razie jest za darmo.

## Stan obecny

- Certyfikaty: karta 1080×1080 na canvasie (`engine/share.ts` → `shareCard`) — świadectwo za
  odznakę, legitymacja za dorobek. Nagłówek z medalionami goryli, treść, podpis, wstęga z adresem,
  numer wydania. Wpis: szablon + zdanie zaproszenia (`CTA`) + adres.
- Nic nie mówi, czym jest aplikacja — kto widzi kartę w cudzym kanale, widzi żart i adres.
- Nie ma materiału do polecenia aplikacji bez wyniku do pochwalenia się.

## Decyzje

| Temat | Decyzja | Dlaczego |
| --- | --- | --- |
| Hasło | **„Twój trening sam wie, kiedy dołożyć.”** + **„Na razie za darmo.”** | Najbliżej propozycji („twój trening… sam”), a prawdziwe: aplikacja sama decyduje o powtórzeniach i ciężarze. Krótkie (6 słów), korzyść, nie funkcja |
| Wyjaśnienie | „Wpisujesz serie, a aplikacja sama decyduje, kiedy dołożyć powtórzenie albo ciężar.” | Jedno zdanie dla tych, którym hasło nie wystarczy — na plakacie i w wpisie |
| Certyfikat | Wiersz hasła tuż nad wstęgą z adresem: hasło ciemne, „Na razie za darmo.” w kolorze pieczęci | Kolejność z reklamy: korzyść → adres. Pole treści o jeden wiersz niższe; podpis znika wcześniej, gdy brak miejsca |
| Wpis | Zdania zaproszenia mówią, co robi aplikacja i że jest za darmo | Wpis bez obrazka też ma tłumaczyć, czym to jest |
| Plakat | „Ogłoszenie · nabór otwarty — Trener Siwy szuka podopiecznych”: Siwy wskazuje palcem, Gustaw z telefonem, Gosia z bicepsem; hasło, dwa zdania korzyści, pieczęć „ZA DARMO · na razie”, wstęga z adresem, drobny druk „Opłata wpisowa: 0 zł. Zakwasy wliczone.” | Ten sam urząd, który wydaje certyfikaty — spójna marka i ten sam żart (powaga formy, błahość treści) |
| Przycisk | Strona `#/polec` „Poleć znajomym”: podgląd plakatu, „Udostępnij plakat”, „Pobierz”, „Kopiuj link”, podgląd wpisu. Wejście z Ustawień (pierwsza karta) i z Profilu | Osobny przycisk z widocznym efektem: nic nie wychodzi w świat bez pokazania, co wychodzi |

## Silnik

- `engine/share.ts`: `TAGLINE`, `FREE_NOTE`, `PITCH`, `PROMO_TEXTS`, `promoText(seed)`,
  `promoCard(cast)` (płótno 1080×1080, wspólne pomocnicze: ramka, pieczęć, wstęga);
  `shareCard` rysuje wiersz hasła; `shareRaw({ title, text, file })` — wysyłka bez `ShareSubject`.
- `quips.ts`: `CTA` z wyjaśnieniem i bezpłatnością.

## UI

- `components/Promo.tsx`: `PromoPage` (plakat renderowany po wejściu, obraz jako podgląd),
  `PromoCard` (wejście w Ustawieniach i Profilu).
- `routing.ts`: trasa `promo` (`#/polec`), rodzic Ustawienia.

## Testy

- Ton: hasło, wyjaśnienie, teksty plakatu i wpisów — bez słów zawstydzających, bez rodzaju
  gramatycznego, „za darmo” obecne, adres na końcu wpisu.
- Trasa `#/polec` w obie strony.
- Podgląd: certyfikaty z hasłem (odznaka, legitymacja, długie tytuły) i plakat w przeglądarce.
