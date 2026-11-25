import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { LOCALE, text } from '@gt/i18n';
import { QrCode } from '../components/Qr';
import { toast } from '../components/ui';
import { groupSecret, verifiedFactor } from '../lib/mfa';
import type { FactorLike } from '../lib/mfa';
import { listFactors, startEnroll, verifyCode } from '../lib/mfaApi';
import type { CodeResult } from '../lib/mfaApi';
import { sb } from '../lib/sb';
import './mfa.css';

/**
 * Ustawienia → Logowanie dwuetapowe (TOTP). Supabase nie daje kodów zapasowych, więc ekran mówi
 * o tym wprost; kod odzyskiwania sejfu nie wyłącza tego zabezpieczenia.
 */

const T = text({
  pl: {
    title: 'Logowanie dwuetapowe',
    lead: 'Po haśle pytamy o sześciocyfrowy kod z aplikacji na telefonie (np. Google Authenticator, Aegis, menedżer haseł). Samo hasło nie wystarczy, żeby wejść do twoich podopiecznych.',
    on: 'Włączone',
    off: 'Wyłączone',
    since: (n: string, d: string) => `${n}, od ${d}`,
    enable: 'Włącz',
    disable: 'Wyłącz',
    cancel: 'Anuluj',
    scan: 'Zeskanuj kod w aplikacji uwierzytelniającej albo wpisz sekret ręcznie.',
    qr: 'Kod QR do aplikacji uwierzytelniającej',
    secret: 'Sekret do ręcznego wpisania',
    copy: 'Kopiuj',
    copied: 'Skopiowano',
    codeLabel: 'Kod z aplikacji (6 cyfr)',
    confirm: 'Potwierdź i włącz',
    enabled: 'Logowanie dwuetapowe włączone',
    disabled: 'Logowanie dwuetapowe wyłączone',
    offLead: 'Wyłączenie wymaga aktualnego kodu z aplikacji.',
    disableGo: 'Wyłącz logowanie dwuetapowe',
    recoveryTitle: 'Gdy zgubisz telefon',
    recovery:
      'Nie ma kodów zapasowych. Dodaj ten sam sekret jeszcze na drugim urządzeniu albo do menedżera haseł, najlepiej od razu. Kod odzyskiwania sejfu nie resetuje logowania dwuetapowego. Jeśli stracisz dostęp do kodów, napisz do administratora Sztabu — po sprawdzeniu, że to ty, zdejmie zabezpieczenie.',
    errBad: 'Zły albo wygasły kod. Wpisz aktualny z aplikacji.',
    errFormat: 'Kod ma sześć cyfr.',
    errRate: 'Za dużo prób. Spróbuj za kilka minut.',
    errOther: 'Coś poszło nie tak. Spróbuj ponownie.',
    loading: 'Sprawdzam…',
  },
  en: {
    title: 'Two-step sign-in',
    lead: 'After the password we ask for a six-digit code from an app on your phone (e.g. Google Authenticator, Aegis, a password manager). The password alone will not open your clients.',
    on: 'On',
    off: 'Off',
    since: (n: string, d: string) => `${n}, since ${d}`,
    enable: 'Turn on',
    disable: 'Turn off',
    cancel: 'Cancel',
    scan: 'Scan the code in your authenticator app, or type the secret by hand.',
    qr: 'QR code for the authenticator app',
    secret: 'Secret for manual entry',
    copy: 'Copy',
    copied: 'Copied',
    codeLabel: 'Code from the app (6 digits)',
    confirm: 'Confirm and turn on',
    enabled: 'Two-step sign-in is on',
    disabled: 'Two-step sign-in is off',
    offLead: 'Turning it off needs a current code from the app.',
    disableGo: 'Turn off two-step sign-in',
    recoveryTitle: 'If you lose your phone',
    recovery:
      'There are no backup codes. Add the same secret to a second device or a password manager, ideally right now. The vault recovery code does not reset two-step sign-in. If you lose access to the codes, write to the Sztab administrator — after checking it is you, they will remove the protection.',
    errBad: 'Wrong or expired code. Enter the current one from the app.',
    errFormat: 'The code has six digits.',
    errRate: 'Too many attempts. Try again in a few minutes.',
    errOther: 'Something went wrong. Try again.',
    loading: 'Checking…',
  },
});

const explain = (r: CodeResult) => (r === 'bad' ? T.errBad : r === 'format' ? T.errFormat : r === 'rate' ? T.errRate : T.errOther);

type View =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'enroll'; factorId: string; uri: string; secret: string }
  | { kind: 'on'; factor: FactorLike; disabling: boolean };

