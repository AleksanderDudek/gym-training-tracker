import Foundation
#if !GT_CHECK
import XCTest
@testable import GymTrackerZdrowie
#endif

final class SealTests: XCTestCase {
    func testCleanKeyIgnoresSpacesDashesAndCase() throws {
        let v = try Vector.load()
        let messy = " " + v.key.uppercased().enumerated()
            .map { $0.offset > 0 && $0.offset % 8 == 0 ? "-\($0.element)" : "\($0.element)" }.joined() + "\n"
        XCTAssertEqual(Seal.cleanKey(messy), v.key)
        XCTAssertEqual(Seal.cleanKey(String(v.key.prefix(32)) + "\r\n\t" + String(v.key.dropFirst(32))), v.key)
    }

    func testCleanKeyRejectsWhatIsNotAKey() throws {
        let v = try Vector.load()
        XCTAssertNil(Seal.cleanKey(String(v.key.dropLast())))
        XCTAssertNil(Seal.cleanKey(v.key + "0"))
        XCTAssertNil(Seal.cleanKey("g" + v.key.dropFirst()))
        XCTAssertNil(Seal.cleanKey("klucz: " + v.key))
        // Cyfry pełnej szerokości są dla Swifta „hex digit”, dla aplikacji nie.
        XCTAssertNil(Seal.cleanKey("０" + v.key.dropFirst()))
        XCTAssertNil(Seal.cleanKey(""))
    }

    func testDerivedKeysMatchVector() throws {
        let v = try Vector.load()
        let keys = try XCTUnwrap(Seal.deriveKeys(v.key))
        XCTAssertEqual(keys.box, v.box)
        XCTAssertEqual(Seal.hex(keys.enc), v.enc)
        XCTAssertEqual(Seal.hex(keys.mac), v.mac)
        XCTAssertNil(Seal.deriveKeys("abc"))
    }

    func testBlobMatchesVectorByteForByte() throws {
        let v = try Vector.load()
        let keys = try XCTUnwrap(Seal.deriveKeys(v.key))
        let iv = try XCTUnwrap(Seal.bytes(hex: v.iv))
        XCTAssertEqual(try Seal.seal(keys, v.plaintext, iv: iv), v.blob)
        XCTAssertEqual(openEnvelope(keys, v.blob), v.plaintext)
    }

    func testRandomIVEveryTime() throws {
        let v = try Vector.load()
        let keys = try XCTUnwrap(Seal.deriveKeys(v.key))
        let a = try Seal.seal(keys, v.plaintext)
        let b = try Seal.seal(keys, v.plaintext)
        XCTAssertNotEqual(a, b)
        XCTAssertEqual(a.count, v.blob.count)
        XCTAssertEqual(openEnvelope(keys, a), v.plaintext)
        XCTAssertEqual(openEnvelope(keys, b), v.plaintext)
    }

    func testTamperedBlobDoesNotOpen() throws {
        let v = try Vector.load()
        let keys = try XCTUnwrap(Seal.deriveKeys(v.key))
        var env = try XCTUnwrap(Data(base64Encoded: v.blob))
        env[20] ^= 1
        XCTAssertNil(openEnvelope(keys, env.base64EncodedString()))
    }

    func testRejectsWrongIVLength() throws {
        let v = try Vector.load()
        let keys = try XCTUnwrap(Seal.deriveKeys(v.key))
        XCTAssertThrowsError(try Seal.seal(keys, "{}", iv: Data(count: 8)))
    }
}
