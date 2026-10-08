import Toybox.Cryptography;
import Toybox.Lang;
import Toybox.StringUtil;

// Koperta danych: 0x01 ‖ IV ‖ AES-256-CBC(PKCS#7) ‖ HMAC-SHA256 ze wszystkiego przed nim, w base64.
// Ten sam format otwiera aplikacja (src/watchseal.ts), a test w SealTest.mc pilnuje, żeby oba
// końce dawały bajt w bajt to samo dla tego samego klucza i IV.
//
// Z klucza wychodzą trzy klucze pochodne, jak w HKDF-Expand z jednym blokiem:
// HMAC(klucz, etykieta ‖ 0x01) dla "gt-box" (adres skrzynki), "gt-enc" (AES) i "gt-mac" (podpis).
(:background)
module Seal {

    // Klucz z ustawień: 64 znaki hex. Spacje, łączniki, nowe linie i wielkość liter nie mają
    // znaczenia — tak samo jak w `cleanKey` w aplikacji. Inny znak to nie klucz.
    function keyBytes(raw) {
        if (!(raw instanceof String)) {
            return null;
        }
        var chars = raw.toLower().toCharArray();
        var hex = "";
        for (var i = 0; i < chars.size(); i++) {
            var n = chars[i].toNumber();
            if (n == 32 || n == 45 || n == 9 || n == 10 || n == 13) {
                continue;
            }
            if (!((n >= 48 && n <= 57) || (n >= 97 && n <= 102))) {
                return null;
            }
            hex += chars[i].toString();
        }
        if (hex.length() != 64) {
            return null;
        }
        return fromHex(hex);
    }

    function fromHex(hex) {
        return StringUtil.convertEncodedString(hex, {
            :fromRepresentation => StringUtil.REPRESENTATION_STRING_HEX,
            :toRepresentation => StringUtil.REPRESENTATION_BYTE_ARRAY
        });
    }

    // Małymi literami, jak identyfikator skrzynki po stronie serwera i aplikacji.
    function toHex(bytes) {
        var s = StringUtil.convertEncodedString(bytes, {
            :fromRepresentation => StringUtil.REPRESENTATION_BYTE_ARRAY,
            :toRepresentation => StringUtil.REPRESENTATION_STRING_HEX
        });
        return s.toLower();
    }

    function bytes(text) {
        return StringUtil.convertEncodedString(text, {
            :fromRepresentation => StringUtil.REPRESENTATION_STRING_PLAIN_TEXT,
            :toRepresentation => StringUtil.REPRESENTATION_BYTE_ARRAY,
            :encoding => StringUtil.CHAR_ENCODING_UTF8
        });
    }

    function hmac(key, message) {
        var h = new Cryptography.HashBasedMessageAuthenticationCode({
            :algorithm => Cryptography.HASH_SHA256,
            :key => key
        });
        h.update(message);
        return h.digest();
    }

    function derive(secret, label) {
        var message = bytes(label);
        message.add(0x01);
        return hmac(secret, message);
    }

    // Identyfikator skrzynki na serwerze: pierwsze 16 bajtów klucza pochodnego, hex.
    function box(secret) {
        return toHex(derive(secret, "gt-box").slice(0, 16));
    }

    function seal(secret, text, iv) {
        var data = bytes(text);
        // PKCS#7: Connect IQ szyfruje tylko pełne bloki, a przeglądarka zdejmuje to dopełnienie sama.
        var pad = 16 - (data.size() % 16);
        for (var i = 0; i < pad; i++) {
            data.add(pad);
        }
        var cipher = new Cryptography.Cipher({
            :algorithm => Cryptography.CIPHER_AES256,
            :mode => Cryptography.MODE_CBC,
            :key => derive(secret, "gt-enc"),
            :iv => iv
        });
        var envelope = new [1]b;
        envelope[0] = 0x01;
        envelope.addAll(iv);
        envelope.addAll(cipher.encrypt(data));
        // Podpis liczony z koperty bez podpisu — argument powstaje, zanim `addAll` ją wydłuży.
        envelope.addAll(hmac(derive(secret, "gt-mac"), envelope));
        return StringUtil.convertEncodedString(envelope, {
            :fromRepresentation => StringUtil.REPRESENTATION_BYTE_ARRAY,
            :toRepresentation => StringUtil.REPRESENTATION_STRING_BASE64
        });
    }
}
