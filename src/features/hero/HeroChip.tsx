import { DiamondButton } from '../../components/DiamondButton';
import { HeroPortrait } from '../../components/HeroPortrait';
import type { Hero } from '../../data/types';
import { useT } from '../../i18n';
import styles from '../search/HeroBar.module.css';

interface Props {
  hero: Hero;
  /** Открыть профиль снова (`?hero=<key>&profile`). */
  onOpen: () => void;
  /** Снять выбор героя. */
  onClear: () => void;
}

/**
 * Чип выбранного героя сверху карты (SPEC §6.8, A15): виден, пока герой выбран, а профиль закрыт —
 * после перехода к месту или региона по карте. Портрет и имя открывают профиль, ✕ снимает выбор.
 */
export function HeroChip({ hero, onOpen, onClear }: Props) {
  const { t } = useT();
  return (
    <section className={[styles.frame, styles.chip].join(' ')} aria-label={t('hero.selected')}>
      <button type="button" className={styles.chipOpen} onClick={onOpen} data-hero-chip>
        {/* Имя кнопки — видимый текст «Имя Профиль героя»; alt портрета его бы повторил. */}
        <span aria-hidden="true" className={styles.chipPortraitWrap}>
          <HeroPortrait hero={hero} link={false} className={styles.chipPortrait} />
        </span>
        <span className={styles.chipText}>
          <span className={styles.chipName}>{hero.name}</span>{' '}
          <span className={styles.chipHint}>{t('hero.profile')}</span>
        </span>
      </button>
      <DiamondButton icon="close" label={t('hero.clear')} onClick={onClear} />
    </section>
  );
}
