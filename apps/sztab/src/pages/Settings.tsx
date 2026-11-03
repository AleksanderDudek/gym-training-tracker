import { useRef, useState } from 'react';
import { PROFESSIONS, formatPseudonym } from '@gymtracker/link';
import type { Profession } from '@gymtracker/link';
import { LANG, LANGS, LANG_NAMES, LOCALE, setLang, text } from '@gt/i18n';
import { toast } from '../components/ui';
import { crmCsv, importAliases, loadAliases } from '../lib/aliases';
import { deleteAccount, listConnections, updateCoach } from '../lib/data';
import { L } from '../lib/labels';
import { sb } from '../lib/sb';
import { forgetDeviceKey, rekey } from '../lib/vault';
import { useReady } from '../session';
import { RecoveryCode } from './Vault';

const T = text({
  pl: {
    title: 'Ustawienia',
    profile: 'Profil',
    profileLead: 'Tak widzi cię podopieczny w zaproszeniu i przy każdym zaleceniu.',
    name: 'Imię i nazwisko albo nazwa gabinetu',
    profession: 'Zawód',
    bio: 'Krótko o sobie',
    save: 'Zapisz',
    saved: 'Zapisano',
    vault: 'Sejf',
    vaultLead: 'Klucz, którym odszyfrowujesz dane podopiecznych. Na tym komputerze jest otwarty.',
    fp: 'Odcisk klucza (ten sam jest w każdym linku zaproszenia)',
    rekey: 'Nowy kod odzyskiwania',
    rekeyLead: 'Wpisz obecny kod. Dostaniesz nowy, a stary przestanie działać.',
    oldCode: 'Obecny kod',
    make: 'Utwórz nowy kod',
    badCode: 'Ten kod nie otwiera sejfu.',
    newCode: 'Nowy kod — zapisz go teraz:',
    forget: 'Zamknij sejf na tym komputerze',
    forgetLead: 'Na komputerze, z którego korzysta ktoś jeszcze. Przy następnym logowaniu potrzebny będzie kod.',
    account: 'Konto',
    email: 'E-mail',
    pw: 'Nowe hasło',
    pwSave: 'Zmień hasło',
    pwShort: 'Hasło musi mieć co najmniej 10 znaków.',
    pwDone: 'Hasło zmienione',
    everywhere: 'Wyloguj ze wszystkich urządzeń',
    lang: 'Język',
    aliases: 'Skróty i rejestr podopiecznych',
    aliasesLead: 'Skróty żyją tylko w tej przeglądarce. Przenieś je plikiem albo wyślij listę numerów do swojego CRM.',
    exportJson: 'Pobierz skróty (plik)',
    importJson: 'Wczytaj skróty z pliku',
    imported: (n: number) => `Wczytano ${n}`,
    exportCsv: 'Lista numerów do CRM (CSV)',
    danger: 'Usunięcie konta',
    dangerLead: 'Znikają: profil, biblioteka, zaproszenia i wszystkie współprace — podopieczni zobaczą, że zakończyłeś współpracę. Tego nie da się cofnąć.',
    typeIt: 'Wpisz USUŃ, żeby potwierdzić',
    word: 'USUŃ',
    deleteIt: 'Usuń konto na zawsze',
    active: 'trwa',
    ended: 'zakończona',
  },
  en: {
    title: 'Settings',
    profile: 'Profile',
    profileLead: 'This is how the client sees you in the invite and on every piece of advice.',
    name: 'Full name or practice name',
    profession: 'Profession',
    bio: 'A line about you',
    save: 'Save',
    saved: 'Saved',
    vault: 'Vault',
    vaultLead: 'The key that decrypts your clients’ data. It is unlocked on this computer.',
    fp: 'Key fingerprint (the same one is in every invite link)',
    rekey: 'New recovery code',
    rekeyLead: 'Enter the current code. You get a new one and the old one stops working.',
    oldCode: 'Current code',
    make: 'Create new code',
    badCode: 'This code does not open the vault.',
    newCode: 'New code — save it now:',
    forget: 'Lock the vault on this computer',
    forgetLead: 'On a computer someone else uses too. Next sign-in will need the code.',
    account: 'Account',
    email: 'Email',
    pw: 'New password',
    pwSave: 'Change password',
    pwShort: 'The password needs at least 10 characters.',
    pwDone: 'Password changed',
    everywhere: 'Sign out on all devices',
    lang: 'Language',
    aliases: 'Aliases and client records',
    aliasesLead: 'Aliases live in this browser only. Move them with a file or send the number list to your CRM.',
    exportJson: 'Download aliases (file)',
    importJson: 'Load aliases from a file',
    imported: (n: number) => `Loaded ${n}`,
    exportCsv: 'Number list for CRM (CSV)',
    danger: 'Delete account',
    dangerLead: 'Removes your profile, library, invites and every collaboration — clients will see you ended it. This cannot be undone.',
    typeIt: 'Type DELETE to confirm',
    word: 'DELETE',
    deleteIt: 'Delete account forever',
    active: 'active',
    ended: 'ended',
  },
});

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Settings() {
  const { coach, user, refresh, signOut } = useReady();
  const [name, setName] = useState(coach.display_name);
  const [profession, setProfession] = useState<Profession>(coach.profession);
  const [bio, setBio] = useState(coach.bio ?? '');
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const saveProfile = async () => {
    await updateCoach(coach.id, { display_name: name.trim(), profession, bio: bio.trim() || null });
    toast(T.saved);
    await refresh();
  };

  const makeCode = async () => {
    setCodeErr(null);
    const r = await rekey(user.id, coach.sealed_key, oldCode).catch(() => null);
    if (!r) return setCodeErr(T.badCode);
    await updateCoach(coach.id, { sealed_key: r.sealed });
    setNewCode(r.code);
    setOldCode('');
    await refresh();
  };

  const changePw = async () => {
    setPwErr(null);
    if (pw.length < 10) return setPwErr(T.pwShort);
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) return setPwErr(error.message);
    setPw('');
    toast(T.pwDone);
  };

  const exportCsv = async () => {
    const aliases = loadAliases(user.id);
    const rows = (await listConnections()).map((c) => ({
      pseudonym: formatPseudonym(c.pseudonym),
      alias: aliases[c.pseudonym] ?? '',
      areas: c.areas.map((a) => L.area[a]).join(', '),
      since: new Date(c.createdAt).toLocaleDateString(LOCALE),
      status: c.status === 'active' ? T.active : T.ended,
    }));
    download('sztab-podopieczni.csv', crmCsv(rows), 'text/csv;charset=utf-8');
  };

  return (
    <>
      <div className="page-head">
        <h1>{T.title}</h1>
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <h2>{T.profile}</h2>
          <p className="soft small">{T.profileLead}</p>
          <label className="field">
            <span>{T.name}</span>
            <input id="s-name" type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>{T.profession}</span>
            <select id="s-prof" value={profession} onChange={(e) => setProfession(e.target.value as Profession)}>
              {PROFESSIONS.map((p) => (
                <option key={p} value={p}>
                  {L.profession[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{T.bio}</span>
            <textarea id="s-bio" maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
          </label>
          <button type="button" className="btn" disabled={name.trim().length < 2} onClick={() => void saveProfile()}>
            {T.save}
          </button>
        </section>

        <section className="card">
          <h2>{T.vault}</h2>
          <p className="soft small">{T.vaultLead}</p>
          <div className="field">
            <span>{T.fp}</span>
            <code className="mono small">{coach.key_fingerprint}</code>
          </div>
          <h3>{T.rekey}</h3>
          <p className="small soft">{T.rekeyLead}</p>
          {newCode ? (
            <div className="stack">
              <p className="okmsg">{T.newCode}</p>
              <RecoveryCode code={newCode} email={user.email ?? ''} />
            </div>
          ) : (
            <>
              <label className="field">
                <span>{T.oldCode}</span>
                <input id="s-old" type="text" autoComplete="off" className="mono" value={oldCode} onChange={(e) => setOldCode(e.target.value)} />
              </label>
              {codeErr ? <p className="err" role="alert">{codeErr}</p> : null}
              <button type="button" className="btn ghost" onClick={() => void makeCode()}>
                {T.make}
              </button>
            </>
          )}
          <h3>{T.forget}</h3>
          <p className="small soft">{T.forgetLead}</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              void forgetDeviceKey(user.id).then(async () => {
                await signOut();
              })
            }
          >
            {T.forget}
          </button>
        </section>

        <section className="card">
          <h2>{T.account}</h2>
          <div className="field">
            <span>{T.email}</span>
            <span>{user.email}</span>
          </div>
          <label className="field">
            <span>{T.pw}</span>
            <input id="s-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          {pwErr ? <p className="err" role="alert">{pwErr}</p> : null}
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => void changePw()}>
              {T.pwSave}
            </button>
            <button type="button" className="btn ghost" onClick={() => void sb.auth.signOut({ scope: 'global' }).then(signOut)}>
              {T.everywhere}
            </button>
          </div>
          <label className="field">
            <span>{T.lang}</span>
            <select id="s-lang" value={LANG} onChange={(e) => setLang(e.target.value as typeof LANG)}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {LANG_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="card">
          <h2>{T.aliases}</h2>
          <p className="soft small">{T.aliasesLead}</p>
          <div className="row">
            <button type="button" className="btn ghost small" onClick={() => void exportCsv()}>
              {T.exportCsv}
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => download('sztab-skroty.json', JSON.stringify(loadAliases(user.id), null, 2), 'application/json')}
            >
              {T.exportJson}
            </button>
            <button type="button" className="btn ghost small" onClick={() => file.current?.click()}>
              {T.importJson}
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void f.text().then((t) => {
                  try {
                    toast(T.imported(importAliases(user.id, JSON.parse(t))));
                  } catch {
                    toast(T.imported(0));
                  }
                });
              }}
            />
          </div>
        </section>
      </div>

      <section className="card" style={{ borderColor: 'var(--bad)' }}>
        <h2>{T.danger}</h2>
        <p className="small">{T.dangerLead}</p>
        <div className="row">
          <label className="field" style={{ maxWidth: 260 }}>
            <span className="small">{T.typeIt}</span>
            <input id="s-del" type="text" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn danger"
            style={{ alignSelf: 'end' }}
            disabled={confirm.trim() !== T.word}
            onClick={() =>
              void deleteAccount().then(async () => {
                await forgetDeviceKey(user.id);
                await signOut();
              })
            }
          >
            {T.deleteIt}
          </button>
        </div>
      </section>
    </>
  );
}
