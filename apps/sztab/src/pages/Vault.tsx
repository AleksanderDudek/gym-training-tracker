import { useEffect, useState } from 'react';
import { PROFESSIONS, normalizeRecoveryCode } from '@gymtracker/link';
import type { Profession } from '@gymtracker/link';
import { text } from '@gt/i18n';
import { insertCoach } from '../lib/data';
import { L } from '../lib/labels';
import { useSession } from '../session';
import { commitVault, draftVault, recoveryFile, unlock } from '../lib/vault';
import type { VaultDraft } from '../lib/vault';
import { AuthFrame } from './Auth';
import { navigate } from '../lib/router';

/**
 * Pierwsze kroki: profil, który zobaczy podopieczny w zaproszeniu, i sejf. Kod odzyskiwania
 * pokazuje się raz; konto powstaje dopiero, gdy prowadzący przepisze jego ostatnią grupę —
 * kod, którego nikt nie zapisał, to sejf, którego nie da się otworzyć na drugim komputerze.
 */

const T = text({
  pl: {
    profileTitle: 'Twój profil',
    profileLead: 'To zobaczy podopieczny w zaproszeniu. Twojego maila nie zobaczy.',
    name: 'Imię i nazwisko albo nazwa gabinetu',
    profession: 'Zawód',
    bio: 'Krótko o sobie (opcjonalnie)',
    next: 'Dalej',
    vaultTitle: 'Kod odzyskiwania',
    vaultLead:
      'Dane podopiecznych są zaszyfrowane kluczem, który zna tylko twoja przeglądarka. Ten kod otwiera go na nowym komputerze. Nie przechowujemy go i nie odzyskamy.',
    copy: 'Kopiuj',
    copied: 'Skopiowano',
    download: 'Pobierz jako plik',
    confirm: (g: string) => `Przepisz ostatnią grupę kodu (${g.replace(/./g, '•')})`,
    finish: 'Zapisałem kod — dalej',
    wrong: 'To nie jest ostatnia grupa kodu.',
    making: 'Tworzę klucze…',
    failed: 'Nie udało się zapisać profilu. Spróbuj ponownie.',
    unlockTitle: 'Otwórz sejf na tym komputerze',
    unlockLead: 'Na tym komputerze nie ma jeszcze twojego klucza. Wpisz kod odzyskiwania z pierwszego logowania.',
    code: 'Kod odzyskiwania',
    open: 'Otwórz sejf',
    badCode: 'Ten kod nie otwiera sejfu. Sprawdź litery i cyfry — I, L i O czytamy jako 1 i 0.',
    lost: 'Nie masz kodu? Dane podopiecznych leżą na ich telefonach. Ustawienia na innym komputerze, na którym sejf jest otwarty, pozwalają wygenerować nowy kod.',
    signOut: 'Wyloguj',
  },
  en: {
    profileTitle: 'Your profile',
    profileLead: 'This is what the client sees in the invite. They never see your email.',
    name: 'Full name or practice name',
    profession: 'Profession',
    bio: 'A line about you (optional)',
    next: 'Next',
    vaultTitle: 'Recovery code',
    vaultLead:
      'Client data is encrypted with a key only your browser knows. This code unlocks it on a new computer. We do not store it and cannot recover it.',
    copy: 'Copy',
    copied: 'Copied',
    download: 'Download as a file',
    confirm: (g: string) => `Type the last group of the code (${g.replace(/./g, '•')})`,
    finish: 'I saved the code — continue',
    wrong: 'That is not the last group of the code.',
    making: 'Creating keys…',
    failed: 'Could not save the profile. Try again.',
    unlockTitle: 'Unlock your vault on this computer',
    unlockLead: 'Your key is not on this computer yet. Enter the recovery code from your first sign-in.',
    code: 'Recovery code',
    open: 'Unlock',
    badCode: 'This code does not open the vault. Check the characters — I, L and O read as 1 and 0.',
    lost: 'No code? Client data lives on their phones. Settings on another computer where the vault is open can generate a new code.',
    signOut: 'Sign out',
  },
});

