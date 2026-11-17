import { useT } from '../../i18n';
import styles from './SideLegend.module.css';
import tones from './tones.module.css';

// Легенда сторон в мире (#102, SPEC §8.3): что значит цвет подсветки региона. Только при ширине ≥ 768 px —
// на телефоне то же объясняют заголовки групп списка регионов (#39).

const SIDES = ['radiant', 'dire', 'neutral'] as const;

export function SideLegend() {
  const { t } = useT();
  return (
    <ul className={styles.legend} aria-label={t('world.legend')} data-testid="side-legend">
      {SIDES.map((side) => (
        <li key={side} className={tones[side]}>
          <span className={styles.mark} aria-hidden="true" />
          {t(`list.${side}`)}
        </li>
      ))}
    </ul>
  );
}
