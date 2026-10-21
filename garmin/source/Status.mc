import Toybox.Application;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;

// Stan wysyłki słowami: na ekranie aplikacji i w podglądzie (glance). Teksty krótkie, bo na
// okrągłym ekranie mieści się kilkanaście znaków w linii.
//
// Po polsku na zegarku z polskim językiem, po angielsku na każdym innym. Teksty w kodzie, a nie
// w zasobach: podgląd (glance) i przebieg w tle mają osobne, małe pule pamięci, a zasoby
// językowe trzeba by do nich osobno dopuszczać.
(:glance)
module Status {
    const LAST = "last";

    function pl() {
        var s = System.getDeviceSettings();
        return (s has :systemLanguage) && s.systemLanguage == System.LANGUAGE_POL;
    }

    // Tekst po polsku albo po angielsku — według języka zegarka.
    function say(polish, english) {
        return pl() ? polish : english;
    }

    function save(code) {
        Application.Storage.setValue(LAST, [code, Time.now().value()]);
    }

    function text() {
        var key = Application.Properties.getValue("key");
        if (!(key instanceof String) || key.length() == 0) {
            return say("Wklej klucz w Garmin Connect", "Paste the key in Garmin Connect");
        }
        var last = Application.Storage.getValue(LAST);
        if (!(last instanceof Array) || last.size() != 2) {
            return say("Czeka na pierwszą wysyłkę", "Waiting for the first send");
        }
        var code = last[0];
        if (code == 200) {
            return say("Wysłane ", "Sent ") + clock(last[1]);
        }
        // Sync.NO_KEY — klucz w ustawieniach nie ma 64 znaków hex.
        if (code == -1000) {
            return say("Zły klucz - wklej go jeszcze raz", "Wrong key - paste it again");
        }
        if (code == 429) {
            return say("Za często - za minutę", "Too often - try in a minute");
        }
        if (code instanceof Number && code < 0) {
            return say("Brak telefonu w pobliżu", "No phone nearby");
        }
        return say("Błąd serwera ", "Server error ") + code;
    }

    function clock(at) {
        var g = Gregorian.info(new Time.Moment(at), Time.FORMAT_SHORT);
        return g.hour.format("%d") + ":" + g.min.format("%02d");
    }
}
