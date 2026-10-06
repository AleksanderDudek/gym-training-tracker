import { handle, tick } from './api';
import type { Env as ApiEnv } from './api';
import { d1Store } from './store';
import type { D1Database } from './store';

/**
 * Punkt wejścia Cloudflare Workera: zapytania aplikacji i cron co pięć minut.
 * Cała logika siedzi w `api.ts` — tu tylko podpięcie bazy D1.
 */

interface Env extends ApiEnv {
  DB: D1Database;
}

interface ExecutionContext {
  waitUntil(p: Promise<unknown>): void;
}

export default {
  fetch: (req: Request, env: Env): Promise<Response> => handle(req, env, d1Store(env.DB)),
  scheduled: (_event: unknown, env: Env, ctx: ExecutionContext): void => {
    ctx.waitUntil(tick(d1Store(env.DB), env, new Date()).then((r) => console.log(JSON.stringify(r))));
  },
};
