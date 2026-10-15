// Outside services the app reaches (product photos, map tiles, the shop search, YouTube thumbnails)
// answer from a disk cache: fetched for real once, then every take sees the same picture at once —
// no slow tile, no rate-limited Overpass in the middle of a video.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserContext } from 'playwright';

export const CACHE_DIR = 'node_modules/.cache/demo-videos';

const HOSTS =
  /^https:\/\/(images\.openfoodfacts\.org|([a-c]\.)?tile\.openstreetmap\.org|overpass-api\.de|overpass\.private\.coffee|i\.ytimg\.com)\//;

interface Meta {
  status: number;
  headers: Record<string, string>;
}

export async function cacheOutsideRequests(context: BrowserContext): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await context.route(HOSTS, async (route) => {
    const request = route.request();
    const key = createHash('sha1')
      .update(`${request.method()} ${request.url()} ${request.postData() ?? ''}`)
      .digest('hex');
    const file = join(CACHE_DIR, key);
    try {
      const meta = JSON.parse(await readFile(`${file}.json`, 'utf8')) as Meta;
      await route.fulfill({ status: meta.status, headers: meta.headers, body: await readFile(`${file}.bin`) });
      return;
    } catch {
      // not cached yet
    }
    // A route handler that throws takes the whole recorder down (Playwright rethrows it where
    // nothing catches it): a server that does not answer is a failed request, not a crash.
    try {
      const response = await route.fetch({ timeout: 60_000 });
      const body = await response.body();
      if (response.ok()) {
        const headers = response.headers();
        await writeFile(`${file}.bin`, body);
        await writeFile(`${file}.json`, JSON.stringify({ status: response.status(), headers } satisfies Meta));
      }
      await route.fulfill({ response, body });
    } catch {
      await route.abort('failed').catch(() => {});
    }
  });
}
