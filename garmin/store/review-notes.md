# Notes for the Connect IQ review team

Paste into the “notes for reviewer” field if the form has one; otherwise keep it for replies.

---

GYM TRACKER is a companion for GYM TRACKER, a free training web app (https://aleksanderdudek.github.io/gym-training-tracker/, Polish interface, no account). The watch app sends the user’s recent activity and health numbers, end-to-end encrypted, so they appear in the web app.

How to test (about 3 minutes, no account needed):
1. Open https://aleksanderdudek.github.io/gym-training-tracker/ in a browser. Skip the intro (“Pomiń”).
2. Open Ustawienia (Settings, gear icon) → section “Zegarek Garmin” (Garmin watch) → “Połącz zegarek” (Connect watch) → “Kopiuj klucz” (Copy key). The key is 64 hex characters.
3. Paste the key into the app settings (“Key from the GYM TRACKER app”) in Garmin Connect or the Connect IQ Store app.
4. Open GYM TRACKER on the watch and press START. The screen shows “Sent HH:MM”.
5. In the web app press “Sprawdź teraz” (Check now) in the same section. Steps appear under Dziś → Kroki i cardio (marked “z zegarka”, from the watch); heart rate, stress and Body Battery appear in the “Z zegarka” section on that screen.

Without a key the app sends nothing and shows “Paste the key in Garmin Connect”.

Network: HTTPS POST to https://gym-tracker-api.instrukcje-app.workers.dev/garmin/push with {box, blob}, at most every 30 minutes in the background, or on START. The blob is AES-256-CBC + HMAC-SHA256 under keys derived from the user’s key; the server cannot decrypt it and keeps only the latest blob, for at most 7 days.

Permissions: Background (30-minute temporal event), Communications (the POST above), SensorHistory (heart rate, stress, Body Battery), UserProfile (activity history for bike rides, average resting heart rate).

Privacy policy: https://aleksanderdudek.github.io/gym-training-tracker/privacy.html
Source code: https://github.com/AleksanderDudek/gym-training-tracker (folder garmin/)
