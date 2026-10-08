#!/usr/bin/env bash
# Build aplikacji na zegarek. Polecenia:
#
#   ./build.sh test fr265    testy (wektor koperty, klucz) w symulatorze
#   ./build.sh run fr265     aplikacja w symulatorze
#   ./build.sh prg fr265     plik .prg do wgrania przez USB do GARMIN/APPS/
#   ./build.sh store         paczka .iq na wszystkie zegarki z manifestu — do Developer Dashboard
#
# SDK: ten wybrany w SDK Managerze albo ścieżka w CIQ_SDK.
# Klucz dewelopera: CIQ_KEY albo ~/.garmin/developer_key.der — tworzony przy pierwszym buildzie.
# Tym samym kluczem trzeba podpisywać każdą kolejną wersję w sklepie, więc trzymaj jego kopię.
set -euo pipefail
cd "$(dirname "$0")"

cmd="${1:-}"
device="${2:-}"
case "$cmd" in
  test | run | prg | store) ;;
  *)
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac

CFG="$HOME/Library/Application Support/Garmin/ConnectIQ/current-sdk.cfg"
SDK="${CIQ_SDK:-$( [ -f "$CFG" ] && tr -d '\r\n' < "$CFG" || true )}"
SDK="${SDK%/}"
if [ -z "$SDK" ] || [ ! -x "$SDK/bin/monkeyc" ]; then
  echo "Nie widzę Connect IQ SDK. Zainstaluj je przez SDK Manager albo podaj ścieżkę: CIQ_SDK=/ścieżka/do/sdk $0 $*" >&2
  exit 1
fi

KEY="${CIQ_KEY:-$HOME/.garmin/developer_key.der}"
if [ ! -f "$KEY" ]; then
  mkdir -p "$(dirname "$KEY")"
  ( umask 077
    openssl genrsa -out "${KEY%.der}.pem" 4096 2>/dev/null
    openssl pkcs8 -topk8 -inform PEM -outform DER -in "${KEY%.der}.pem" -out "$KEY" -nocrypt )
  echo "Nowy klucz dewelopera: $KEY — zrób kopię. Bez niego nie wydasz aktualizacji tej samej aplikacji." >&2
fi

# Adres serwera musi być prawdziwy, zanim cokolwiek trafi na zegarek.
if grep -q 'WPISZ' resources/settings/properties.xml; then
  echo "W resources/settings/properties.xml został adres zastępczy serwera (api)." >&2
  exit 1
fi

mkdir -p bin
mc() { "$SDK/bin/monkeyc" -f monkey.jungle -y "$KEY" "$@"; }
sim() {
  # Symulator musi już działać, zanim monkeydo wgra do niego aplikację.
  "$SDK/bin/connectiq" >/dev/null 2>&1 &
  sleep 6
  "$SDK/bin/monkeydo" "$@"
}

need_device() {
  if [ -z "$device" ]; then
    echo "Podaj zegarek, np.: $0 $cmd fr265 (lista w manifest.xml)" >&2
    exit 1
  fi
}

case "$cmd" in
  test)
    need_device
    mc -o bin/test.prg -d "$device" --unit-test
    sim bin/test.prg "$device" -t
    ;;
  run)
    need_device
    mc -o bin/gymtracker.prg -d "$device"
    sim bin/gymtracker.prg "$device"
    ;;
  prg)
    need_device
    mc -o "bin/gymtracker-$device.prg" -d "$device"
    echo "Gotowe: bin/gymtracker-$device.prg — skopiuj przez USB do GARMIN/APPS/ na zegarku."
    ;;
  store)
    mc -o bin/gymtracker.iq -e -r
    echo "Gotowe: bin/gymtracker.iq — wgraj w https://apps.garmin.com/developer/ (najpierw jako beta)."
    ;;
esac
