import Toybox.Lang;
import Toybox.Test;
import Toybox.Time;

// Przebieg czyta najwyżej MAX_SAMPLES próbek z czujnika. Więcej przerywa aplikację na zegarkach
// z budżetem 120 000 instrukcji na wywołanie (Instinct 2/2S, fenix 6, Forerunner 245/255): ikona
// z wykrzyknikiem po START. Czego przebieg nie zmieści, bierze następny — bez dziur i bez liczenia
// tej samej próbki dwa razy.

(:test)
class FakeSample {
    var data;
    var when;

    function initialize(d, w) {
        data = d;
        when = w;
    }
}

// Jak historia czujnika z `:period`: tylko próbki po `after`, co minutę od `first`. Od najstarszej
// albo — jak stres i Body Battery w symulatorze mimo ORDER_OLDEST_FIRST — od najnowszej.
(:test)
class FakeHistory {
    var samples = [];
    var i = 0;

    function initialize(first, count, after, newestFirst) {
        for (var k = 0; k < count; k++) {
            var t = first + (newestFirst ? count - 1 - k : k) * 60;
            if (t > after) {
                samples.add(new FakeSample(60, new Time.Moment(t)));
            }
        }
    }

    function next() {
        if (i >= samples.size()) {
            return null;
        }
        i++;
        return samples[i - 1];
    }
}

// Pomocnik w module: funkcję globalną z (:test) runner wziąłby za test.
(:test)
module CollectFake {
    // Ile próbek tętna trafiło do kubełków, ze wszystkich dni.
    function heartSamples(store) {
        var total = 0;
        var keys = store.keys();
        for (var i = 0; i < keys.size(); i++) {
            total += store[keys[i]][3];
        }
        return total;
    }
}

(:test)
function foldStopsAtBudgetAndNextRunTakesTheRest(logger as Test.Logger) as Boolean {
    var now = Time.now().value();
    var count = Collect.MAX_SAMPLES + 30;
    var first = now - count * 60;
    var from = first - 1;
    var store = {};

    var upTo = Collect.fold(store, new FakeHistory(first, count, from, false), from, now, 0);
    Test.assertEqualMessage(upTo, first + (Collect.MAX_SAMPLES - 1) * 60, "do ostatniej przeczytanej");
    Test.assertEqualMessage(CollectFake.heartSamples(store), Collect.MAX_SAMPLES, "tylko budżet");

    upTo = Collect.fold(store, new FakeHistory(first, count, upTo, false), upTo, now, 0);
    Test.assertEqualMessage(upTo, now, "reszta w drugim przebiegu");
    Test.assertEqualMessage(CollectFake.heartSamples(store), count, "każda próbka raz");
    return true;
}

// Od najnowszej: przebieg bierze najnowsze próbki, a starszą zaległość pomija (jak przed budżetem
// przy 600 próbkach) — następny przebieg nie może przeczytać ich drugi raz.
(:test)
function foldNewestFirstNeverCountsTwice(logger as Test.Logger) as Boolean {
    var now = Time.now().value();
    var count = Collect.MAX_SAMPLES + 30;
    var first = now - count * 60;
    var from = first - 1;
    var store = {};

    var upTo = Collect.fold(store, new FakeHistory(first, count, from, true), from, now, 0);
    Test.assertEqualMessage(upTo, first + (count - 1) * 60, "do najnowszej przeczytanej");
    Test.assertEqualMessage(CollectFake.heartSamples(store), Collect.MAX_SAMPLES, "tylko budżet");

    upTo = Collect.fold(store, new FakeHistory(first, count, upTo, true), upTo, now, 0);
    Test.assertEqualMessage(CollectFake.heartSamples(store), Collect.MAX_SAMPLES, "bez drugiego liczenia");
    return true;
}

(:test)
function sinceReadsEachSensorAndOldSingleNumber(logger as Test.Logger) as Boolean {
    var now = Time.now().value();
    Test.assertEqualMessage(Collect.since(null, 0, now), now - Collect.FIRST, "pierwszy przebieg");
    Test.assertEqualMessage(Collect.since(now - 600, 2, now), now - 600, "zapis z poprzedniej wersji");
    Test.assertEqualMessage(Collect.since([now - 100, now - 200, now - 300], 1, now), now - 200, "osobno dla czujnika");
    Test.assertEqualMessage(Collect.since([now - 5 * 86400, now, now], 0, now), now - 86400, "najwyżej doba");
    Test.assertEqualMessage(Collect.since([now, now, now + 60], 2, now), now - Collect.FIRST, "zapis z przyszłości");
    return true;
}
