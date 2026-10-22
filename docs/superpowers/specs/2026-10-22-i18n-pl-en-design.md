# Polish and English, detected automatically, switchable in Settings — design

Date: 2026-10-22 · Status: decided autonomously on request ("I want the app in multiple languages
detected automatically BUT user can reselect language from settings. For now Polish and English
languages are supported. Analyze current system. Use best practices. Pick recommended. I am away
from machine. Plan it out and then finish on your own").

## What exists (analysis)

- Every text is Polish and inline: ~4 000 user-visible literals (scanner below) across 114 TSX
  and 164 TS files — screens, the engine (coach quips, design advice, badges, reminders), the
  exercise library and plans (`src/data`), the food area, the recipe catalogue.
- `'pl-PL'` is hard-coded in 24 files for numbers and dates; Polish plural helpers live in
  `engine/quips.ts` and `food/lib/format.ts`.
- Some Polish strings are also **keys**: exercise groups used in energy logic, meal slots stored in
  the diet DB, Polish Excel workbook headers, product/store names matched against Polish product
  data, hash routes (`#/ustawienia`).
- The watch app is already localised (English + Polish) on its own; the phone companion is named
  „GYM TRACKER Zdrowie”. Push reminder texts are composed in the browser.
- Tests assert exact Polish strings (≈1 950 tests).

## Decisions

| Topic | Decision | Why |
| --- | --- | --- |
| Library | None: typed bilingual catalogs `text({ pl, en })` in `src/i18n.ts`, the English half typed by the Polish one (`NoInfer`) | A missing or extra key, or a different function signature, does not compile — completeness checked by `tsc`, no runtime dependency, works in engine modules; interpolation and plurals are plain functions |
| Where texts live | Next to the code that uses them (top of the file, or a sibling `*.text.tsx` when big); data uses `say(pl, en)` inside the data | Co-located strings are reviewed with the code; lazy food chunks keep their own texts; data keeps its `string` type |
| Detection | Saved choice → first supported of `navigator.languages` → English | Standard order; a non-Polish browser reads English more easily than Polish |
| Switching | Settings, top: „Język · Language” (bilingual heading, language names in themselves), Automatic / Polski / English; a change saves `localStorage['kb-lang']` and reloads | Findable by someone stuck in the wrong language; a fixed language per visit lets module-level constants and the engine hold translated text; state is already persisted, nothing is lost |
| Per device, not in the backup | The choice lives in localStorage, not in `AppState` | A backup imported on another person's device must not switch their language |
| Locale | `LOCALE` = `pl-PL` or `en-GB` for every `Intl`/`toLocaleString` | en-GB: metric, day–month, weeks from Monday — like the app |
| Plurals | Polish halves keep the existing three-form helpers; English uses `pluralEn` | Both correct, no new abstraction |
| Keys stay Polish | Stored values, keys, routes, Excel headers, product/store/chain names and restaurant menu items stay; labels are translated | Translating a key corrupts data or matching |
| Kept in Polish | Product names, brands, restaurant menu items, store names (Polish market data); „GYM TRACKER Zdrowie” | It is the data people see on the shelf and in the app store |
| `<html lang>`, meta description | Set at boot from the language | Screen readers, hyphenation, the browser's own translator |
| Manifest | Stays one (Polish description) | A web manifest cannot follow a per-user choice |
| Tests | The suite runs in Polish (`src/test/setup.ts` sets `__KB_LANG__`); each area adds an English smoke test (`vi.hoisted` sets English before imports) | Existing tests stay valid unchanged; English is checked where it is rendered |
| Completeness check | `scripts/i18n-scan.mjs` (TypeScript AST): Polish text outside catalogs, `// i18n-ignore: reason` for data | Measurable; found ~4 060 texts before the work |
| Style | British English, short, friendly, second person; a glossary in `docs/i18n.md` | Eight parallel translators need one vocabulary |
| Work split | Eight parallel agents on disjoint files: shell & settings & devices; training screens; cardio, body & badges; engine coaching texts; exercise & plan data; food diary & diet; recipe catalogue; other food screens | ~4 000 texts; disjoint files merge without conflicts |
