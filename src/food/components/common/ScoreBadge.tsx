import { ECO_COLORS, NOVA_COLORS, NUTRI_COLORS } from '../../lib/grades';
import { NOVA_LABELS, gradeLabel } from '../../lib/labels';
import type { EcoGrade, NovaGroup, NutriGrade } from '../../lib/types';
import './common.css';

type Props =
  | { kind: 'nutriscore'; value: NutriGrade; size?: 'sm' | 'md' }
  | { kind: 'ecoscore'; value: EcoGrade; size?: 'sm' | 'md' }
  | { kind: 'nova'; value: NovaGroup; size?: 'sm' | 'md' };

const PREFIX = { nutriscore: 'Nutri-Score', ecoscore: 'Eco-Score', nova: 'NOVA' } as const;
const SHORT = { nutriscore: 'NS', ecoscore: 'Eco', nova: 'NOVA' } as const;

/**
 * Plakietka oceny. Jedyne miejsce w aplikacji z kolorami spoza palety: Nutri-Score, NOVA i
 * Eco-Score to normy, a ich barwy czyta się tak, jak na opakowaniu. Kolor nie jest jedynym
 * sygnałem — litera albo cyfra stoi na plakietce, a pełna nazwa w `aria-label`.
 */
export function ScoreBadge(props: Props) {
  const { kind, size = 'sm' } = props;
  const colors =
    props.kind === 'nutriscore'
      ? NUTRI_COLORS[props.value]
      : props.kind === 'ecoscore'
        ? ECO_COLORS[props.value]
        : NOVA_COLORS[props.value];
  const text = props.kind === 'nova' ? String(props.value) : gradeLabel(props.value);
  const title = props.kind === 'nova' ? `NOVA ${props.value}: ${NOVA_LABELS[props.value]}` : `${PREFIX[kind]} ${text}`;

  return (
    <span
      role="img"
      title={title}
      aria-label={title}
      className={`fd-score${size === 'md' ? ' md' : ''}`}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      <span>{SHORT[kind]}</span>
      {text}
    </span>
  );
}
