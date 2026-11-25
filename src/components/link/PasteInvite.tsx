import { useState } from 'react';
import { parseInviteQuery } from '@gymtracker/link';
import { text } from '../../i18n';
import { LINK_INVITE_PATH, go } from '../../routing';

/**
 * „Wklej link zaproszenia” — dla iPhone'a: aplikacja zainstalowana na ekranie początkowym ma własną
 * pamięć, a link z wiadomości otwiera się w Safari (inna pamięć). Wklejony tutaj trafia na zwykłą stronę
 * zaproszenia w tej aplikacji. Przyjmuje cały link albo samo `i=…&f=…`.
 */

const T = text({
  pl: {
    title: 'Masz link zaproszenia?',
    hint: 'Na iPhonie link z wiadomości otwiera się w Safari, a nie w zainstalowanej aplikacji. Skopiuj go i wklej tutaj.',
    label: 'Link zaproszenia',
    open: 'Otwórz zaproszenie',
    bad: 'To nie wygląda na link zaproszenia ze Sztabu — skopiuj go jeszcze raz, w całości.',
  },
  en: {
    title: 'Have an invitation link?',
    hint: 'On iPhone a link from a message opens in Safari, not in the installed app. Copy it and paste it here.',
    label: 'Invitation link',
    open: 'Open invitation',
    bad: 'That does not look like a Sztab invitation link — copy it again, in full.',
  },
});

/** Zapytanie zaproszenia z wklejonego tekstu: pełny link, sam hash albo samo `i=…&f=…`. */
export function invitePathFrom(pasted: string): string | null {
  const s = pasted.trim();
  const q = s.includes('?') ? s.slice(s.lastIndexOf('?') + 1) : s;
  const parsed = parseInviteQuery(new URLSearchParams(q.replace(/^#/, '')));
  return parsed ? `${LINK_INVITE_PATH}?i=${encodeURIComponent(parsed.inviteId)}&f=${encodeURIComponent(parsed.fingerprint)}` : null;
}

export function PasteInvite() {
  const [value, setValue] = useState('');
  const [bad, setBad] = useState(false);
  return (
    <form
      className="grp"
      onSubmit={(e) => {
        e.preventDefault();
        const path = invitePathFrom(value);
        if (!path) return setBad(true);
        setBad(false);
        go(path);
      }}
    >
      <h2>{T.title}</h2>
      <p className="hint">{T.hint}</p>
      <label className="field">
        <span>{T.label}</span>
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          value={value}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? 'paste-invite-bad' : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setBad(false);
          }}
        />
      </label>
      {bad && (
        <p className="hint" id="paste-invite-bad" role="alert">
          {T.bad}
        </p>
      )}
      <div className="btnrow">
        <button className="btn sm" type="submit" disabled={!value.trim()}>
          {T.open}
        </button>
      </div>
    </form>
  );
}
