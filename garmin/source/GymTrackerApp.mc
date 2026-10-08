import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.Time;
import Toybox.WatchUi;

// Aplikacja na zegarek: w tle co pół godziny wysyła zaszyfrowany tydzień danych do serwera
// GYM TRACKER, a na ekranie mówi, kiedy wysłała ostatnio. Klucz wkleja się w ustawieniach
// aplikacji w Garmin Connect na telefonie — skąd się bierze, mówi karta „Zegarek Garmin”
// w ustawieniach aplikacji GYM TRACKER.
(:background)
class GymTrackerApp extends Application.AppBase {

    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        // Przebieg w tle rusza dopiero po pierwszym otwarciu — wcześniej zegarek nie wie,
        // że ma go planować.
        if (Background.getTemporalEventRegisteredTime() == null) {
            Background.registerForTemporalEvent(new Time.Duration(Sync.EVERY));
        }
        var view = new MainView();
        return [view, new MainDelegate(view)];
    }

    (:glance)
    function getGlanceView() {
        return [new SyncGlance()];
    }

    function getServiceDelegate() {
        return [new SyncService()];
    }

    // Kod odpowiedzi z przebiegu w tle.
    function onBackgroundData(data) {
        Status.save(data);
        WatchUi.requestUpdate();
    }

    function onSettingsChanged() {
        WatchUi.requestUpdate();
    }
}
