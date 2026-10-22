import Toybox.Lang;
import Toybox.Test;
import Toybox.Time;

// Następna wysyłka na ekranie aplikacji: pół godziny po ostatnim przebiegu w tle, „wkrótce”, gdy
// pora minęła, i „w ciągu 30 min”, gdy przebiegu jeszcze nie było. Teksty przez `Status.say`, bo
// zależą od języka zegarka (symulator bywa po angielsku albo po polsku).
(:test)
function nextSendHalfAnHourAfterLastRun(logger as Test.Logger) as Boolean {
    var now = Time.now().value();
    Test.assertEqualMessage(
        NextSend.say(now - 600, now),
        Status.say("Następna ok. ", "Next ~") + Status.clock(now - 600 + 1800),
        "za 20 minut");
    Test.assertEqualMessage(NextSend.say(now - 1800, now), Status.say("Następna wkrótce", "Next soon"), "pora minęła");
    Test.assertEqualMessage(
        NextSend.say(null, now),
        Status.say("Następna w ciągu 30 min", "Next within 30 min"),
        "jeszcze bez przebiegu");
    return true;
}
