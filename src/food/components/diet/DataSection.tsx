import { Download, Trash2, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { Modal, useModal } from '../../../components/ui';
import { markDiet } from '../../dietFlag';
import { db } from '../../diet/db';
import { clearAll, exportAll, now, restoreAll } from '../../diet/store';
import { setFood } from '../../diet/foods';
import { useCustomFoods, useFavorites, useSets } from '../../hooks/useDiet';
import { formatNumber } from '../../lib/format';
import { text } from '../../../i18n';
import { DT } from './dietText';
import { ImportWorkbook } from './ImportWorkbook';

const ICON = { size: 20, strokeWidth: 2, 'aria-hidden': true } as const;

const T = text({
  pl: {
    restoreTitle: 'Przywrócić kopię?',
    restoreBody: 'Obecne dane diety na tym urządzeniu zostaną nią zastąpione.',
    restore: 'Przywróć',
    restored: 'Kopia przywrócona.',
    restoredDropped: (n: number) => `Kopia przywrócona. Pominięte nieczytelne wpisy: ${n}.`,
    notBackup: 'To nie jest plik kopii (JSON).',
    restoreFailed: 'Nie udało się przywrócić.',
    wipeTitle: 'Usunąć wszystkie dane diety?',
    wipeBody:
      'Profil diety, zapisy jedzenia, plan, moje jedzenie, zestawy i ulubione znikną z tego urządzenia. Tego nie da się cofnąć. Waga i kroki zostają w treningach.',
    wipe: 'Usuń wszystko',
    title: 'Twoje dane',
    lead: 'Profil, zapisy i plan są tylko w tej przeglądarce na tym urządzeniu – nic nie jest wysyłane. Wyczyszczenie danych przeglądarki je usunie, więc zrób kopię.',
    download: 'Pobierz kopię',
    restoreFrom: 'Przywróć z kopii',
    importPlan: 'Wczytaj plan z Excela',
    myFood: 'Moje jedzenie',
    myFoodEmpty: 'Nic jeszcze. Przy „Dodaj zjedzone → Tylko kalorie” zaznacz „Zapisz jako moje jedzenie”.',
    remove: (name: string) => `Usuń: ${name}`,
    favoritesEmpty: 'Nic jeszcze. Gwiazdką przy jedzeniu dodasz je do listy szybkiego wyboru w dzienniku.',
    uses: (n: number) => ` · zjedzone ${n}×`,
    removeFavorite: (name: string) => `Usuń z ulubionych: ${name}`,
    mySets: 'Moje zestawy',
    setsEmpty:
      'Nic jeszcze. W „Dodaj zjedzone → Zestaw” złóż kilka rzeczy jedzonych razem (np. banan i baton) i zostaw zaznaczone „Zapisz jako mój zestaw”.',
    removeSet: (name: string) => `Usuń zestaw: ${name}`,
    wipeAll: 'Usuń wszystkie dane diety',
  },
  en: {
    restoreTitle: 'Restore the backup?',
    restoreBody: 'It will replace the diet data on this device.',
    restore: 'Restore',
    restored: 'Backup restored.',
    restoredDropped: (n: number) => `Backup restored. Unreadable entries skipped: ${n}.`,
    notBackup: 'This isn’t a backup file (JSON).',
    restoreFailed: 'Couldn’t restore.',
    wipeTitle: 'Delete all diet data?',
    wipeBody:
      'The diet profile, food logs, plan, my food, sets and favourites will disappear from this device. This can’t be undone. Weight and steps stay in training.',
    wipe: 'Delete everything',
    title: 'Your data',
    lead: 'The profile, logs and plan live only in this browser on this device – nothing is sent anywhere. Clearing the browser’s data deletes them, so make a backup.',
    download: 'Download backup',
    restoreFrom: 'Restore from backup',
    importPlan: 'Import plan from Excel',
    myFood: 'My food',
    myFoodEmpty: 'Nothing yet. In “Add food → Calories only”, tick “Save as my food”.',
    remove: (name: string) => `Delete: ${name}`,
    favoritesEmpty: 'Nothing yet. Star a food to add it to the diary’s quick picks.',
    uses: (n: number) => ` · eaten ${n}×`,
    removeFavorite: (name: string) => `Remove from favourites: ${name}`,
    mySets: 'My sets',
    setsEmpty:
      'Nothing yet. In “Add food → Set”, put together a few things you eat together (e.g. a banana and a bar) and leave “Save as my set” ticked.',
    removeSet: (name: string) => `Delete set: ${name}`,
    wipeAll: 'Delete all diet data',
  },
});

/**
 * Kopia, przywracanie, własne jedzenie i zestawy oraz wyczyszczenie wszystkiego — dane diety są tylko tutaj.
 * Waga, wzrost i kroki należą do treningów, więc ich kopia idzie z kopią treningów (Ustawienia).
 */
export function DataSection() {
  const restoreId = useId();
  const custom = useCustomFoods();
  const sets = useSets();
  const favorites = useFavorites();
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
      const ok = await ask(T.restoreTitle, <p>{T.restoreBody}</p>, T.restore);
      if (!ok) return;
      const { dropped } = await restoreAll(JSON.parse(await file.text()));
      // Kopia bez profilu to dziennik bez celu — karta na ekranie Dziś nie miałaby czego pokazać.
      markDiet((await db.profile.count()) > 0);
      setMessage({
        ok: true,
        text: dropped ? T.restoredDropped(dropped) : T.restored,
      });
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof SyntaxError
            ? T.notBackup
            : error instanceof Error
              ? error.message
              : T.restoreFailed,
      });
    }
  };

  const wipe = async () => {
    const ok = await ask(T.wipeTitle, <p>{T.wipeBody}</p>, T.wipe);
    if (!ok) return;
    await clearAll();
    markDiet(false);
  };

  return (
    <section className="grp fd-diet-data" aria-labelledby="fd-diet-data-title">
      <h2 id="fd-diet-data-title">{T.title}</h2>
      <p>{T.lead}</p>

      <div className="fd-diet-acts">
        <button type="button" className="btn ghost sm" onClick={() => void download()}>
          <Download {...ICON} /> {T.download}
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
          <Upload {...ICON} /> {T.restoreFrom}
        </label>
        <ImportWorkbook label={T.importPlan} />
      </div>
      {message && (
        <p role="status" className={`tight${message.ok ? ' fd-diet-ok' : ' fd-diet-warn'}`}>
          {message.text}
        </p>
      )}

      <h3>{T.myFood}</h3>
      {!custom?.length ? (
        <p className="tight">{T.myFoodEmpty}</p>
      ) : (
        <ul className="fd-diet-list">
          {custom.map((f) => (
            <li key={f.id} className="fd-diet-custom">
              <span>
                {f.name} <span className="fd-diet-meta fd-diet-nums">· {formatNumber(f.kcal, 0)} kcal</span>
              </span>
              <button
                type="button"
                className="fd-diet-icon-btn"
                onClick={() => void db.foods.delete(f.id)}
                aria-label={T.remove(f.name)}
              >
                <Trash2 {...ICON} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>{DT.favorites}</h3>
      {!favorites?.length ? (
        <p className="tight">{T.favoritesEmpty}</p>
      ) : (
        <ul className="fd-diet-list">
          {favorites.map((f) => (
            <li key={f.key} className="fd-diet-custom">
              <span>
                {f.food.name}{' '}
                <span className="fd-diet-meta fd-diet-nums">
                  · {formatNumber(f.food.nutrients.kcal, 0)} kcal · {f.food.amountLabel}
                  {f.uses > 0 && T.uses(f.uses)}
                </span>
              </span>
              <button
                type="button"
                className="fd-diet-icon-btn"
                onClick={() => void db.favorites.delete(f.key)}
                aria-label={T.removeFavorite(f.food.name)}
              >
                <Trash2 {...ICON} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>{T.mySets}</h3>
      {!sets?.length ? (
        <p className="tight">{T.setsEmpty}</p>
      ) : (
        <ul className="fd-diet-list">
          {sets.map((s) => {
            const food = setFood(s);
            return (
              <li key={s.id} className="fd-diet-custom">
                <span>
                  {s.name}{' '}
                  <span className="fd-diet-meta fd-diet-nums">
                    · {formatNumber(food.nutrients.kcal, 0)} kcal · {food.amountLabel}
                  </span>
                </span>
                <button
                  type="button"
                  className="fd-diet-icon-btn"
                  onClick={() => void db.sets.delete(s.id)}
                  aria-label={T.removeSet(s.name)}
                >
                  <Trash2 {...ICON} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="btn ghost sm fd-diet-danger" onClick={() => void wipe()}>
        <Trash2 {...ICON} /> {T.wipeAll}
      </button>
      <Modal req={req} />
    </section>
  );
}