export function MfaSection() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const show = (all: FactorLike[]) => {
    const f = verifiedFactor(all);
    setView(f ? { kind: 'on', factor: f, disabling: false } : { kind: 'off' });
  };
  const failed = () => {
    setView({ kind: 'off' });
    setErr(T.errOther);
  };
  const load = () => listFactors().then(show, failed);
  useEffect(() => {
    let alive = true;
    void listFactors().then(
      (all) => alive && show(all),
      () => alive && failed(),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guard = (fn: () => Promise<void>) => async (e?: FormEvent) => {
    e?.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch {
      setErr(T.errOther);
    } finally {
      setBusy(false);
    }
  };

  const begin = guard(async () => {
    setCode('');
    setCopied(false);
    setView({ kind: 'enroll', ...(await startEnroll()) });
  });

  const confirm = guard(async () => {
    if (view.kind !== 'enroll') return;
    const r = await verifyCode(code, view.factorId);
    if (r !== 'ok') return setErr(explain(r));
    setCode('');
    toast(T.enabled);
    await load();
  });

  const cancelEnroll = guard(async () => {
    if (view.kind === 'enroll') await sb.auth.mfa.unenroll({ factorId: view.factorId });
    setCode('');
    setView({ kind: 'off' });
  });

  const turnOff = guard(async () => {
    if (view.kind !== 'on') return;
    const r = await verifyCode(code, view.factor.id);
    if (r !== 'ok') return setErr(explain(r));
    const { error } = await sb.auth.mfa.unenroll({ factorId: view.factor.id });
    if (error) return setErr(T.errOther);
    setCode('');
    toast(T.disabled);
    setView({ kind: 'off' });
  });

  const codeField = (
    <label className="field">
      <span>{T.codeLabel}</span>
      <input
        id="mfa-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={9}
        className="mono"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
    </label>
  );
  const error = err ? (
    <p className="err" role="alert">
      {err}
    </p>
  ) : null;

  return (
    <section className="card sz-mfa" aria-labelledby="mfa-title">
      <h2 id="mfa-title">{T.title}</h2>
      <p className="soft small">{T.lead}</p>

      {view.kind === 'loading' ? <p className="soft small">{T.loading}</p> : null}

      {view.kind === 'off' ? (
        <>
          <p className="sz-mfa-status">
            <span className="chip muted">{T.off}</span>
          </p>
          {error}
          <div className="row">
            <button type="button" className="btn" disabled={busy} onClick={() => void begin()}>
              {T.enable}
            </button>
          </div>
        </>
      ) : null}

      {view.kind === 'enroll' ? (
        <form className="stack" onSubmit={(e) => void confirm(e)} noValidate>
          <p className="small">{T.scan}</p>
          <div className="sz-mfa-enroll">
            <QrCode value={view.uri} label={T.qr} />
            <div className="stack">
              <div className="field">
                <span>{T.secret}</span>
                <code className="mono sz-mfa-secret" id="mfa-secret">
                  {groupSecret(view.secret)}
                </code>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() =>
                    void navigator.clipboard?.writeText(view.secret).then(
                      () => setCopied(true),
                      () => undefined,
                    )
                  }
                >
                  {copied ? T.copied : T.copy}
                </button>
              </div>
            </div>
          </div>
          <p className="note warn small">{T.recovery}</p>
          {codeField}
          {error}
          <div className="row">
            <button type="submit" className="btn" disabled={busy}>
              {T.confirm}
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void cancelEnroll()}>
              {T.cancel}
            </button>
          </div>
        </form>
      ) : null}

      {view.kind === 'on' ? (
        <>
          <p className="sz-mfa-status">
            <span className="chip ok">{T.on}</span>{' '}
            <span className="small soft">
              {T.since(view.factor.friendly_name || 'TOTP', view.factor.created_at ? new Date(view.factor.created_at).toLocaleDateString(LOCALE) : '—')}
            </span>
          </p>
          <h3>{T.recoveryTitle}</h3>
          <p className="small">{T.recovery}</p>
          {view.disabling ? (
            <form className="stack" onSubmit={(e) => void turnOff(e)} noValidate>
              <p className="small soft">{T.offLead}</p>
              {codeField}
              {error}
              <div className="row">
                <button type="submit" className="btn danger" disabled={busy}>
                  {T.disableGo}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setErr(null);
                    setCode('');
                    setView({ ...view, disabling: false });
                  }}
                >
                  {T.cancel}
                </button>
              </div>
            </form>
          ) : (
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setView({ ...view, disabling: true })}>
                {T.disable}
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
