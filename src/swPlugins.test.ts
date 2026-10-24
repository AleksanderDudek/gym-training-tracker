import { describe, expect, it } from 'vitest';
import { withoutDateHeader } from './swPlugins';
// The service worker as text (`?raw`): the leaves' route must keep its copies without the date.
import swSource from './sw.ts?raw';

describe('a copy without its Date header', () => {
  it('loses the date only: status, status text, the other headers and the body stay as they came', async () => {
    const body = new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 3, 250, 1]);
    const response = new Response(body, {
      status: 203,
      statusText: 'Non-Authoritative Information',
      headers: {
        Date: 'Fri, 24 Oct 2026 01:00:00 GMT',
        'Content-Type': 'application/gzip',
        ETag: '"5e67253ddd"',
        'Cache-Control': 'max-age=600',
      },
    });
    const kept = await withoutDateHeader.cacheWillUpdate({ response });
    expect(kept.headers.has('date')).toBe(false);
    expect(kept.status).toBe(203);
    expect(kept.statusText).toBe('Non-Authoritative Information');
    expect(Object.fromEntries(kept.headers)).toEqual({
      'content-type': 'application/gzip',
      etag: '"5e67253ddd"',
      'cache-control': 'max-age=600',
    });
    expect(new Uint8Array(await kept.arrayBuffer())).toEqual(body);
  });

  it('is what the service worker’s route for the OSM leaves uses', () => {
    const start = swSource.indexOf("cacheName: 'gt-osm',");
    const end = swSource.indexOf("cacheName: 'gt-osm-index',");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(swSource.slice(start, end)).toMatch(/\bwithoutDateHeader\b/);
    expect(swSource).toContain("import { withoutDateHeader } from './swPlugins';");
  });
});
