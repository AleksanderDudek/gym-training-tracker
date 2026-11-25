import { handle, tick } from './api';
import type { Env as ApiEnv } from './api';
import { BOX_TTL_MS } from './garmin';
import { linkTick } from './link';
import { d1Store } from './store';
import type { D1Database } from './store';

/**
 * Punkt wejścia Cloudflare Workera: zapytania aplikacji, zegarka i Sztabu oraz cron co pięć minut.
 * Cała logika siedzi w `api.ts`, `garmin.ts` i `link.ts` — tu tylko podpięcie bazy D1.
 */

interface Env extends ApiEnv {
  DB: D1Database;
}

interface ExecutionContext {
  waitUntil(p: Promise<unknown>): void;
}

export default {
  // Kopia uwagi na Discorda i powiadomienie od prowadzącego wychodzą po odpowiedzi: `waitUntil`
  // trzyma Workera, aż wyśle.
  fetch: (req: Request, env: Env, ctx: ExecutionContext): Promise<Response> =>
    handle(req, env, d1Store(env.DB), Date.now(), (p) => ctx.waitUntil(p)),
  scheduled: (_event: unknown, env: Env, ctx: ExecutionContext): void => {
    const store = d1Store(env.DB);
    const now = new Date();
    // Przypomnienia, zaplanowane od prowadzącego, a przy okazji skrzynki zegarków, które od tygodnia milczą.
    ctx.waitUntil(
      Promise.all([tick(store, env, now), linkTick(store, env, now), store.pruneBoxes(now.getTime() - BOX_TTL_MS)]).then(
        ([r, coach, boxes]) => console.log(JSON.stringify({ ...r, coach, boxes })),
      ),
    );
  },
};
