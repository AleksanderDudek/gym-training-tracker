import Toybox.ActivityMonitor;
import Toybox.Application;
import Toybox.Lang;
import Toybox.SensorHistory;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.UserProfile;

// Co zegarek wie o ostatnim tygodniu — w kształcie paczki v1, którą czyta `parsePayload`
// w aplikacji (src/engine/watch.ts). JSON składany ręcznie, bo Monkey C nie ma serializatora.
// Wszystkie liczby całkowite; brak pomiaru to null — aplikacja pokaże wtedy „—”.
(:background)
module Collect {
    // Kubełki zdrowia: dzień → [tętno min, max, suma, liczba, stres suma, liczba, BB min, max,
    // tętno spoczynkowe, wynik snu]. Zegarek pamięta próbki czujników krótko, więc kubełek
    // dnia rośnie z każdym przebiegiem, a nie liczy się od nowa z całej doby.
    const HEALTH = "health";
    // Do której chwili (s) próbki są już w kubełkach.
    const SEEN = "seen";
    // Pierwszy przebieg: tyle wstecz, ile zegarek zwykle pamięta.
    const FIRST = 7200;
    // Próbek na przebieg — tło ma limit czasu, a 30 minut to kilkadziesiąt próbek.
    const MAX_SAMPLES = 600;
    // Dziś i siedem poprzednich dni.
    const DAYS = 8;

    function dayOf(moment) {
        var g = Gregorian.info(moment, Time.FORMAT_SHORT);
        return Lang.format("$1$-$2$-$3$", [g.year, (g.month as Number).format("%02d"), (g.day as Number).format("%02d")]);
    }

    function num(v) {
        return v == null ? "null" : v.toNumber().toString();
    }

    function row(items) {
        var s = "[";
        for (var i = 0; i < items.size(); i++) {
            if (i > 0) {
                s += ",";
            }
            s += items[i];
        }
        return s + "]";
    }

    // Kroki, droga (m), piętra i minuty intensywności: poprzednie dni z historii i dziś.
    function days() {
        var rows = [];
        var hist = ActivityMonitor.getHistory();
        if (hist != null) {
            for (var i = 0; i < hist.size(); i++) {
                var h = hist[i];
                if (h != null && h.startOfDay != null) {
                    // Południe zamiast początku dnia: dzień wychodzi ten sam, czy zegarek podaje
                    // północ lokalną, czy UTC.
                    rows.add(day(dayOf(h.startOfDay.add(new Time.Duration(43200))), h.steps, h.distance,
                        (h has :floorsClimbed) ? h.floorsClimbed : null,
                        (h has :activeMinutes) ? h.activeMinutes : null));
                }
            }
        }
        // Dziś na końcu: gdyby historia też go miała, wygrywa liczba sprzed chwili.
        var info = ActivityMonitor.getInfo();
        rows.add(day(dayOf(Time.now()), info.steps, info.distance,
            (info has :floorsClimbed) ? info.floorsClimbed : null,
            (info has :activeMinutesDay) ? info.activeMinutesDay : null));
        return row(rows);
    }

    // Droga przychodzi w centymetrach, minuty intensywności jako obiekt z sumą.
    function day(key, steps, cm, floors, active) {
        return row([
            "\"" + key + "\"",
            num(steps),
            cm == null ? "null" : num(cm / 100),
            num(floors),
            active == null ? "null" : num(active.total)
        ]);
    }

    // Aktywności z ostatnich 14 dni: start (s), sport (numeracja FIT), czas (s), droga (m).
    function acts(now) {
        if (!(UserProfile has :getUserActivityHistory)) {
            return "[]";
        }
        var rows = [];
        var it = UserProfile.getUserActivityHistory();
        var a = it.next();
        var seen = 0;
        while (a != null && seen < 40 && rows.size() < 20) {
            seen++;
            if (a.startTime != null && a.duration != null && a.type != null && now - a.startTime.value() <= 14 * 86400) {
                rows.add(row([num(a.startTime.value()), num(a.type), num(a.duration.value()), num(a.distance)]));
            }
            a = it.next();
        }
        return row(rows);
    }

