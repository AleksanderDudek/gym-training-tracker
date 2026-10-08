import Toybox.Application;
import Toybox.Communications;
import Toybox.Cryptography;
import Toybox.Lang;
import Toybox.Time;

// Jedna wysyłka: zbierz tydzień, zaszyfruj kluczem z ustawień, wyślij do skrzynki na serwerze.
// Woła ją przebieg w tle (SyncService) i przycisk na ekranie aplikacji (MainView).
(:background)
module Sync {
    // Co ile sekund przebieg w tle. Serwer przyjmuje najwyżej jedną paczkę na minutę.
    const EVERY = 1800;
    // Kod zamiast odpowiedzi serwera: w ustawieniach nie ma poprawnego klucza. Status.mc zna go
    // jako liczbę, bo podgląd (glance) nie widzi tego modułu.
    const NO_KEY = -1000;

    function payload(now) {
        return "{\"v\":1,\"t\":" + now.toString()
            + ",\"d\":" + Collect.days()
            + ",\"a\":" + Collect.acts(now)
            + ",\"h\":" + Collect.health(now) + "}";
    }

    // `done` dostaje kod odpowiedzi HTTP albo ujemny kod błędu łączności.
    function run(done) {
        var secret = Seal.keyBytes(Application.Properties.getValue("key"));
        if (secret == null) {
            done.invoke(NO_KEY);
            return;
        }
        var now = Time.now().value();
        var body = {
            "box" => Seal.box(secret),
            "blob" => Seal.seal(secret, payload(now), Cryptography.randomBytes(16))
        };
        Communications.makeWebRequest(
            (Application.Properties.getValue("api") as String) + "/garmin/push",
            body,
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :headers => { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON },
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            new Reply(done).method(:onReply)
        );
    }

    // Odpowiedź wraca do tego, kto wysyłał: przebiegu w tle albo ekranu.
    class Reply {
        var done;

        function initialize(d) {
            done = d;
        }

        function onReply(code, data) as Void {
            done.invoke(code);
        }
    }
}
