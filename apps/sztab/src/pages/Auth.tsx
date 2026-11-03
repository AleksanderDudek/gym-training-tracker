import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { text } from '@gt/i18n';
import { Link } from '../components/ui';
import { GOOGLE_SIGN_IN } from '../lib/env';
import { APP_NAME } from '../lib/labels';
import { navigate } from '../lib/router';
import { sb } from '../lib/sb';

/**
 * Logowanie według standardu: e-mail i hasło z potwierdzeniem adresu, link logowania na maila,
 * reset hasła, opcjonalnie Google. Hasło co najmniej 10 znaków, bez wymogu „wielkiej litery
 * i znaku specjalnego” (NIST SP 800-63B: długość, nie składnia). Komunikat po nieudanym logowaniu
 * nie mówi, czy konto istnieje — tak samo przy resecie.
 */

const T = text({
  pl: {
    tagline: 'Dla trenerów, dietetyków, fizjoterapeutów i lekarzy, którzy prowadzą ludzi z GYM TRACKERem.',
    email: 'E-mail',
    password: 'Hasło',
    password2: 'Powtórz hasło',
    signIn: 'Zaloguj się',
    signInTitle: 'Logowanie',
    magic: 'Wyślij link logowania na maila',
    google: 'Zaloguj przez Google',
    noAccount: 'Nie masz konta?',
    register: 'Załóż konto',
    forgot: 'Nie pamiętasz hasła?',
    haveAccount: 'Masz już konto?',
    registerTitle: 'Nowe konto prowadzącego',
    registerLead: 'Konto jest tylko dla prowadzących. Twoi podopieczni nie zakładają kont — łączą się z GYM TRACKERa przez zaproszenie.',
    pwHint: 'Co najmniej 10 znaków. Najlepiej kilka słów, których nie używasz nigdzie indziej.',
    terms: 'Akceptuję regulamin i politykę prywatności. Rozumiem, że jako prowadzący odpowiadam za dane podopiecznych (RODO).',
    create: 'Załóż konto',
    checkTitle: 'Sprawdź skrzynkę',
    checkSent: (e: string) => `Wysłaliśmy wiadomość na ${e}. Otwórz link, żeby potwierdzić adres.`,
    magicSent: (e: string) => `Jeśli konto ${e} istnieje, link logowania jest już w skrzynce.`,
    resetTitle: 'Reset hasła',
    resetLead: 'Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.',
    resetSend: 'Wyślij link',
    resetSent: (e: string) => `Jeśli konto ${e} istnieje, link do zmiany hasła jest już w skrzynce.`,
    newTitle: 'Nowe hasło',
    newSave: 'Zapisz nowe hasło',
    saved: 'Hasło zmienione.',
    back: 'Wróć do logowania',
    errBad: 'Nieprawidłowy e-mail lub hasło.',
    errConfirm: 'Adres nie jest jeszcze potwierdzony. Sprawdź skrzynkę.',
    errShort: 'Hasło musi mieć co najmniej 10 znaków.',
    errSame: 'Hasła się różnią.',
    errTerms: 'Zaznacz akceptację regulaminu.',
    errRate: 'Za dużo prób. Spróbuj za kilka minut.',
    errOther: 'Coś poszło nie tak. Spróbuj ponownie.',
    errWeak: 'To hasło jest za słabe albo wyciekło w znanym wycieku. Wybierz inne.',
  },
  en: {
    tagline: 'For trainers, dietitians, physiotherapists and doctors who coach people using GYM TRACKER.',
    email: 'Email',
    password: 'Password',
    password2: 'Repeat password',
    signIn: 'Sign in',
    signInTitle: 'Sign in',
    magic: 'Email me a sign-in link',
    google: 'Sign in with Google',
    noAccount: 'No account yet?',
    register: 'Create account',
    forgot: 'Forgot your password?',
    haveAccount: 'Already have an account?',
    registerTitle: 'New coach account',
    registerLead: 'Accounts are for coaches only. The people you coach never create one — they connect from GYM TRACKER through an invite.',
    pwHint: 'At least 10 characters. A few words you use nowhere else work best.',
    terms: 'I accept the terms and privacy policy. I understand that as the coach I am responsible for my clients’ data (GDPR).',
    create: 'Create account',
    checkTitle: 'Check your inbox',
    checkSent: (e: string) => `We sent a message to ${e}. Open the link to confirm your address.`,
    magicSent: (e: string) => `If an account ${e} exists, the sign-in link is in its inbox.`,
    resetTitle: 'Reset password',
    resetLead: 'Enter your account email. We will send a link to set a new password.',
    resetSend: 'Send link',
    resetSent: (e: string) => `If an account ${e} exists, the reset link is in its inbox.`,
    newTitle: 'New password',
    newSave: 'Save new password',
    saved: 'Password changed.',
    back: 'Back to sign in',
    errBad: 'Wrong email or password.',
    errConfirm: 'This address is not confirmed yet. Check your inbox.',
    errShort: 'The password needs at least 10 characters.',
    errSame: 'The passwords differ.',
    errTerms: 'Please accept the terms.',
    errRate: 'Too many attempts. Try again in a few minutes.',
    errOther: 'Something went wrong. Try again.',
    errWeak: 'This password is too weak or appeared in a known breach. Pick another.',
  },
});

const origin = () => location.origin;

function explain(e: { message?: string; code?: string; status?: number } | null): string {
  const code = e?.code ?? '';
  if (code === 'invalid_credentials') return T.errBad;
  if (code === 'email_not_confirmed') return T.errConfirm;
  if (code === 'weak_password') return T.errWeak;
  if (code.includes('rate_limit') || e?.status === 429) return T.errRate;
  return T.errOther;
}

