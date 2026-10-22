import Toybox.Application;
import Toybox.Background;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Time;
import Toybox.WatchUi;

// Ekran aplikacji: nazwa, stan ostatniej wysyłki, kiedy następna i podpowiedź, że da się wysłać
// od razu. Następna wysyłka tylko tutaj, nie w podglądzie (glance): podgląd ma osobną, małą pulę
// pamięci, a na liście aplikacji wystarczy wiedzieć, czy ostatnia doszła.
class MainView extends WatchUi.View {
    var busy = false;

    function initialize() {
        View.initialize();
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        var small = Graphics.FONT_XTINY;
        var line = dc.getFontHeight(small);
        var status = busy ? Status.say("Wysyłam...", "Sending...") : Status.text();
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        dc.drawText(w / 2, h * 27 / 100, Graphics.FONT_SMALL, "GYM TRACKER", center);
        // Stan w najwyżej dwóch liniach: „Zły klucz - wklej go jeszcze raz” nie mieści się w jednej
        // na okrągłym ekranie 218 px.
        dc.drawText(w / 2, h * 46 / 100, small, Graphics.fitTextToArea(status, small, w * 4 / 5, line * 2, true), center);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 46 / 100 + line * 3 / 2, small, NextSend.text(), center);
        dc.drawText(w / 2, h * 75 / 100, small, Status.say("Wyślij teraz: START", "Send now: START"), center);
    }

    function send() {
        if (busy) {
            return;
        }
        busy = true;
        WatchUi.requestUpdate();
        Sync.run(method(:onSent));
    }

    function onSent(code) as Void {
        busy = false;
        Status.save(code);
        WatchUi.requestUpdate();
    }
}

// Kiedy następna wysyłka w tle: ostatni przebieg plus pół godziny. Bez tego ktoś, kto nie widzi
// danych w aplikacji, nie wie, czy coś jest zepsute, czy wystarczy poczekać kwadrans.
module NextSend {
    function text() {
        return say(lastRun(), Time.now().value());
    }

    // Ostatni przebieg w tle w sekundach albo `null`. Późniejszy z dwóch: zapisany przez sam
    // przebieg (zegarek zapomina swój przy każdym otwarciu aplikacji) i podany przez zegarek
    // (zapisu jeszcze nie ma, póki nie ruszył pierwszy przebieg z tą wersją aplikacji).
    function lastRun() {
        var saved = Application.Storage.getValue(Sync.LAST_RUN);
        var moment = Background.getLastTemporalEventTime();
        var known = moment != null ? moment.value() : null;
        if (saved instanceof Number && (known == null || saved > known)) {
            return saved;
        }
        return known;
    }

    // `last` — sekundy ostatniego przebiegu albo `null`; `now` — sekundy teraz.
    function say(last, now) {
        if (last == null) {
            // Przebieg rusza pół godziny po rejestracji, czyli po pierwszym otwarciu aplikacji.
            return Status.say("Następna w ciągu 30 min", "Next within 30 min");
        }
        var next = last + Sync.EVERY;
        if (next <= now) {
            // Pora minęła — zegarek odpali przebieg, gdy tylko będzie mógł.
            return Status.say("Następna wkrótce", "Next soon");
        }
        return Status.say("Następna ok. ", "Next ~") + Status.clock(next);
    }
}

// START na zegarkach z przyciskami, stuknięcie na dotykowych — oba to `onSelect`.
class MainDelegate extends WatchUi.BehaviorDelegate {
    var view;

    function initialize(v) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onSelect() {
        view.send();
        return true;
    }
}
