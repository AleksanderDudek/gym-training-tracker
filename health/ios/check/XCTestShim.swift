import Foundation

// Atrapa XCTest dla check.sh: Command Line Tools nie mają XCTest, a testy mają chodzić bez Xcode.
// Tylko to, czego używają testy w GymTrackerZdrowieTests — z tymi samymi sygnaturami, więc te same
// pliki kompilują się i tu, i w Xcode.

class XCTestCase {
    required init() {}
}

struct XCTestFailure {
    let message: String
    let file: StaticString
    let line: UInt
}

enum XCTestShim {
    nonisolated(unsafe) static var failures: [XCTestFailure] = []

    static func fail(_ message: String, _ file: StaticString, _ line: UInt) {
        failures.append(XCTestFailure(message: message, file: file, line: line))
    }
}

struct XCTUnwrapError: Error {}

private func note(_ m: () -> String) -> String {
    let s = m()
    return s.isEmpty ? "" : " — \(s)"
}

func XCTFail(_ message: String = "", file: StaticString = #filePath, line: UInt = #line) {
    XCTestShim.fail("XCTFail" + note { message }, file, line)
}

func XCTAssertEqual<T: Equatable>(
    _ a: @autoclosure () throws -> T, _ b: @autoclosure () throws -> T, _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath, line: UInt = #line
) {
    do {
        let (x, y) = (try a(), try b())
        if x != y { XCTestShim.fail("(\(x)) != (\(y))" + note(message), file, line) }
    } catch {
        XCTestShim.fail("rzucił \(error)" + note(message), file, line)
    }
}

func XCTAssertNotEqual<T: Equatable>(
    _ a: @autoclosure () throws -> T, _ b: @autoclosure () throws -> T, _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath, line: UInt = #line
) {
    do {
        let (x, y) = (try a(), try b())
        if x == y { XCTestShim.fail("(\(x)) == (\(y))" + note(message), file, line) }
    } catch {
        XCTestShim.fail("rzucił \(error)" + note(message), file, line)
    }
}

func XCTAssertLessThanOrEqual<T: Comparable>(
    _ a: @autoclosure () throws -> T, _ b: @autoclosure () throws -> T, _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath, line: UInt = #line
) {
    do {
        let (x, y) = (try a(), try b())
        if !(x <= y) { XCTestShim.fail("(\(x)) > (\(y))" + note(message), file, line) }
    } catch {
        XCTestShim.fail("rzucił \(error)" + note(message), file, line)
    }
}

func XCTAssertTrue(
    _ v: @autoclosure () throws -> Bool, _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath, line: UInt = #line
) {
    XCTAssertEqual(try v(), true, message(), file: file, line: line)
}

func XCTAssertFalse(
    _ v: @autoclosure () throws -> Bool, _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath, line: UInt = #line
) {
    XCTAssertEqual(try v(), false, message(), file: file, line: line)
}

func XCTAssertNil(
    _ v: @autoclosure () throws -> Any?, _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath, line: UInt = #line
) {
    do {
        if let x = try v() { XCTestShim.fail("(\(x)) nie jest nil" + note(message), file, line) }
    } catch {
        XCTestShim.fail("rzucił \(error)" + note(message), file, line)
    }
}

func XCTAssertThrowsError<T>(
    _ v: @autoclosure () throws -> T, _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath, line: UInt = #line
) {
    do {
        _ = try v()
        XCTestShim.fail("nie rzucił" + note(message), file, line)
    } catch {}
}

func XCTUnwrap<T>(
    _ v: @autoclosure () throws -> T?, _ message: @autoclosure () -> String = "",
    file: StaticString = #filePath, line: UInt = #line
) throws -> T {
    guard let x = try v() else {
        XCTestShim.fail("XCTUnwrap: nil" + note(message), file, line)
        throw XCTUnwrapError()
    }
    return x
}
