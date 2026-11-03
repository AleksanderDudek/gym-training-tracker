import { useState } from 'react';
import { text } from '@gt/i18n';
import { toast } from '../components/ui';
import { useReady } from '../session';

/**
 * RODO po stronie prowadzącego. Sztab z założenia nie zna tożsamości podopiecznych i nie umie
 * odczytać ich danych, ale prowadzący nadal jest administratorem: zna osobę, ustala cel i zakres.
 * Ta strona mówi, co z tego wynika, i daje gotowe teksty — bez udawania porady prawnej.
 */

const T = text({
  pl: {
    title: 'RODO i rejestr podopiecznych',
    lead: 'Sztab nie zna tożsamości twoich podopiecznych i nie umie odczytać ich danych. Ty je znasz — więc to ty jesteś administratorem danych. Tu jest, co z tego wynika.',
    rolesT: 'Kto jest kim',
    roles: [
      'Ty — administrator danych podopiecznego: wiesz, kim jest, ustalasz cel i zakres prowadzenia.',
      'Sztab — przechowuje zaszyfrowane paczki i zalecenia, których nie umie odczytać, oraz numery podopiecznych bez danych osobowych. Umowa powierzenia (DPA) jest częścią regulaminu.',
      'Podopieczny — decyduje w GYM TRACKERze, co ci pokazuje, i może w każdej chwili zakończyć współpracę. Wtedy dane znikają z serwera od razu.',
    ],
    whereT: 'Gdzie trzymać rejestr podopiecznych',
    where: [
      'Poza Sztabem. Numer z GT-… zapisz przy osobie w swoim CRM, arkuszu albo kartotece gabinetu.',
      'Rejestr chroń hasłem i dostępem tylko dla osób, które prowadzą podopiecznych.',
      'Skrót przy numerze w Sztabie zostaje w tej przeglądarce — nie wpisuj tam nazwisk ani numerów telefonów.',
      'Lista numerów do CRM: Ustawienia → Lista numerów do CRM (CSV).',
    ],
    healthT: 'Dane o zdrowiu',
    health:
      'Waga, jedzenie, badania i treningi to dane o zdrowiu (art. 9 RODO). Podstawą jest wyraźna zgoda podopiecznego — GYM TRACKER zbiera ją przy przyjęciu zaproszenia, punkt po punkcie. Nie proś o więcej, niż potrzebujesz do prowadzenia.',
    rightsT: 'Gdy podopieczny prosi o swoje prawa',
    rights: [
      'Wgląd i kopia: podopieczny ma wszystkie swoje dane w GYM TRACKERze (eksport do pliku i raport Excel).',
      'Sprostowanie: dane zmienia on sam, w aplikacji. Do ciebie przyjdą z następną paczką.',
      'Usunięcie i cofnięcie zgody: zakończenie współpracy w aplikacji albo w Sztabie usuwa paczkę i zalecenia z serwera od razu. Wpis w swoim rejestrze usuń sam.',
    ],
    clauseT: 'Klauzula informacyjna dla podopiecznego',
    clauseLead: 'Wzór do uzupełnienia i dostosowania. Nie zastępuje porady prawnej.',
    copy: 'Kopiuj wzór',
    copied: 'Skopiowano',
    clause: (who: string) =>
      [
        `Administratorem Twoich danych jest ${who}.`,
        'Dane o treningach, jedzeniu, masie ciała, obwodach i wynikach badań przetwarzam na podstawie Twojej wyraźnej zgody (art. 9 ust. 2 lit. a RODO), wyłącznie w celu prowadzenia Twojego treningu lub żywienia.',
        'Dane przekazujesz z aplikacji GYM TRACKER, zaszyfrowane end-to-end: dostawca usługi GYM TRACKER Sztab nie zna Twojej tożsamości i nie może odczytać tych danych. Widzisz w aplikacji, co mi udostępniasz, i możesz to zmienić w każdej chwili.',
        'Twoje imię i dane kontaktowe przechowuję oddzielnie, w moim rejestrze klientów, przez czas współpracy i [okres] po jej zakończeniu.',
        'Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia oraz cofnięcia zgody w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania przed cofnięciem). Zgodę cofasz, kończąc współpracę w aplikacji. Masz prawo wnieść skargę do Prezesa UODO.',
        'Kontakt w sprawie danych: [e-mail].',
      ].join('\n\n'),
    note: 'Prowadzisz gabinet medyczny? Dokumentację medyczną prowadzi się według osobnych przepisów — Sztab jej nie zastępuje.',
  },
  en: {
    title: 'GDPR and client records',
    lead: 'Sztab does not know who your clients are and cannot read their data. You know them — so you are the data controller. This is what follows from that.',
    rolesT: 'Who is who',
    roles: [
      'You — the controller of your client’s data: you know who they are and set the purpose and scope.',
      'Sztab — stores encrypted packages and advice it cannot read, plus client numbers with no personal data. The data processing agreement (DPA) is part of the terms.',
      'The client — decides in GYM TRACKER what you see and can end the collaboration at any time. The data then leaves the server at once.',
    ],
    whereT: 'Where to keep your client records',
    where: [
      'Outside Sztab. Note the GT-… number next to the person in your CRM, spreadsheet or practice records.',
      'Protect the records with a password and limit access to the people who coach.',
      'The alias next to a number in Sztab stays in this browser — do not type names or phone numbers there.',
      'Number list for your CRM: Settings → Number list for CRM (CSV).',
    ],
    healthT: 'Health data',
    health:
      'Weight, food, lab results and workouts are health data (GDPR art. 9). The basis is the client’s explicit consent — GYM TRACKER collects it item by item when they accept the invite. Do not ask for more than you need to coach.',
    rightsT: 'When a client exercises their rights',
    rights: [
      'Access and copy: the client has all their data in GYM TRACKER (file export and Excel report).',
      'Rectification: they change the data themselves, in the app. It reaches you with the next package.',
      'Erasure and withdrawing consent: ending the collaboration in the app or in Sztab removes the package and advice from the server at once. Remove the entry from your own records yourself.',
    ],
    clauseT: 'Privacy notice for the client',
    clauseLead: 'A template to complete and adapt. It is not legal advice.',
    copy: 'Copy template',
    copied: 'Copied',
    clause: (who: string) =>
      [
        `The controller of your data is ${who}.`,
        'I process data about your workouts, food, body weight, measurements and lab results on the basis of your explicit consent (GDPR art. 9(2)(a)), only to coach your training or nutrition.',
        'You send the data from the GYM TRACKER app, encrypted end to end: the provider of GYM TRACKER Sztab does not know who you are and cannot read it. You see in the app what you share with me and can change it at any time.',
        'I keep your name and contact details separately, in my client records, for the duration of our work and [period] after it ends.',
        'You have the right to access, rectify, erase, restrict and port your data and to withdraw consent at any time (without affecting processing before withdrawal). You withdraw consent by ending the collaboration in the app. You may lodge a complaint with your data protection authority.',
        'Data contact: [email].',
      ].join('\n\n'),
    note: 'Running a medical practice? Medical records follow separate rules — Sztab does not replace them.',
  },
});

export function Privacy() {
  const { coach } = useReady();
  const clause = T.clause(coach.display_name);
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{T.title}</h1>
          <p className="lead">{T.lead}</p>
        </div>
      </div>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        {(
          [
            [T.rolesT, T.roles],
            [T.whereT, T.where],
            [T.rightsT, T.rights],
          ] as const
        ).map(([h, list]) => (
          <section key={h} className="card">
            <h2>{h}</h2>
            <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
              {list.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        ))}
        <section className="card">
          <h2>{T.healthT}</h2>
          <p>{T.health}</p>
          <p className="note gold small">{T.note}</p>
        </section>
      </div>
      <section className="card">
        <h2>{T.clauseT}</h2>
        <p className="soft small">{T.clauseLead}</p>
        <textarea id="clause" readOnly rows={14} value={clause} />
        <button
          type="button"
          className="btn ghost"
          style={{ justifySelf: 'start' }}
          onClick={() =>
            void navigator.clipboard?.writeText(clause).then(
              () => {
                setCopied(true);
                toast(T.copied);
              },
              () => undefined,
            )
          }
        >
          {copied ? T.copied : T.copy}
        </button>
      </section>
    </>
  );
}
