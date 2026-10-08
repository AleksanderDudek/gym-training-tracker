import Toybox.Application;
import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;

// Stan wysyłki słowami: na ekranie aplikacji i w podglądzie (glance). Teksty krótkie, bo na
// okrągłym ekranie mieści się kilkanaście znaków w linii.
(:glance)
module Status {
    const LAST = "last";

    function save(code) {
        Application.Storage.setValue(LAST, [code, Time.now().value()]);
    }

    function text() {
        var key = Application.Properties.getValue("key");
        if (!(key instanceof String) || key.length() == 0) {
            return "Wklej klucz w Garmin Connect";
        }
        var last = Application.Storage.getValue(LAST);
        if (!(last instanceof Array) || last.size() != 2) {
            return "Czeka na pierwszą wysyłkę";
        }
        var code = last[0];
        if (code == 200) {
            return "Wysłane " + clock(last[1]);
        }
        // Sync.NO_KEY — klucz w ustawieniach nie ma 64 znaków hex.
        if (code == -1000) {
            return "Zły klucz - wklej go jeszcze raz";
        }
        if (code == 429) {
            return "Za często - za minutę";
        }
        if (code instanceof Number && code < 0) {
            return "Brak telefonu w pobliżu";
        }
        return "Błąd serwera " + code;
    }

    function clock(at) {
        var g = Gregorian.info(new Time.Moment(at), Time.FORMAT_SHORT);
        return g.hour.format("%d") + ":" + g.min.format("%02d");
    }
}
