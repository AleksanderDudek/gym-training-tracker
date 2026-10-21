# Store screenshots

| File | What it shows | Made by |
| --- | --- | --- |
| `web-1-en.png`, `web-1-pl.png` | The GYM TRACKER web app with watch data: today’s steps “z zegarka” (from the watch), the week, and the “Z zegarka” section with heart rate, stress and Body Battery | Real screenshot of the app (`raw/web-today.png`) in `frame.html` |
| `web-2-en.png`, `web-2-pl.png` | Settings → Garmin watch, connected | Real screenshot (`raw/web-garmin.png`) in `frame.html` |
| `watch-1.png`, `watch-2.png` | The watch app itself — **to take in the simulator, see below** | You |

The web screenshots were taken with a demo person (seeded watch data, no real person’s data), the support strip hidden and the server blocked.

## Watch screenshots (about 2 minutes)

The terminal has no permission to capture the screen, so these two are taken by hand:

1. From the repository: `cd garmin && ./build.sh shots fr265`.
   The simulator opens with the app and a throwaway key (not yours).
2. **watch-1** — the start screen shows “Waiting for the first send”. Press **Enter** (START) — it
   changes to “Sending...” and then “Sent HH:MM”.
3. Take each screenshot of the simulator window: **Cmd+Shift+4**, then **Space**, then click the
   simulator window. The file lands on the Desktop.
4. Save them as `garmin/store/screenshots/watch-1.png` (“Sent HH:MM”) and, optionally,
   `watch-2.png` (any other state). The store shows square images best — say if you want them
   cropped and framed like the web ones.

The simulator shows English text when its language is English (Settings → Language in the
simulator menu); with Polish it shows the Polish text.

## Re-rendering

From the repository root:

```bash
for s in web-1 web-2; do for l in en pl; do
  npx playwright screenshot --viewport-size=1000,1000 "file://$PWD/garmin/store/screenshots/frame.html?shot=$s&lang=$l" garmin/store/screenshots/$s-$l.png
done; done
```
