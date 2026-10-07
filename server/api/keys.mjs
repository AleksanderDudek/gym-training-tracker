/**
 * Klucze VAPID dla serwera przypomnień.
 *
 * Klucz prywatny trafia do pliku `vapid-private.jwk.json` (poza gitem) i stamtąd do sekretów
 * Workera; na ekran nie wychodzi. Publiczny wpisuje się sam do `wrangler.toml` i jest
 * wypisany — ten sam trzeba podać aplikacji jako zmienną `VAPID_PUBLIC_KEY` w GitHubie.
 *
 *   node keys.mjs
 *   npx wrangler secret put VAPID_PRIVATE_JWK < vapid-private.jwk.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('./vapid-private.jwk.json', import.meta.url);
const TOML = new URL('./wrangler.toml', import.meta.url);

if (existsSync(OUT)) {
  console.error('vapid-private.jwk.json już istnieje — nowe klucze odcięłyby wszystkie subskrypcje. Usuń plik świadomie, jeśli trzeba.');
  process.exit(1);
}

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
const pub = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');

writeFileSync(OUT, JSON.stringify(jwk), { mode: 0o600 });
writeFileSync(TOML, readFileSync(TOML, 'utf8').replace(/^VAPID_PUBLIC_KEY = ".*"$/m, `VAPID_PUBLIC_KEY = "${pub}"`));

console.log('Klucz publiczny VAPID (wpisany do wrangler.toml; ustaw go też w GitHubie jako zmienną VAPID_PUBLIC_KEY):');
console.log(pub);
console.log('Klucz prywatny zapisany w vapid-private.jwk.json — dalej: npx wrangler secret put VAPID_PRIVATE_JWK < vapid-private.jwk.json');
