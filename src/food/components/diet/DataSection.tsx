import { Download, Trash2, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { Modal, useModal } from '../../../components/ui';
import { markDiet } from '../../dietFlag';
import { db } from '../../diet/db';
import { clearAll, exportAll, now, restoreAll } from '../../diet/store';
import { useCustomFoods } from '../../hooks/useDiet';
import { formatNumber } from '../../lib/format';
import { ImportWorkbook } from './ImportWorkbook';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

/**
 * Kopia, przywracanie, własne jedzenie i wyczyszczenie wszystkiego — dane diety są tylko tutaj.
 * Waga, wzrost i kroki należą do treningów, więc ich kopia idzie z kopią treningów (Ustawienia).
 */
export function DataSection() {
  const restoreId = useId();
  const custom = useCustomFoods();
  const { req, ask } = useModal();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const download = async () => {
    const backup = await exportAll();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `dieta-kopia-${now().date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restore = async (file: File) => {
    try {
      const ok = await ask(
        'Przywrócić kopię?',
        <p>Obecne dane diety na tym urządzeniu zostaną nią zastąpione.</p>,
        'Przywróć',
      );
      if (!ok) return;
      const { dropped } = await restoreAll(JSON.parse(await file.text()));
      // Kopia bez profilu to dziennik bez celu — karta na ekranie Dziś nie miałaby czego pokazać.
      markDiet((await db.profile.count()) > 0);
      setMessage({
        ok: true,
        text: dropped ? `Kopia przywrócona. Pominięte nieczytelne wpisy: ${dropped}.` : 'Kopia przywrócona.',
      });
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof SyntaxError
            ? 'To nie jest plik kopii (JSON).'
            : error instanceof Error
              ? error.message
              : 'Nie udało się przywrócić.',
      });
    }
  };

  const wipe = async () => {
    const ok = await ask(
      'Usunąć wszystkie dane diety?',
      <p>
        Profil diety, zapisy jedzenia, plan i moje jedzenie znikną z tego urządzenia. Tego nie da się cofnąć. Waga i
        kroki zostają w treningach.
      </p>,
      'Usuń wszystko',
    );
    if (!ok) return;
    await clearAll();
    markDiet(false);
  };

  return (
    <section className="grp fd-data" aria-labelledby="fd-data-title">
      <h2 id="fd-data-title">Twoje dane</h2>
      <p>
        Profil, zapisy i plan są tylko w tej przeglądarce na tym urządzeniu – nic nie jest wysyłane. Wyczyszczenie
        danych przeglądarki je usunie, więc zrób kopię.
      </p>

      <div className="fd-acts">
        <button type="button" className="btn ghost sm" onClick={() => void download()}>
          <Download {...ICON} /> Pobierz kopię
        </button>
        <input
          id={restoreId}
          type="file"
          className="sr-only"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void restore(file);
          }}
        />
        <label htmlFor={restoreId} className="btn ghost sm">
          <Upload {...ICON} /> Przywróć z kopii
        </label>
        <ImportWorkbook label="Wczytaj plan z Excela" />
      </div>
      {message && (
        <p role="status" className={`tight${message.ok ? ' fd-ok' : ' fd-warn'}`}>
          {message.text}
        </p>
      )}

      <h3>Moje jedzenie</h3>
      {!custom?.length ? (
        <p className="tight">Nic jeszcze. Przy „Dodaj zjedzone → Tylko kalorie” zaznacz „Zapisz jako moje jedzenie”.</p>
      ) : (
        <ul className="fd-list">
          {custom.map((f) => (
            <li key={f.id} className="fd-custom">
              <span>
                {f.name} <span className="fd-meta fd-nums">· {formatNumber(f.kcal, 0)} kcal</span>
              </span>
              <button
                type="button"
                className="fd-icon-btn"
                onClick={() => void db.foods.delete(f.id)}
                aria-label={`Usuń: ${f.name}`}
              >
                <Trash2 {...ICON} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn ghost sm fd-danger" onClick={() => void wipe()}>
        <Trash2 {...ICON} /> Usuń wszystkie dane diety
      </button>
      <Modal req={req} />
    </section>
  );
}
