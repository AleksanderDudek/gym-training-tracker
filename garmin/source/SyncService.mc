import Toybox.Background;
import Toybox.Lang;
import Toybox.System;

// Przebieg w tle co pół godziny: zbierz, zaszyfruj, wyślij i oddaj kod odpowiedzi aplikacji.
// Zapytanie idzie przez aplikację Garmin Connect na telefonie — bez telefonu w pobliżu wraca
// ujemny kod, a następny przebieg wyśle cały tydzień jeszcze raz.
(:background)
class SyncService extends System.ServiceDelegate {

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        Sync.run(method(:onDone));
    }

    function onDone(code) as Void {
        Background.exit(code);
    }
}
