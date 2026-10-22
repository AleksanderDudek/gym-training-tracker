/**
 * `src/i18n.ts` reloads the page through the global `location`. The diet modules are also compiled
 * for the Node scripts (`tsconfig.node.json`, no DOM types), which reach `i18n.ts` through them, so
 * that program gets the one member it uses from here. In the browser programs this merges with the
 * DOM's own, identical declaration. Types only — nothing of it is bundled. Remove once `i18n.ts`
 * no longer needs the DOM global.
 */
declare global {
  interface Location {
    reload(): void;
  }
  var location: Location;
}

export {};
