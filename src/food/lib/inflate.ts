import { gunzipSync } from 'fflate';

/**
 * Tekst z pobranych bajtów, które mogą być gzipem. Pliki leżą na serwerze jako gzip
 * (`data/products.<wersja>.json.gz`, kawałki danych OSM), ale serwer, który poda je z
 * `Content-Encoding: gzip`, oddaje już rozpakowany tekst — dlatego decyduje znacznik gzipa na
 * początku (`1f 8b`), a nie nazwa pliku czy nagłówki.
 */
export async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  // Starsze przeglądarki bez DecompressionStream (Safari < 16.4).
  return new TextDecoder().decode(gunzipSync(bytes));
}
