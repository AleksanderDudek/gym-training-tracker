// The developer reports read the app's modules, which pick their language when first imported. In
// Node `navigator.language` is the machine's (often en-US); the reports stay in Polish, as the data
// they check is Polish. Import this first, before any module of the app.
import type {} from '../../../src/i18n';

globalThis.__KB_LANG__ = 'pl';
