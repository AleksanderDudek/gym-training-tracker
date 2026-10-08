import Toybox.Lang;
import Toybox.Test;

// Ten sam wektor co w src/watchseal.test.ts i server/api/garmin.test.ts — policzony niezależnie
// przez node:crypto. Jeśli się rozjedzie, aplikacja nie otworzy ani jednej paczki z zegarka.
(:test)
function sealMatchesAppVector(logger as Test.Logger) as Boolean {
    var secret = Seal.keyBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    var iv = Seal.fromHex("a0a1a2a3a4a5a6a7a8a9aaabacadaeaf");
    Test.assertEqualMessage(Seal.box(secret), "737a7eb70569826b3e8462ab4ac24904", "skrzynka");
    Test.assertEqualMessage(
        Seal.seal(secret, "{\"v\":1}", iv),
        "AaChoqOkpaanqKmqq6ytrq9nI0xALzFgri8DBZAN/yhxd7AY60ot2CVM9j2Gz9jgGIqwuDTJGghOUyekfekvvks=",
        "koperta");
    return true;
}

(:test)
function keyIgnoresSpacesDashesAndCase(logger as Test.Logger) as Boolean {
    Test.assert(Seal.keyBytes("00010203 04050607-08090A0B 0C0D0E0F 10111213 14151617 18191A1B 1C1D1E1F") != null);
    Test.assert(Seal.keyBytes("abc") == null);
    Test.assert(Seal.keyBytes("zz02030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f") == null);
    Test.assert(Seal.keyBytes(null) == null);
    return true;
}
