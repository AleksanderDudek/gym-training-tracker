# Opis w Connect IQ Store

Teksty do wklejenia w Developer Dashboard po wgraniu `bin/gymtracker.iq`. Aplikacja jest
bezpłatna i nic nie sprzedaje, więc weryfikacja „tradera” (DSA) jej nie dotyczy. Dlatego
w opisie nie ma linku do wsparcia ani do espresso — prośba o wpłatę zrobiłaby z aplikacji
płatną w rozumieniu sklepu.

- **Typ:** Device App · **Kategoria:** Health & Fitness
- **Cena:** bezpłatna, bez zakupów w aplikacji
- **Strona aplikacji (website):** https://aleksanderdudek.github.io/gym-training-tracker/
- **Zrzuty ekranu:** z symulatora (`./build.sh run fr265`, potem File → Save Screenshot) —
  ekran aplikacji ze stanem „Wysłane 14:32” i podgląd (glance).

## Polski

**Nazwa:** GYM TRACKER

**Krótki opis:**
Kroki, rowery, tętno, stres i Body Battery z zegarka — prosto do aplikacji GYM TRACKER, zaszyfrowane.

**Opis:**
GYM TRACKER na zegarku wysyła co pół godziny ostatni tydzień danych do aplikacji treningowej
GYM TRACKER (https://aleksanderdudek.github.io/gym-training-tracker/): kroki, drogę, piętra,
minuty intensywności, przejazdy rowerem, tętno, stres, Body Battery i średnie tętno spoczynkowe.
Kroki i przejazdy liczą się tam od razu do kalorii, minut ruchu, doświadczenia i odznak —
bez przepisywania z zegarka.

Jak połączyć:
1. W aplikacji GYM TRACKER otwórz Ustawienia → Zegarek Garmin → Połącz zegarek i skopiuj klucz.
2. Wklej klucz w ustawieniach tej aplikacji w Garmin Connect (zegarek → Aktywności i aplikacje →
   GYM TRACKER → Ustawienia).
3. Otwórz raz GYM TRACKER na zegarku. Pierwsze dane przyjdą po chwili, potem co pół godziny,
   gdy telefon jest w pobliżu. Przycisk START (albo stuknięcie) wysyła od razu.

Prywatność: zegarek szyfruje dane (AES-256, HMAC-SHA256) kluczem, który znają tylko zegarek
i twoja przeglądarka. Serwer przechowuje wyłącznie ostatnią zaszyfrowaną paczkę, najwyżej
przez tydzień, i nie może jej odczytać. Brak kont, brak reklam, brak analityki.

Liczby z czujników zegarka pokazywane są bez oceny medycznej. Aplikacja nie zastępuje lekarza.

**Uprawnienia (wyjaśnienie dla recenzenta i użytkownika):**
- Background — wysyłka co 30 minut bez otwierania aplikacji.
- Communications — wysyłka zaszyfrowanej paczki przez telefon do serwera GYM TRACKER.
- SensorHistory — tętno, stres i Body Battery z historii czujników.
- UserProfile — historia aktywności (przejazdy) i średnie tętno spoczynkowe.

## English

**Name:** GYM TRACKER

**Short description:**
Steps, rides, heart rate, stress and Body Battery from your watch — sent to the GYM TRACKER app, encrypted.

**Description:**
Every 30 minutes, GYM TRACKER sends the last week of watch data to the GYM TRACKER training app
(https://aleksanderdudek.github.io/gym-training-tracker/, Polish interface): steps, distance,
floors, intensity minutes, bike rides, heart rate, stress, Body Battery and average resting heart
rate. Steps and rides count straight away towards calories, activity minutes, XP and badges — no
more copying numbers from the watch.

How to connect:
1. In GYM TRACKER open Ustawienia → Zegarek Garmin → Połącz zegarek and copy the key.
2. Paste the key into this app's settings in Garmin Connect (watch → Activities & Apps →
   GYM TRACKER → Settings).
3. Open GYM TRACKER on the watch once. The first data arrives within minutes, then every
   30 minutes while your phone is nearby. START (or a tap) sends immediately.

Privacy: the watch encrypts the data (AES-256, HMAC-SHA256) with a key known only to the watch and
your browser. The server keeps only the latest encrypted package, for at most a week, and cannot
read it. No accounts, no ads, no analytics.

Sensor numbers are shown without medical interpretation. This app is not a substitute for a doctor.

**Permissions:**
- Background — sends every 30 minutes without opening the app.
- Communications — sends the encrypted package through your phone to the GYM TRACKER server.
- SensorHistory — heart rate, stress and Body Battery from sensor history.
- UserProfile — activity history (rides) and average resting heart rate.
