/**
 * A Workbox plugin (`cacheWillUpdate`) that keeps the copy without its `Date` header. For files that
 * never change under their name (the OSM leaves, named by a hash of their content): the expiration
 * then judges a copy by when it was LAST USED, which it keeps track of itself, never by when the
 * server sent it — without the header Workbox never calls a kept copy too old, and a cell visited
 * every few months still works offline.
 *
 * Goes after `CacheableResponsePlugin`, so only a `200` reaches it. No imports: the service worker and
 * a test both load it.
 */
export const withoutDateHeader = {
  cacheWillUpdate: async ({ response }: { response: Response }): Promise<Response> => {
    const headers = new Headers(response.headers);
    headers.delete('date');
    return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers });
  },
};
