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
