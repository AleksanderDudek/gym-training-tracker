import { cron, handle } from './api';
import type { Env as ApiEnv } from './api';
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
  // Przypomnienia, potem zaplanowane od prowadzącego, potem skrzynki zegarków — po kolei, każde osobno
  // (`cron` w `api.ts`). Dziennik: `{"reminders":{…},"coach":{…},"boxes":n}`, część z błędem — `{"error":…}`.
  scheduled: (_event: unknown, env: Env, ctx: ExecutionContext): void => {
    ctx.waitUntil(cron(d1Store(env.DB), env, new Date()).then((r) => console.log(JSON.stringify(r))));
  },
};