function Frame({ title, children, lead }: { title: string; children: ReactNode; lead?: string }) {
  return (
    <main className="auth">
      <div className="box">
        <a className="brand" href="/" aria-label={APP_NAME}>
          <span className="mark" aria-hidden="true">GT</span>
          <span>
            GYM TRACKER<small>SZTAB</small>
          </span>
        </a>
        <p className="soft" style={{ textAlign: 'center' }}>{T.tagline}</p>
        <section className="card" aria-labelledby="auth-title">
          <h1 id="auth-title">{title}</h1>
          {lead ? <p className="soft">{lead}</p> : null}
          {children}
        </section>
      </div>
    </main>
  );
}

function useForm() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, setErr, run };
}

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const f = useForm();

  const submit = f.run(async () => {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) f.setErr(explain(error));
    else navigate('/podopieczni', { replace: true });
  });

  const magic = async () => {
    if (!email.trim()) return f.setErr(T.email);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${origin()}/podopieczni` } });
    if (error && error.status === 429) return f.setErr(T.errRate);
    setSent(T.magicSent(email.trim()));
  };

  return (
    <Frame title={T.signInTitle}>
      <form className="stack" onSubmit={submit} noValidate>
        <label className="field">
          <span>{T.email}</span>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>{T.password}</span>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {f.err ? <p className="err" role="alert">{f.err}</p> : null}
        {sent ? <p className="okmsg" role="status">{sent}</p> : null}
        <button className="btn" type="submit" disabled={f.busy}>
          {T.signIn}
        </button>
        <button className="btn ghost" type="button" onClick={() => void magic()}>
          {T.magic}
        </button>
        {GOOGLE_SIGN_IN ? (
          <button
            className="btn ghost"
            type="button"
            onClick={() => void sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin()}/podopieczni` } })}
          >
            {T.google}
          </button>
        ) : null}
      </form>
      <div className="stack small">
        <span>
          {T.noAccount} <Link to="/rejestracja">{T.register}</Link>
        </span>
        <Link to="/haslo">{T.forgot}</Link>
      </div>
    </Frame>
  );
}

export function SignUp() {
  const [email, setEmail] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [terms, setTerms] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const f = useForm();

  const submit = f.run(async () => {
    if (p1.length < 10) return f.setErr(T.errShort);
    if (p1 !== p2) return f.setErr(T.errSame);
    if (!terms) return f.setErr(T.errTerms);
    const { data, error } = await sb.auth.signUp({ email: email.trim(), password: p1, options: { emailRedirectTo: `${origin()}/start` } });
    if (error) return f.setErr(explain(error));
    if (data.session) navigate('/start', { replace: true });
    else setDone(email.trim());
  });

  if (done)
    return (
      <Frame title={T.checkTitle}>
        <p>{T.checkSent(done)}</p>
        <Link to="/logowanie">{T.back}</Link>
      </Frame>
    );

  return (
    <Frame title={T.registerTitle} lead={T.registerLead}>
      <form className="stack" onSubmit={submit} noValidate>
        <label className="field">
          <span>{T.email}</span>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>{T.password}</span>
          <input id="password" type="password" autoComplete="new-password" required minLength={10} value={p1} onChange={(e) => setP1(e.target.value)} aria-describedby="pw-hint" />
          <span className="hint" id="pw-hint">{T.pwHint}</span>
        </label>
        <label className="field">
          <span>{T.password2}</span>
          <input id="password2" type="password" autoComplete="new-password" required value={p2} onChange={(e) => setP2(e.target.value)} />
        </label>
        <label className="check">
          <input id="terms" type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span className="small">{T.terms}</span>
        </label>
        {f.err ? <p className="err" role="alert">{f.err}</p> : null}
        <button className="btn" type="submit" disabled={f.busy}>
          {T.create}
        </button>
      </form>
      <span className="small">
        {T.haveAccount} <Link to="/logowanie">{T.signIn}</Link>
      </span>
    </Frame>
  );
}

export function ResetRequest() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const f = useForm();
  const submit = f.run(async () => {
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin()}/haslo/nowe` });
    if (error && error.status === 429) return f.setErr(T.errRate);
    setSent(T.resetSent(email.trim()));
  });
  return (
    <Frame title={T.resetTitle} lead={T.resetLead}>
      <form className="stack" onSubmit={submit} noValidate>
        <label className="field">
          <span>{T.email}</span>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {f.err ? <p className="err" role="alert">{f.err}</p> : null}
        {sent ? <p className="okmsg" role="status">{sent}</p> : null}
        <button className="btn" type="submit" disabled={f.busy}>
          {T.resetSend}
        </button>
      </form>
      <Link to="/logowanie">{T.back}</Link>
    </Frame>
  );
}

export function NewPassword() {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const f = useForm();
  const submit = f.run(async () => {
    if (p1.length < 10) return f.setErr(T.errShort);
    if (p1 !== p2) return f.setErr(T.errSame);
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) return f.setErr(explain(error));
    navigate('/podopieczni', { replace: true });
  });
  return (
    <Frame title={T.newTitle}>
      <form className="stack" onSubmit={submit} noValidate>
        <label className="field">
          <span>{T.password}</span>
          <input id="password" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
          <span className="hint">{T.pwHint}</span>
        </label>
        <label className="field">
          <span>{T.password2}</span>
          <input id="password2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
        </label>
        {f.err ? <p className="err" role="alert">{f.err}</p> : null}
        <button className="btn" type="submit" disabled={f.busy}>
          {T.newSave}
        </button>
      </form>
    </Frame>
  );
}

export { Frame as AuthFrame };
