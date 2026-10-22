import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;

// Przebieg w tle co pół godziny: zbierz, zaszyfruj, wyślij i oddaj kod odpowiedzi aplikacji.
// Zapytanie idzie przez aplikację Garmin Connect na telefonie — bez telefonu w pobliżu wraca
// ujemny kod, a następny przebieg wyśle cały tydzień jeszcze raz.
(:background)
class SyncService extends System.ServiceDelegate {

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        // Zegarek sam pamięta czas ostatniego przebiegu (`getLastTemporalEventTime`), ale zapomina
        // go przy każdym otwarciu aplikacji — czyli właśnie wtedy, gdy ktoś patrzy, kiedy następna.
        Application.Storage.setValue(Sync.LAST_RUN, Time.now().value());
        Sync.run(method(:onDone));
    }

    function onDone(code) as Void {
        Background.exit(code);
    }
}
