# Connect IQ Store listing — GYM TRACKER

Text for every field of the store form at https://apps-developer.garmin.com, after the package
(`bin/gymtracker.iq`) is validated. English is the main listing; a Polish description for the
Polish store locale is at the end.

| Field | Value |
| --- | --- |
| App type | Device App (watch app) |
| App title | `GYM TRACKER` — if the store reports the name as taken: `GYM TRACKER Sync` |
| Category | Health & Fitness (or the closest one the form offers, e.g. Fitness) |
| Price | Free, no in-app purchases |
| Trader status (EU DSA) | Not a trader: free, non-commercial app with no payments or donations |
| Website | https://aleksanderdudek.github.io/gym-training-tracker/ |
| Privacy policy | https://aleksanderdudek.github.io/gym-training-tracker/privacy.html |
| Support | https://github.com/AleksanderDudek/gym-training-tracker/issues |
| Languages | English, Polish |
| Screenshots | `screenshots/` (see `screenshots/README.md`) |
| Hero image | `hero/hero-en.png` (Polish locale: `hero/hero-pl.png`) |

## Short description

Your watch’s steps, rides, heart rate, stress and Body Battery — sent to the GYM TRACKER training app, end-to-end encrypted.

## Description

Store limit: 3700 characters. **For the store field use `description-en.txt`** (about 3600 characters, plain text ready to paste). The shorter text below (about 2000) is a summary; the Polish one at the end has about 1800.

GYM TRACKER brings the numbers from your Garmin watch into GYM TRACKER, a free training app that runs in your browser (https://aleksanderdudek.github.io/gym-training-tracker/ — in Polish or English). No retyping, no account.

WHAT IT SENDS
About every 30 minutes, while your phone is nearby, the watch sends the last 7 days of:
• steps, distance, floors climbed and intensity minutes
• bike rides (start, duration, distance)
• heart rate (min, average, max), average resting heart rate and, on most models, stress and Body Battery

In GYM TRACKER, steps and rides count straight away towards calories, activity minutes, XP and badges. Heart rate, stress and Body Battery are shown as they are, without medical interpretation.

HOW TO CONNECT
1. Open GYM TRACKER in your browser: Settings → Garmin watch. Check your model, then tap Connect watch and Copy key.
2. Paste the key into this app’s settings: Garmin Connect → your watch → Activities & Apps → GYM TRACKER → Settings.
3. Open GYM TRACKER on the watch once. The first data arrives within minutes. Press START (or tap the screen) to send right away.

PRIVACY
The watch encrypts the data (AES-256 and HMAC-SHA256) with your key before it leaves the watch. The key is created in your browser and the server never sees it: it keeps only the latest encrypted package, for at most 7 days, and cannot read it. No accounts, no ads, no analytics. Without a key the app sends nothing.
Privacy policy: https://aleksanderdudek.github.io/gym-training-tracker/privacy.html

PERMISSIONS
• Background — sends about every 30 minutes without opening the app.
• Communications — sends the encrypted package through Garmin Connect on your phone to the GYM TRACKER server.
• Sensor history — heart rate, stress and Body Battery.
• User profile — activity history (bike rides) and average resting heart rate.

GYM TRACKER helps you plan and log training. It is not a medical device and does not replace a doctor, physiotherapist or dietitian.

## What’s new (1.0)

First release: steps, distance, floors, intensity minutes, bike rides, heart rate, stress, Body Battery and resting heart rate, end-to-end encrypted, every 30 minutes. English and Polish.

## Polish description (Polish store locale)

**Krótki opis:** Kroki, przejazdy rowerem, tętno, stres i Body Battery z zegarka — prosto do aplikacji GYM TRACKER, zaszyfrowane.

**Opis:**

GYM TRACKER przenosi liczby z zegarka Garmin do GYM TRACKER — bezpłatnej aplikacji treningowej w przeglądarce (https://aleksanderdudek.github.io/gym-training-tracker/). Bez przepisywania i bez zakładania konta.

CO WYSYŁA
Mniej więcej co 30 minut, gdy telefon jest w pobliżu, zegarek wysyła ostatnie 7 dni:
• kroki, drogę, piętra i minuty intensywności
• przejazdy rowerem (start, czas, droga)
• tętno (najniższe, średnie, najwyższe), średnie tętno spoczynkowe, a na większości modeli także stres i Body Battery

W GYM TRACKER kroki i przejazdy od razu liczą się do kalorii, minut ruchu, doświadczenia i odznak. Tętno, stres i Body Battery są pokazywane bez oceny medycznej.

JAK POŁĄCZYĆ
1. W GYM TRACKER: Ustawienia → Zegarek Garmin. Sprawdź swój model, potem Połącz zegarek i Kopiuj klucz.
2. Wklej klucz w ustawieniach tej aplikacji: Garmin Connect → zegarek → Aktywności i aplikacje → GYM TRACKER → Ustawienia.
3. Otwórz raz GYM TRACKER na zegarku. Pierwsze dane przyjdą po chwili; START (albo stuknięcie) wysyła od razu.

Działa ze 118 modelami zegarków Garmin (Connect IQ 3.2 lub nowszy) i z telefonem z iOS albo Androidem. Sprawdź swój i to, co wyśle: https://aleksanderdudek.github.io/gym-training-tracker/#/zegarek

PRYWATNOŚĆ
Zegarek szyfruje dane (AES-256 i HMAC-SHA256) twoim kluczem, zanim opuszczą zegarek. Klucz powstaje w przeglądarce i serwer go nie zna: przechowuje tylko ostatnią zaszyfrowaną paczkę, najwyżej 7 dni, i nie umie jej odczytać. Bez kont, reklam i analityki. Bez klucza aplikacja niczego nie wysyła.
Polityka prywatności: https://aleksanderdudek.github.io/gym-training-tracker/privacy.html#pl

UPRAWNIENIA
• Praca w tle — wysyłka co ok. 30 minut bez otwierania aplikacji.
• Komunikacja — wysyłka zaszyfrowanej paczki przez Garmin Connect do serwera GYM TRACKER.
• Historia czujników — tętno, stres i Body Battery.
• Profil użytkownika — historia aktywności (przejazdy) i średnie tętno spoczynkowe.

GYM TRACKER pomaga planować i zapisywać trening. Nie jest wyrobem medycznym i nie zastępuje lekarza, fizjoterapeuty ani dietetyka.
