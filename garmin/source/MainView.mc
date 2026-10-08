import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Ekran aplikacji: nazwa, stan ostatniej wysyłki i podpowiedź, że da się wysłać od razu.
class MainView extends WatchUi.View {
    var busy = false;

    function initialize() {
        View.initialize();
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var center = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
        dc.clear();
        dc.drawText(w / 2, h * 3 / 10, Graphics.FONT_SMALL, "GYM TRACKER", center);
        dc.drawText(w / 2, h / 2, Graphics.FONT_XTINY, busy ? "Wysyłam..." : Status.text(), center);
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, h * 7 / 10, Graphics.FONT_XTINY, "Wyślij teraz: START", center);
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
