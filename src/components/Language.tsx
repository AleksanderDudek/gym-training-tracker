import { LANG, LANG_AUTO, LANG_NAMES, detectLang, setLang, text, type Lang } from '../i18n';
import { Segmented } from './ui';

const T = text({
  pl: {
    lead: 'Aplikacja mówi językiem przeglądarki, chyba że wybierzesz inny. Zmiana przeładuje stronę — nic się nie zgubi.',
    auto: 'Automatycznie',
    now: (name: string) => `Przeglądarka: ${name}.`,
  },
  en: {
    lead: 'The app speaks your browser’s language unless you pick another. Changing it reloads the page — nothing is lost.',
    auto: 'Automatic',
    now: (name: string) => `Browser: ${name}.`,
  },
});

type Choice = Lang | 'auto';

/**
 * Wybór języka. Nagłówek w obu językach naraz: ktoś, kogo przeglądarka wpuściła w nie ten język,
 * musi tę kartę znaleźć bez czytania reszty. Nazwy języków — w nich samych.
 */
export function LanguageCard() {
  const browser = detectLang(globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? '']);
  const value: Choice = LANG_AUTO ? 'auto' : LANG;
  return (
    <div className="grp">
      {/* i18n-ignore: nagłówek celowo w obu językach */}
      <h2>Język · Language</h2>
      <p className="tight">{T.lead}</p>
      <Segmented<Choice>
        // i18n-ignore: nazwa grupy celowo w obu językach
        label="Język · Language"
        options={[
          { key: 'auto', label: T.auto },
          { key: 'pl', label: LANG_NAMES.pl },
          { key: 'en', label: LANG_NAMES.en },
        ]}
        value={value}
        onChange={(v) => {
          if (v !== value) setLang(v === 'auto' ? null : v);
        }}
      />
      <p className="hint">{T.now(LANG_NAMES[browser])}</p>
    </div>
  );
}
