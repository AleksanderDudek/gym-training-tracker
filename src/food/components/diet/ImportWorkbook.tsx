import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { importWorkbook } from '../../diet/store';
import { pluralEn, text } from '../../../i18n';

const T = text({
  pl: {
    importPlan: 'Wczytaj plan z Excela',
    summary: (name: string, days: number, templates: number, variants: number, logged: number) =>
      `Wczytano „${name}”: ${days} dni, ${templates} dni wzorcowych, ${variants} wariantów${logged ? `, ${logged} dni z zapisami` : ''}.`,
    profileSet: 'Profil diety ustawiony z arkusza.',
    profileKept:
      'Profil zostaje bez zmian – parametry z panelu arkusza wczytuję tylko przy pierwszym imporcie. Zmienisz je w „Profilu diety”.',
    readFailed: 'Nie udało się odczytać pliku.',
    reading: 'Czytam…',
  },
  en: {
    importPlan: 'Import plan from Excel',
    summary: (name: string, days: number, templates: number, variants: number, logged: number) =>
      `Imported “${name}”: ${days} ${pluralEn(days, 'day', 'days')}, ${templates} template ${pluralEn(templates, 'day', 'days')}, ${variants} ${pluralEn(variants, 'option', 'options')}${logged ? `, ${logged} ${pluralEn(logged, 'day', 'days')} with logs` : ''}.`,
    profileSet: 'Diet profile set from the workbook.',
    profileKept:
      'Your profile stays as it is – I only read the workbook’s panel settings on the first import. You can change them in “Diet profile”.',
    readFailed: 'Couldn’t read the file.',
    reading: 'Reading…',
  },
});

type Result = { kind: 'ok'; text: string; warnings: string[] } | { kind: 'error'; text: string };

/**
 * Czyta arkusz z planem W przeglądarce: plik nigdzie nie trafia i nie jest przechowywany jako
 * plik — zostaje tylko odczytany z niego plan, na tym urządzeniu. Wybór pliku wygląda jak przycisk
 * aplikacji (etykieta pola pliku), a samo pole jest ukryte tylko wzrokowo.
 *
 * Z `onImported` wynik nie staje pod przyciskiem, tylko idzie do rodzica jednym zdaniem: pierwszy
 * import w profilu diety tworzy profil, formularz z tym przyciskiem znika, a rodzic przechodzi
 * do dziennika i mówi, co wczytano.
 */
export function ImportWorkbook({
  label = T.importPlan,
  primary = false,
  onImported,
}: {
  label?: string;
  primary?: boolean;
  onImported?: (summary: string) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const read = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      const imported = await importWorkbook(new Uint8Array(await file.arrayBuffer()));
      const variants = Object.values(imported.plan.templates).reduce((sum, v) => sum + v.length, 0);
      const text = T.summary(
        imported.plan.name,
        imported.plan.days.length,
        Object.keys(imported.plan.templates).length,
        variants,
        imported.days.length,
      );
      if (onImported) {
        onImported(imported.profileApplied ? `${text} ${T.profileSet}` : text);
        return;
      }
      setResult({
        kind: 'ok',
        text,
        warnings: imported.profileApplied ? imported.warnings : [T.profileKept, ...imported.warnings],
      });
    } catch (error) {
      setResult({ kind: 'error', text: error instanceof Error ? error.message : T.readFailed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fd-diet-import">
      {/* Pole przed etykietą: fokus z klawiatury rysuje obwódkę na przycisku (`input:focus-visible + label`). */}
      <input
        id={id}
        type="file"
        className="sr-only"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void read(file);
        }}
      />
      <label htmlFor={id} className={`btn sm${primary ? '' : ' ghost'}${busy ? ' fd-diet-busy' : ''}`}>
        <Upload size={20} strokeWidth={2} aria-hidden /> {busy ? T.reading : label}
      </label>
      {result && (
        <div role="status" className={`dnote ${result.kind === 'ok' ? 'good' : 'warn'}`}>
          <p className="tight">{result.text}</p>
          {result.kind === 'ok' && result.warnings.length > 0 && (
            <ul className="fd-diet-bullets">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