    // Tętno, stres, Body Battery, tętno spoczynkowe i sen po dniach.
    function health(now) {
        var store = Application.Storage.getValue(HEALTH);
        if (!(store instanceof Dictionary)) {
            store = {};
        }
        var seen = Application.Storage.getValue(SEEN);
        var from = (seen instanceof Number && seen < now) ? seen : now - FIRST;
        if (now - from > 86400) {
            from = now - 86400;
        }
        var opts = { :period => new Time.Duration(now - from), :order => SensorHistory.ORDER_OLDEST_FIRST };
        if (SensorHistory has :getHeartRateHistory) {
            fold(store, SensorHistory.getHeartRateHistory(opts), from, 0);
        }
        if (SensorHistory has :getStressHistory) {
            fold(store, SensorHistory.getStressHistory(opts), from, 1);
        }
        if (SensorHistory has :getBodyBatteryHistory) {
            fold(store, SensorHistory.getBodyBatteryHistory(opts), from, 2);
        }

        var today = dayOf(Time.now());
        var b = bucket(store, today);
        var profile = UserProfile.getProfile();
        if ((profile has :averageRestingHeartRate) && profile.averageRestingHeartRate != null) {
            b[8] = profile.averageRestingHeartRate;
        }
        var sleep = sleepScore();
        if (sleep != null) {
            b[9] = sleep;
        }
        store[today] = b;
        store = recent(store);
        Application.Storage.setValue(HEALTH, store);
        Application.Storage.setValue(SEEN, now);

        var rows = [];
        var keys = store.keys();
        for (var i = 0; i < keys.size(); i++) {
            var x = store[keys[i]];
            rows.add(row([
                "\"" + keys[i] + "\"",
                num(x[8]),
                num(x[0]),
                x[3] > 0 ? num((x[2] + x[3] / 2) / x[3]) : "null",
                num(x[1]),
                x[5] > 0 ? num((x[4] + x[5] / 2) / x[5]) : "null",
                num(x[6]),
                num(x[7]),
                num(x[9])
            ]));
        }
        return row(rows);
    }

    function bucket(store, key) {
        var b = store[key];
        if (b instanceof Array && b.size() == 10) {
            return b;
        }
        return [null, null, 0, 0, 0, 0, null, null, null, null];
    }

    // Próbki od `from` do kubełków dnia. what: 0 tętno, 1 stres, 2 Body Battery.
    function fold(store, it, from, what) {
        if (it == null) {
            return;
        }
        var s = it.next();
        var n = 0;
        while (s != null && n < MAX_SAMPLES) {
            n++;
            if (s.data != null && s.when != null && s.when.value() > from) {
                var v = s.data.toNumber();
                // Poza zakresem to znacznik „brak pomiaru”, a nie wynik.
                if (what == 0 ? (v >= 25 && v <= 250) : (v >= 0 && v <= 100)) {
                    var key = dayOf(s.when);
                    var b = bucket(store, key);
                    if (what == 0) {
                        b[0] = (b[0] == null || v < b[0]) ? v : b[0];
                        b[1] = (b[1] == null || v > b[1]) ? v : b[1];
                        b[2] += v;
                        b[3] += 1;
                    } else if (what == 1) {
                        b[4] += v;
                        b[5] += 1;
                    } else {
                        b[6] = (b[6] == null || v < b[6]) ? v : b[6];
                        b[7] = (b[7] == null || v > b[7]) ? v : b[7];
                    }
                    store[key] = b;
                }
            }
            s = it.next();
        }
    }

    // Tylko ostatnie dni — starsze aplikacja ma już u siebie.
    function recent(store) {
        var keep = {};
        var now = Time.now();
        for (var i = 0; i < DAYS; i++) {
            var k = dayOf(now.subtract(new Time.Duration(i * 86400)));
            if (store.hasKey(k)) {
                keep[k] = store[k];
            }
        }
        return keep;
    }

    // Wynik snu z ostatniej nocy. Aplikacjom podają go tylko najnowsze zegarki (Complications,
    // Connect IQ 6.0.2+); gdzie indziej — albo gdy przebieg w tle nie ma do niego dostępu — null.
    function sleepScore() {
        if (!(Toybox has :Complications) || !(Toybox.Complications has :COMPLICATION_TYPE_SLEEP_SCORE)) {
            return null;
        }
        try {
            var c = Toybox.Complications.getComplication(
                new Toybox.Complications.Id(Toybox.Complications.COMPLICATION_TYPE_SLEEP_SCORE));
            return (c != null && c.value instanceof Number) ? c.value : null;
        } catch (e) {
            return null;
        }
    }
}
