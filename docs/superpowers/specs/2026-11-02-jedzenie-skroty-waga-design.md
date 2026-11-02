# Jedzenie: skróty na górze dziennika i waga z dwoma miejscami po przecinku

Data: 2026-11-02. Decyzje podjęte samodzielnie na prośbę właściciela („masz wolną rękę, pick recommended”).

## Problem

1. Pięć wejść do podstron diety (Plan posiłków, Moje plany, Postęp, Profil diety, Badania) stało na
   samym dole dziennika — pod „Co teraz?” i krokami. Na telefonie 390 px dziennik z danymi ma ok.
   3950 px, więc kafelki leżały cztery–pięć ekranów niżej niż góra strony. Właściciel sam nie
   znalazł Badań („gdzie jest ten panel do wyników badań?”).
2. Waga ciała zapisywała się z dokładnością 0,1 kg i pokazywała z jedną cyfrą („85 kg”,
   „82,4 kg”). Właściciel chce dwóch miejsc po przecinku.

## Decyzje

| # | Decyzja | Dlaczego |
| --- | --- | --- |
| 1 | Skróty idą na górę dziennika, **między sekcjami (Dziennik/Przepisy/…) a przełącznikiem dnia**, jako jeden rząd pięciu kafelków (ikona nad podpisem). | Nawigacja przy nawigacji: sekcja → podstrony diety → dzień, a data otwiera treść dnia (kafelki pod datą odcinałyby ją od wagi i bilansu). Pięć kolumn mieści się bez przewijania od 320 px (ok. 53 px na kafelek), cały rząd ma ok. 64 px, więc liczby dnia spadają tylko o jeden wiersz. Rząd przewijany w bok chowałby Badania poza ekranem — dokładnie problem, który naprawiamy. |
| 2 | Na dole dziennika kafelków już nie ma (przeniesione, nie powielone). | Dwa zestawy tych samych pięciu linków na jednym ekranie to szum. Odnośnik „Postęp” przy wadze też znika (decyzja 10). |
| 3 | Podpisy krótkie (poniżej 360 px pismo 10,5 px zamiast 11,5, bo „posiłków” łamało się w pół słowa): „Plan posiłków”, „Moje plany”, „Postęp”, „Profil diety”, „Badania”. Pełna nazwa Badań („Badania — dieta pod wyniki”) zostaje w nagłówku podstrony. | W kolumnie ok. 53 px mieszczą się dwa krótkie wiersze 12 px; długi podpis łamałby się na cztery. |
| 4 | Skróty widać na każdym dniu (także przeszłym i przyszłym); Plan posiłków dalej dostaje oglądany dzień (`?dzien=`). | Tak jak dotąd na dole. |
| 5 | Ekran pierwszych kroków (bez profilu diety) dostaje odnośnik do Badań. | Panel badań działa bez profilu, a bez profilu kafelków nie było wcale. |
| 6 | **Każda liczba wagi ciała ma dokładnie dwa miejsca po przecinku**: ważenie (treningi, dziennik, ekran kroków, telefon, wykresy), średnia z 7 dni, trend, waga docelowa, waga na starcie, ile zostało, zmiana od startu, zmiana średniej tydzień do tygodnia na karcie ważenia, najniższa bezpieczna waga docelowa. „85,00 kg”, „82,45 kg”. | Jedna reguła zamiast wyjątków: wszędzie, gdzie mowa o wadze ciała, ten sam zapis. Stała liczba cyfr nie skacze przy przewijaniu historii (82,4 → 82,45 → 82). |
| 7 | **Bez zmian**: tempo (kg na tydzień — to prędkość, nie waga, już do 0,05; także kolumna „Waga” w tabeli „Tydzień po tygodniu”, która jest zmianą na tydzień), ciężary w treningu (kettlebell 16 kg, 1RM, tonaż), podziałka osi wykresu (pełne kilogramy). | To nie waga ciała. |
| 8 | Zapis wagi z dokładnością 0,01 kg (`setBodyWeight`, waga z telefonu `phone.ts`); średnie i różnice też do 0,01. Stare zapisy (0,1) czytają się bez migracji. | Dwie cyfry na ekranie przy zapisie co 0,1 byłyby zawsze „,x0” — kłamstwo o dokładności w drugą stronę. Wagi z Health Connect / Apple Zdrowie i wagi łazienkowe z krokiem 0,05 kg mają drugą cyfrę naprawdę. |
| 9 | Jeden pomocnik `formatWeight(kg)` w `engine/body.ts` (liczba bez jednostki, `num(kg, 2)`), używany i w treningach, i w jedzeniu. | Jedno miejsce reguły; test pilnuje formatu. |
| 10 | Karta wagi w dzienniku traci własny odnośnik „Postęp”. | Kafelek „Postęp” stoi teraz wiersz wyżej; dwa identyczne odnośniki o 100 px od siebie to szum. |

Próg „cel osiągnięty” w Postępie (0,05 kg) zostaje: to reguła liczenia (`reachRange`), nie zapis.

## Poza zakresem / na później

- Znacznik stanu na kafelku Badań (np. „kontrola za 3 tyg.”) — ma sens, ale wymaga czytania bazy badań
  przy każdym renderze dziennika.
- Wejścia do podstron diety na ekranie Dziś (zakładka treningowa).
