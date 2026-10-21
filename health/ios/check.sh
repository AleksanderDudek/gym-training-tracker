#!/usr/bin/env bash
# Sprawdzenie aplikacji bez Xcode — wystarczą Command Line Tools (`xcode-select --install`).
#
#   ./check.sh         testy części bez HealthKit i UI: koperta (wspólny wektor ../vectors.json),
#                      paczka i sen — te same pliki XCTest co w Xcode, z atrapą XCTest
#   ./check.sh --app   do tego kompilacja całej aplikacji w trybie Swift 6: jako Mac Catalyst
#                      z API iOS 17 (UIKit, BackgroundTasks, HealthKit, SwiftUI) i jako macOS 14
#
# Kończy się kodem różnym od zera przy każdym błędzie.
set -euo pipefail

cd "$(dirname "$0")"
here=$(pwd)
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT

sdk=$(xcrun --sdk macosx --show-sdk-path)
flags=()
# Aktualizacja Command Line Tools potrafi zostawić stary usr/include/swift/module.modulemap obok
# nowego bridging.modulemap. Oba definiują SwiftBridging i nawet Foundation się wtedy nie kompiluje.
# Nakładka VFS chowa stary plik tylko dla tej kompilacji — bez sudo i bez ruszania systemu.
inc="$(dirname "$(xcrun --find swiftc)")/../include/swift"
if [[ -f "$inc/module.modulemap" && -f "$inc/bridging.modulemap" ]]; then
  : >"$out/empty.modulemap"
  printf '{"version":0,"roots":[{"name":"%s","type":"directory","contents":[{"name":"module.modulemap","type":"file","external-contents":"%s"}]}]}\n' \
    "$(cd "$inc" && pwd)" "$out/empty.modulemap" >"$out/overlay.yaml"
  flags+=(-vfsoverlay "$out/overlay.yaml")
fi

pure=("$here/GymTrackerZdrowie/Seal.swift" "$here/GymTrackerZdrowie/Payload.swift" "$here/GymTrackerZdrowie/Sleep.swift")
tests=("$here"/GymTrackerZdrowieTests/*.swift)
expected=$(cat "${tests[@]}" | grep -c 'func test[A-Za-z0-9_]*()' || true)

echo "Testy (swiftc, macOS):"
xcrun swiftc -swift-version 5 -D GT_CHECK -sdk "$sdk" ${flags[@]+"${flags[@]}"} -o "$out/check" \
  "${pure[@]}" "${tests[@]}" "$here/check/XCTestShim.swift" "$here/check/main.swift"
"$out/check" "$expected"

[[ "${1:-}" == "--app" ]] || exit 0

app=("$here"/GymTrackerZdrowie/*.swift)
catalyst="$sdk/System/iOSSupport"
ios=(-target arm64-apple-ios17.0-macabi -Fsystem "$catalyst/System/Library/Frameworks"
  -I "$catalyst/usr/lib/swift" -L "$catalyst/usr/lib/swift")

# Pełna kompilacja z linkowaniem, nie samo `-typecheck`: błędy współbieżności (regiony, `sending`)
# wychodzą dopiero przy generowaniu kodu. Ostrzeżenia to błędy. Pliku nie da się uruchomić —
# liczy się, że powstał. Mac Catalyst to iOS na Macu: ten sam UIKit, HealthKit i BackgroundTasks.
build() {
  local name=$1
  shift
  echo "Cała aplikacja — $name:"
  xcrun swiftc -parse-as-library -wmo -warnings-as-errors -sdk "$sdk" ${flags[@]+"${flags[@]}"} \
    -emit-executable -o "$out/app" "$@" "${app[@]}"
  echo "  ok"
}
build "Mac Catalyst z API iOS 17, Swift 5 + pełne sprawdzanie współbieżności (jak w projekcie)" \
  -swift-version 5 -strict-concurrency=complete "${ios[@]}"
build "Mac Catalyst z API iOS 17, Swift 6" -swift-version 6 "${ios[@]}"
build "macOS 14, Swift 6 (gałęzie bez UIKit)" -swift-version 6 -target arm64-apple-macos14.0
