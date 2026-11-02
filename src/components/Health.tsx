import { useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { text } from '../i18n';
import { HEALTH_PATH } from '../routing';
import { healthAck } from './healthAck';

/**
 * Zastrzeżenie zdrowotne — jedno źródło tekstu dla wprowadzenia, ustawień, startu planu,
 * podglądu treningu i kalorii.
 *
 * Krótka wersja stoi wszędzie tam, gdzie zapada decyzja o wysiłku; pełna — w ustawieniach.
 * Pełna mówi nie tylko „nie zastępujemy lekarza”, ale też kiedy z nim porozmawiać przed
 * startem i kiedy przerwać trening — zastrzeżenie, z którego nic nie wynika, nikogo nie chroni.
 * Lista sytuacji idzie za kwestionariuszem PAR-Q+ i zaleceniami ACSM (Riebe i in., 2015).
 *
 * Jedzenie i badania mają te same trzy warstwy (spec `2026-11-02-zastrzezenia-medyczne-design.md`):
 * jedna linijka przy każdej podpowiedzi, raz do potwierdzenia „Rozumiem” przed pierwszym użyciem
 * i pełna strona `#/zdrowie` — kto, kiedy i gdzie ma szukać specjalisty.
 */

const T = text({
  pl: {
    short:
      'GYM TRACKER pomaga planować i zapisywać trening, ale nie zastępuje fizjoterapeuty, dietetyka ani konsultacji lekarskiej.',
    watch:
      'Liczby z czujników zegarka, pokazane bez oceny: tętno spoczynkowe to średnia z ostatnich 7 dni, stres i Body Battery w skali 0–100. Pomiar na nadgarstku bywa niedokładny. Jeśli coś cię niepokoi, porozmawiaj z lekarzem.',
    phone:
      'Liczby z Apple Zdrowie albo Health Connect, pokazane bez oceny: tętno spoczynkowe dnia, sen z nocy, która skończyła się tego dnia, i ostatnie ważenie dnia. Ich dokładność zależy od urządzenia, które je zapisało. Jeśli coś cię niepokoi, porozmawiaj z lekarzem.',
    title: 'Zdrowie i bezpieczeństwo',
    doctor: (
      <>
        <b>Zanim zaczniesz, porozmawiaj z lekarzem,</b> jeśli masz chorobę serca, nadciśnienie,
        cukrzycę albo inną chorobę przewlekłą, jesteś w ciąży lub po porodzie, wracasz po urazie
        albo operacji, czujesz ból w klatce piersiowej przy wysiłku albo zdarzają ci się zawroty
        głowy i omdlenia.
      </>
    ) as ReactNode,
    stop: (
      <>
        <b>Przerwij trening</b> przy bólu w klatce piersiowej, duszności większej niż zwykła
        zadyszka, zawrotach głowy, kołataniu serca albo ostrym bólu stawu czy kręgosłupa — innym niż
        znajome zmęczenie mięśni. Ból, który wraca, warto pokazać fizjoterapeucie.
      </>
    ) as ReactNode,
    kcal: (
      <>
        <b>Kalorie są szacunkiem,</b> a nie zaleceniem żywieniowym. Ile i co jeść, ustala się
        z dietetykiem. Sylwetka w atlasie i filmy pokazują tor ruchu, ale nie zastąpią instruktora,
        który zobaczy twoją technikę.
      </>
    ) as ReactNode,
    food: 'Cele, plany i propozycje jedzenia to ogólne wskazówki, nie zalecenie dla Ciebie. Każdy organizm jest inny — co i ile jeść, ustal z lekarzem lub dietetykiem.',
    labs: 'To informacje, nie diagnoza ani leczenie. Propozycje jedzenia wynikają z ogólnych zaleceń, nie z oceny Twojego zdrowia — wyniki i każdą zmianę diety, leków czy suplementów omów z lekarzem. Zakresy dotyczą dorosłych; w ciąży i u dzieci są inne.',
    fast: 'Post przerywany nie jest dla osób w ciąży, karmiących piersią, z cukrzycą na lekach ani z zaburzeniami odżywiania — jeśli to Ciebie dotyczy, najpierw porozmawiaj z lekarzem.',
    more: 'Więcej o zdrowiu i bezpieczeństwie',
    ackTitle: 'Zanim skorzystasz z podpowiedzi o jedzeniu',
    ack: [
      'Cel kalorii, plany posiłków i wnioski z badań liczę ze wzorów i zaleceń dla zdrowych dorosłych. To ogólne wskazówki — nie diagnoza, nie leczenie i nie dieta ułożona dla Ciebie.',
      'Każdy organizm jest inny. Przy chorobie przewlekłej, stałych lekach, w ciąży i podczas karmienia, przed 18. rokiem życia albo przy zaburzeniach odżywiania zmiany w jedzeniu prowadź z lekarzem lub dietetykiem.',
      'Nie zmieniaj leczenia, leków ani diety zaleconej przez lekarza na podstawie aplikacji.',
    ],
    ackOk: 'Rozumiem',
    ackMore: 'Przeczytaj całość',
    cardLead:
      'Kiedy przed startem porozmawiać z lekarzem, kiedy przerwać trening, komu liczenie kalorii nie służy, jak czytać wnioski z badań i gdzie szukać pomocy.',
    cardOpen: 'Przeczytaj',
    page: {
      lead: 'GYM TRACKER pomaga zapisywać trening i jedzenie i podpowiada na podstawie ogólnych zaleceń dla zdrowych dorosłych (m.in. WHO, NASEM, NCEZ). Nie jest wyrobem medycznym: nie stawia diagnozy, nie leczy i nie zastępuje lekarza, dietetyka ani fizjoterapeuty.',
      bodyTitle: 'Każdy organizm jest inny',
      body: 'Wskazówki liczę ze wzorów dla przeciętnej osoby w Twoim wieku, o Twoim wzroście, wadze i aktywności. Nie znam Twojej historii zdrowia, leków, objawów ani samopoczucia — lekarz i dietetyk je znają. Traktuj liczby jako punkt wyjścia do rozmowy ze specjalistą, nie jako zalecenie. Nie zmieniaj leczenia, leków ani diety zaleconej przez lekarza na podstawie aplikacji.',
      trainTitle: 'Trening',
      foodTitle: 'Jedzenie i dieta',
      foodEstimate: (
        <>
          <b>Cel kalorii to szacunek</b> (zwykle z dokładnością do ok. 300 kcal), a plany posiłków, przepisy
          i propozycje to ogólne przykłady. Aplikacja nie schodzi poniżej bezpiecznego minimum i nie proponuje
          odchudzania przed 18. rokiem życia, w ciąży ani przy niedowadze — ale to nie zastępuje opieki specjalisty.
        </>
      ) as ReactNode,
      foodFirst: (
        <>
          <b>Najpierw lekarz lub dietetyk,</b> jeśli masz cukrzycę (zwłaszcza na insulinie lub lekach obniżających
          cukier), chorobę nerek, wątroby lub serca, nadciśnienie, alergię lub nietolerancję pokarmową, bierzesz
          stałe leki (np. przeciwkrzepliwe), jesteś w ciąży lub karmisz piersią, masz mniej niż 18 albo ponad 65
          lat, albo chcesz schudnąć dużo lub szybko.
        </>
      ) as ReactNode,
      foodFast:
        'Okno jedzenia (post przerywany) w profilu diety jest opcją, nie zaleceniem: przy tej samej liczbie kalorii badania nie pokazują przewagi postu nad zwykłym jedzeniem. Okno nie zmienia celu kalorii. Nie korzystaj z niego w ciąży, podczas karmienia, przy cukrzycy leczonej lekami ani przy zaburzeniach odżywiania bez rozmowy z lekarzem.',
      edTitle: 'Relacja z jedzeniem',
      ed: 'Liczenie kalorii i ważenie nie każdemu służą. Jeśli budzą niepokój albo poczucie winy, jeśli pomijasz posiłki, objadasz się, prowokujesz wymioty albo ćwiczysz, żeby „spalić” jedzenie — albo masz za sobą zaburzenia odżywiania — nie korzystaj z celu kalorii bez opieki specjalisty. W profilu diety możesz włączyć tryb „Bez liczenia kalorii”. Z tym, co się dzieje, możesz pójść do lekarza rodzinnego, psychologa lub psychiatry.',
      labsTitle: 'Wyniki badań',
      labs: 'Badania odczytują wyniki i porównują je z zakresami dla dorosłych. Zakresy różnią się między laboratoriami, a znaczenie wyniku zależy od objawów, leków i innych badań — ocenia to lekarz. Propozycje jedzenia to ogólne informacje o składnikach, nie leczenie niedoboru; suplementy i ich dawki ustala lekarz lub farmaceuta. Aplikacja nie wykrywa niezawodnie stanów pilnych: jeśli laboratorium oznaczyło wynik jako krytyczny albo źle się czujesz, nie czekaj na nią.',
      nowTitle: 'Kiedy od razu po pomoc',
      now: 'Ból lub ucisk w klatce piersiowej, nagła duszność, omdlenie, nagłe osłabienie jednej strony ciała, zaburzenia mowy lub widzenia, objawy ciężkiej reakcji alergicznej (obrzęk twarzy, trudność w oddychaniu) albo myśli o zrobieniu sobie krzywdy — dzwoń pod 112.',
      whereTitle: 'Gdzie szukać pomocy',
      gp: 'Lekarz rodzinny (POZ) — pierwszy krok. Przy niektórych chorobach przewlekłych (np. cukrzyca, otyłość, nadciśnienie) może skierować na bezpłatną poradę dietetyka NFZ w przychodni z opieką koordynowaną.',
      lines: [
        { tel: '112', what: 'numer alarmowy' },
        { tel: '116 123', what: 'bezpłatny telefon dla dorosłych w kryzysie emocjonalnym' },
        { tel: '116 111', what: 'bezpłatny telefon zaufania dla dzieci i młodzieży' },
      ],
      dataTitle: 'Twoje dane',
      data: 'Profil diety, dziennik jedzenia i wyniki badań są tylko w tej przeglądarce na tym urządzeniu — aplikacja ich nigdzie nie wysyła. Kopia danych z ustawień zawiera je w zwykłym pliku, więc traktuj ją jak dokumentację medyczną.',
      note: 'To potwierdzenie i ta strona nie są umową ani zgodą medyczną — mówią, czym aplikacja jest, a czym nie.',
    },
  },
  en: {
    short:
      'GYM TRACKER helps you plan and log your training, but it doesn’t replace a physiotherapist, a dietitian or medical advice.',
    watch:
      'Numbers from your watch’s sensors, shown without judgement: resting heart rate is the average of the last 7 days; stress and Body Battery are on a 0–100 scale. Wrist readings can be inaccurate. If something worries you, talk to a doctor.',
    phone:
      'Numbers from Apple Health or Health Connect, shown without judgement: the day’s resting heart rate, sleep from the night that ended that day, and the day’s last weigh-in. Their accuracy depends on the device that recorded them. If something worries you, talk to a doctor.',
    title: 'Health and safety',
    doctor: (
      <>
        <b>Talk to a doctor before you start</b> if you have heart disease, high blood pressure, diabetes or another
        chronic condition, are pregnant or have recently given birth, are coming back from an injury or surgery, feel
        chest pain during exercise, or have dizzy spells or fainting.
      </>
    ),
    stop: (
      <>
        <b>Stop training</b> if you feel chest pain, shortness of breath beyond ordinary puffing, dizziness, heart
        palpitations or sharp pain in a joint or your spine — anything other than familiar muscle fatigue. Pain that
        keeps coming back is worth showing to a physiotherapist.
      </>
    ),
    kcal: (
      <>
        <b>Calories are an estimate,</b> not nutritional advice. How much and what to eat is something to work out
        with a dietitian. The figure in the atlas and the videos show the movement path, but they can’t replace an
        instructor who can see your technique.
      </>
    ),
    food: 'Targets, plans and food suggestions are general guidance, not advice for you. Every body is different — what and how much to eat is something to settle with a doctor or a dietitian.',
    labs: 'This is information, not a diagnosis or treatment. Food suggestions follow general guidelines, not an assessment of your health — discuss your results and any change to diet, medicines or supplements with a doctor. Ranges are for adults; they differ in pregnancy and for children.',
    fast: 'Intermittent fasting isn’t for people who are pregnant, breastfeeding, have diabetes treated with medicines or have an eating disorder — if that’s you, talk to a doctor first.',
    more: 'More on health and safety',
    ackTitle: 'Before you use the food suggestions',
    ack: [
      'The calorie target, meal plans and lab-result tips come from formulas and guidelines for healthy adults. They are general guidance — not a diagnosis, not treatment and not a diet made for you.',
      'Every body is different. With a chronic condition, regular medicines, in pregnancy or while breastfeeding, under 18, or with an eating disorder, make changes to what you eat with a doctor or a dietitian.',
      'Don’t change a treatment, medicines or a diet your doctor prescribed because of the app.',
    ],
    ackOk: 'I understand',
    ackMore: 'Read it all',
    cardLead:
      'When to talk to a doctor before you start, when to stop training, who calorie counting doesn’t suit, how to read lab-result tips and where to get help.',
    cardOpen: 'Read',
    page: {
      lead: 'GYM TRACKER helps you log training and food and gives tips based on general guidelines for healthy adults (WHO, NASEM, NCEZ and others). It is not a medical device: it doesn’t diagnose, doesn’t treat and doesn’t replace a doctor, a dietitian or a physiotherapist.',
      bodyTitle: 'Every body is different',
      body: 'The tips come from formulas for an average person of your age, height, weight and activity. I don’t know your health history, medicines, symptoms or how you feel — your doctor and dietitian do. Treat the numbers as a starting point for a conversation with a specialist, not as advice. Don’t change a treatment, medicines or a diet your doctor prescribed because of the app.',
      trainTitle: 'Training',
      foodTitle: 'Food and diet',
      foodEstimate: (
        <>
          <b>The calorie target is an estimate</b> (usually within about 300 kcal), and meal plans, recipes and
          suggestions are general examples. The app never goes below a safe minimum and doesn’t suggest losing weight
          under 18, in pregnancy or when underweight — but that doesn’t replace a specialist’s care.
        </>
      ),
      foodFirst: (
        <>
          <b>See a doctor or a dietitian first</b> if you have diabetes (especially on insulin or glucose-lowering
          drugs), kidney, liver or heart disease, high blood pressure, a food allergy or intolerance, take regular
          medicines (e.g. blood thinners), are pregnant or breastfeeding, are under 18 or over 65, or want to lose a
          lot of weight or lose it fast.
        </>
      ),
      foodFast:
        'The eating window (intermittent fasting) in the diet profile is an option, not advice: at the same calories, studies don’t show fasting doing better than ordinary eating. The window doesn’t change your calorie target. Don’t use it in pregnancy, while breastfeeding, with diabetes treated with medicines or with an eating disorder without talking to a doctor.',
      edTitle: 'Your relationship with food',
      ed: 'Counting calories and weighing yourself don’t suit everyone. If they bring anxiety or guilt, if you skip meals, binge, make yourself sick or exercise to “burn off” food — or you have had an eating disorder — don’t use the calorie target without a specialist’s care. In the diet profile you can turn on “No calorie counting”. You can take what is going on to a GP, a psychologist or a psychiatrist.',
      labsTitle: 'Lab results',
      labs: 'Lab results reads your results and compares them with adult ranges. Ranges differ between labs, and what a result means depends on symptoms, medicines and other tests — a doctor judges that. Food suggestions are general information about nutrients, not treatment of a deficiency; supplements and their doses are for a doctor or a pharmacist. The app doesn’t reliably spot urgent conditions: if the lab marked a result as critical or you feel unwell, don’t wait for it.',
      nowTitle: 'When to get help right away',
      now: 'Chest pain or pressure, sudden shortness of breath, fainting, sudden weakness on one side of the body, trouble speaking or seeing, signs of a severe allergic reaction (swollen face, trouble breathing) or thoughts of harming yourself — call 112.',
      whereTitle: 'Where to get help',
      gp: 'Your GP is the first step. In Poland, for some chronic conditions (e.g. diabetes, obesity, high blood pressure) a GP (POZ) in coordinated care can refer you to a free NFZ dietitian.',
      lines: [
        { tel: '112', what: 'emergency number (across the EU)' },
        { tel: '116 123', what: 'free helpline for adults in emotional crisis (Poland)' },
        { tel: '116 111', what: 'free helpline for children and young people (Poland)' },
      ],
      dataTitle: 'Your data',
      data: 'The diet profile, food log and lab results stay in this browser on this device — the app sends them nowhere. A data backup from Settings holds them in a plain file, so treat it like a medical record.',
      note: 'This confirmation and this page are not a contract or medical consent — they say what the app is and what it isn’t.',
    },
  },
});

export const HEALTH_SHORT = T.short;

/**
 * Pod liczbami zdrowia z zegarka. Pokazujemy je bez oceny — „za wysokie” albo „w normie”
 * mówi lekarz, nie aplikacja.
 */
export const WATCH_NOTE = T.watch;

/** Pod liczbami z telefonu — ta sama zasada co przy zegarku, inne źródła liczb. */
export const PHONE_NOTE = T.phone;

/** Krótka wersja przy jedzeniu: dziennik, profil diety, plany. */
export const FOOD_SHORT = T.food;

/** Krótka wersja przy badaniach — mocniejsza, bo wnioski idą z wyników tej osoby. */
export const LABS_SHORT = T.labs;

/** Przy oknie jedzenia (post przerywany): komu post nie służy bez rozmowy z lekarzem. */
export const FAST_SHORT = T.fast;

type NoteKind = 'train' | 'food' | 'labs' | 'fast';

const SHORT: Record<NoteKind, string> = { train: T.short, food: T.food, labs: T.labs, fast: T.fast };

/**
 * Jedna linijka przy podpowiedzi. `more` dokłada odnośnik do pełnej strony — przy jedzeniu
 * i badaniach zawsze; we wprowadzeniu nie, bo stamtąd strona wyprowadziłaby z kroków.
 */
export function HealthNote({
  kind = 'train',
  more = false,
  className = 'hint health-note',
  style,
}: {
  kind?: NoteKind;
  more?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p className={className} style={style}>
      {SHORT[kind]}
      {more && (
        <>
          {' '}
          <a href={HEALTH_PATH}>{T.more}</a>
        </>
      )}
    </p>
  );
}

/**
 * Karta przed pierwszym użyciem podpowiedzi o jedzeniu (dziennik, profil diety, badania).
 * Nie zasłania strony — treść pod nią działa, a karta znika na „Rozumiem” wszędzie naraz.
 */
export function HealthAck() {
  const done = useSyncExternalStore(healthAck.subscribe, healthAck.snapshot, () => true);
  if (done) return null;
  return (
    <section className="grp health-ack" aria-labelledby="health-ack-title">
      <h2 id="health-ack-title">{T.ackTitle}</h2>
      <ul>
        {T.ack.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" className="btn" onClick={healthAck.acknowledge}>
          {T.ackOk}
        </button>
        <a className="btn ghost" href={HEALTH_PATH}>
          {T.ackMore}
        </a>
      </div>
    </section>
  );
}

/** W ustawieniach: o czym jest pełna strona i przejście do niej. */
export function HealthCard() {
  return (
    <div className="grp">
      <h2>{T.title}</h2>
      <p className="tight">{HEALTH_SHORT}</p>
      <p className="tight">{T.cardLead}</p>
      <div className="actions">
        <a className="btn ghost" href={HEALTH_PATH}>
          {T.cardOpen}
        </a>
      </div>
    </div>
  );
}

/** Pełna strona `#/zdrowie`: czym aplikacja jest, kto ma najpierw iść do specjalisty, kiedy i dokąd. */
export function HealthPage() {
  const P = T.page;
  return (
    <div className="health-page">
      <p className="lead">{P.lead}</p>

      <section className="grp" aria-labelledby="health-body">
        <h2 id="health-body">{P.bodyTitle}</h2>
        <p className="tight">{P.body}</p>
      </section>

      <section className="grp health-now" aria-labelledby="health-now">
        <h2 id="health-now">{P.nowTitle}</h2>
        <p className="tight">{P.now}</p>
      </section>

      <section className="grp" aria-labelledby="health-train">
        <h2 id="health-train">{P.trainTitle}</h2>
        <p className="tight">{T.doctor}</p>
        <p className="tight">{T.stop}</p>
        <p className="tight">{T.kcal}</p>
      </section>

      <section className="grp" aria-labelledby="health-food">
        <h2 id="health-food">{P.foodTitle}</h2>
        <p className="tight">{P.foodEstimate}</p>
        <p className="tight">{P.foodFirst}</p>
        <p className="tight">{P.foodFast}</p>
      </section>

      <section className="grp" aria-labelledby="health-ed">
        <h2 id="health-ed">{P.edTitle}</h2>
        <p className="tight">{P.ed}</p>
      </section>

      <section className="grp" aria-labelledby="health-labs">
        <h2 id="health-labs">{P.labsTitle}</h2>
        <p className="tight">{P.labs}</p>
      </section>

      <section className="grp" aria-labelledby="health-where">
        <h2 id="health-where">{P.whereTitle}</h2>
        <p className="tight">{P.gp}</p>
        <ul className="health-lines">
          {P.lines.map((l) => (
            <li key={l.tel}>
              <a href={`tel:${l.tel.replace(/ /g, '')}`}>{l.tel}</a> — {l.what}
            </li>
          ))}
        </ul>
      </section>

      <section className="grp" aria-labelledby="health-data">
        <h2 id="health-data">{P.dataTitle}</h2>
        <p className="tight">{P.data}</p>
      </section>

      <p className="wrap disclaimer">{P.note}</p>
    </div>
  );
}
