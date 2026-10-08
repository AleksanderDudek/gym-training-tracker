-- Subskrypcje przypomnień. Bez kont: kluczem jest adres subskrypcji w usłudze powiadomień.
CREATE TABLE IF NOT EXISTS subs (
  endpoint TEXT PRIMARY KEY,
  p256dh   TEXT NOT NULL,
  auth     TEXT NOT NULL,
  -- Strefa IANA telefonu: przypomnienia wychodzą o godzinie lokalnej użytkownika.
  tz       TEXT NOT NULL,
  -- Lista gotowych przypomnień na najbliższe dni (JSON), przysyłana przy otwarciu aplikacji.
  items    TEXT NOT NULL DEFAULT '[]',
  -- Wysłane: "yyyy-mm-dd|tag" (JSON). Przeżywa ponowne przesłanie listy tego samego dnia.
  sent     TEXT NOT NULL DEFAULT '[]',
  -- Ostatnie przesłanie listy, ms. Po 45 dniach ciszy subskrypcja jest kasowana.
  updated  INTEGER NOT NULL
);

-- Wiadomości od użytkowników: uwaga albo zgłoszenie błędu z formularza w aplikacji.
-- Adresu IP nie ma — tylko jego skrót (SHA-256 z solą), do limitu wiadomości na godzinę.
CREATE TABLE IF NOT EXISTS feedback (
  id         TEXT PRIMARY KEY,
  created    INTEGER NOT NULL,
  email      TEXT,
  text       TEXT NOT NULL,
  -- Ekran, z którego przyszła wiadomość.
  view       TEXT NOT NULL,
  -- Ślad wizyty i dane techniczne (JSON): ekrany, stuknięcia, czas, przeglądarka.
  context    TEXT NOT NULL,
  -- Zrzut ekranu jako data: URL (JPEG, zwykle 50–200 kB).
  screenshot TEXT,
  ip_hash    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_ip ON feedback (ip_hash, created);

-- Skrzynki zegarka Garmin: najnowsza zaszyfrowana paczka z zegarka. Klucza serwer nie ma —
-- zna go tylko zegarek i przeglądarka, więc kroki, tętno i sen są dla niego nieczytelne.
CREATE TABLE IF NOT EXISTS garmin (
  -- 32 znaki hex wyprowadzone z klucza.
  box     TEXT PRIMARY KEY,
  -- Koperta w base64: wersja, IV, AES-256-CBC, HMAC-SHA256.
  blob    TEXT NOT NULL,
  -- Ostatni zapis, ms. Po 7 dniach ciszy skrzynka znika.
  updated INTEGER NOT NULL,
  -- Założenie, ms, i skrót adresu IP — do limitu nowych skrzynek na godzinę.
  created INTEGER NOT NULL,
  ip_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS garmin_ip ON garmin (ip_hash, created);
CREATE INDEX IF NOT EXISTS garmin_updated ON garmin (updated);
