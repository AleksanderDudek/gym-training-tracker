import { handle, tick } from './api';
import type { Env as ApiEnv } from './api';
import { BOX_TTL_MS } from './garmin';
import { d1Store } from './store';
import type { D1Database } from './store';

/**
 * Punkt wejścia Cloudflare Workera: zapytania aplikacji i zegarka oraz cron co pięć minut.
 * Cała logika siedzi w `api.ts` i `garmin.ts` — tu tylko podpięcie bazy D1.
 */

interface Env extends ApiEnv {
  DB: D1Database;
}

interface ExecutionContext {
  waitUntil(p: Promise<unknown>): void;
}

export default {
  // Kopia uwagi na Discorda wychodzi po odpowiedzi: `waitUntil` trzyma Workera, aż wyśle.
  fetch: (req: Request, env: Env, ctx: ExecutionContext): Promise<Response> =>
    handle(req, env, d1Store(env.DB), Date.now(), (p) => ctx.waitUntil(p)),
  scheduled: (_event: unknown, env: Env, ctx: ExecutionContext): void => {
    const store = d1Store(env.DB);
    // Ten sam przebieg sprząta skrzynki zegarków, które od tygodnia milczą.
    ctx.waitUntil(
      Promise.all([tick(store, env, new Date()), store.pruneBoxes(Date.now() - BOX_TTL_MS)]).then(([r, boxes]) =>
        console.log(JSON.stringify({ ...r, boxes })),
      ),
    );
  },
};
