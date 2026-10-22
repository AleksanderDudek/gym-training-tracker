// The language helpers of `src/i18n.ts` for the food modules the data scripts also read
// (`scripts/food/check-prep.ts` imports the planner, which imports the formatting): the scripts are
// type-checked by `tsconfig.node.json`, which has no DOM, and `src/i18n.ts` calls
// `location.reload()`. The declaration below is the one `lib.dom` already has, so the browser
// build sees nothing new; under node it lets the shared module compile. At run time a script gets
// the language of its environment (`navigator.languages` in node: English).
export { LANG, LOCALE, num, pluralEn, say, text } from '../../i18n';

declare global {
  interface Location {
    reload(): void;
  }
  var location: Location;
}