function download(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RecoveryCode({ code, email }: { code: string; email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="stack">
      <div className="code mono" aria-label={T.code}>
        {code}
      </div>
      <div className="row">
        <button
          type="button"
          className="btn ghost small"
          onClick={() =>
            void navigator.clipboard?.writeText(code).then(
              () => setCopied(true),
              () => undefined,
            )
          }
        >
          {copied ? T.copied : T.copy}
        </button>
        <button type="button" className="btn ghost small" onClick={() => download('gym-tracker-sztab-kod.txt', recoveryFile(code, email))}>
          {T.download}
        </button>
      </div>
    </div>
  );
}

export function Onboarding() {
  const { session, refresh, signOut } = useSession();
  const user = session.kind === 'new' ? session.user : null;
  const [step, setStep] = useState<'profile' | 'code'>('profile');
  const [name, setName] = useState('');
  const [profession, setProfession] = useState<Profession>('trainer');
  const [bio, setBio] = useState('');
  const [draft, setDraft] = useState<VaultDraft | null>(null);
  const [check, setCheck] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step === 'code' && user && !draft) void draftVault(user.id).then(setDraft);
  }, [step, user, draft]);

  if (!user) return null;
  const last = draft?.code.split('-').pop() ?? '';

  const finish = async () => {
    if (!draft) return;
    if (check.trim().toUpperCase() !== last) return setErr(T.wrong);
    setBusy(true);
    setErr(null);
    try {
      await insertCoach({
        id: user.id,
        display_name: name.trim(),
        profession,
        bio: bio.trim() || null,
        public_key: draft.publicJwk,
        key_fingerprint: draft.fingerprint,
        sealed_key: draft.sealed,
      });
      await commitVault(user.id, draft);
      await refresh();
      navigate('/podopieczni', { replace: true });
    } catch {
      setErr(T.failed);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'profile')
    return (
      <AuthFrame title={T.profileTitle} lead={T.profileLead}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length >= 2) setStep('code');
          }}
        >
          <label className="field">
            <span>{T.name}</span>
            <input id="name" type="text" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>{T.profession}</span>
            <select id="profession" value={profession} onChange={(e) => setProfession(e.target.value as Profession)}>
              {PROFESSIONS.map((p) => (
                <option key={p} value={p}>
                  {L.profession[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{T.bio}</span>
            <textarea id="bio" maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={name.trim().length < 2}>
            {T.next}
          </button>
          <button className="btn link" type="button" onClick={() => void signOut()}>
            {T.signOut}
          </button>
        </form>
      </AuthFrame>
    );

  return (
    <AuthFrame title={T.vaultTitle} lead={T.vaultLead}>
      {draft ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void finish();
          }}
        >
          <RecoveryCode code={draft.code} email={user.email ?? ''} />
          <label className="field">
            <span>{T.confirm(last)}</span>
            <input id="confirm" type="text" autoComplete="off" value={check} onChange={(e) => setCheck(e.target.value)} />
          </label>
          {err ? <p className="err" role="alert">{err}</p> : null}
          <button className="btn" type="submit" disabled={busy || check.trim().length < 4}>
            {T.finish}
          </button>
        </form>
      ) : (
        <p className="soft" role="status">{T.making}</p>
      )}
    </AuthFrame>
  );
}

export function Unlock() {
  const { session, refresh, signOut } = useSession();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (session.kind !== 'locked') return null;
  const { user, coach } = session;

  const submit = async () => {
    setErr(null);
    if (!normalizeRecoveryCode(code)) return setErr(T.badCode);
    setBusy(true);
    const ok = await unlock(user.id, coach.sealed_key, code, coach.key_fingerprint).catch(() => false);
    setBusy(false);
    if (!ok) return setErr(T.badCode);
    await refresh();
  };

  return (
    <AuthFrame title={T.unlockTitle} lead={T.unlockLead}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="field">
          <span>{T.code}</span>
          <input id="code" type="text" autoComplete="off" spellCheck={false} className="mono" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        {err ? <p className="err" role="alert">{err}</p> : null}
        <button className="btn" type="submit" disabled={busy}>
          {T.open}
        </button>
        <p className="small soft">{T.lost}</p>
        <button className="btn link" type="button" onClick={() => void signOut()}>
          {T.signOut}
        </button>
      </form>
    </AuthFrame>
  );
}
