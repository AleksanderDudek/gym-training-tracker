import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { importWorkbook } from '../../diet/store';

type Result = { kind: 'ok'; text: string; warnings: string[] } | { kind: 'error'; text: string };

/**
 * Czyta arkusz z planem W przeglądarce: plik nigdzie nie trafia i nie jest przechowywany jako
 * plik — zostaje tylko odczytany z niego plan, na tym urządzeniu. Wybór pliku wygląda jak przycisk
 * aplikacji (etykieta pola pliku), a samo pole jest ukryte tylko wzrokowo.
 */
export function ImportWorkbook({
  label = 'Wczytaj plan z Excela',
  primary = false,
}: {
  label?: string;
  primary?: boolean;
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
      setResult({
        kind: 'ok',
        text: `Wczytano „${imported.plan.name}”: ${imported.plan.days.length} dni, ${
          Object.keys(imported.plan.templates).length
        } dni wzorcowych, ${variants} wariantów${imported.days.length ? `, ${imported.days.length} dni z zapisami` : ''}.`,
        warnings: imported.profileApplied
          ? imported.warnings
          : [
              'Profil zostaje bez zmian – parametry z panelu arkusza wczytuję tylko przy pierwszym imporcie. Zmienisz je w „Profilu diety”.',
              ...imported.warnings,
            ],
      });
    } catch (error) {
      setResult({ kind: 'error', text: error instanceof Error ? error.message : 'Nie udało się odczytać pliku.' });
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
        <Upload size={20} strokeWidth={2} aria-hidden /> {busy ? 'Czytam…' : label}
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
