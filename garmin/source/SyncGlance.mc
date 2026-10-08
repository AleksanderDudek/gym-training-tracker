import Toybox.Graphics;
import Toybox.WatchUi;

// Podgląd na liście aplikacji: nazwa i stan ostatniej wysyłki.
(:glance)
class SyncGlance extends WatchUi.GlanceView {

    function initialize() {
        GlanceView.initialize();
    }

    function onUpdate(dc) {
        var h = dc.getHeight();
        var left = Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(0, h / 3, Graphics.FONT_GLANCE, "GYM TRACKER", left);
        dc.drawText(0, h * 2 / 3, Graphics.FONT_GLANCE, Status.text(), left);
    }
}
