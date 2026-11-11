import { useNavigation } from '../../app/navigation';
import { serializeRoute } from '../../app/router';
import { DiamondButton } from '../../components/DiamondButton';
import { HeroPortrait } from '../../components/HeroPortrait';
import type { Hero } from '../../data/types';
import { heroUrl } from '../../data/world';
import { useT } from '../../i18n';
import styles from './HeroBar.module.css';
import { spotName, spotScreen, type Spot } from './search';

interface Props {
  hero: Hero;
  spots: Spot[];
  onClear: () => void;
}

/**
 * Плашка выбранного героя (SPEC §6.5): портрет, имя, ссылка ↗, ×;
 * несколько мест — их список, клик ведёт к месту (герой остаётся выбранным).
 */
export function HeroBadge({ hero, spots, onClear }: Props) {
  const { lang, t } = useT();
  const { route, open } = useNavigation();
  const here = serializeRoute({ screen: route.screen });

  return (
    <section className={[styles.frame, styles.badge].join(' ')} aria-label={t('hero.selected')}>
      <div className={styles.badgeHead}>
        <HeroPortrait hero={hero} link={false} className={styles.badgePortrait} />
        <div className={styles.badgeText}>
          <h2 className={styles.badgeName}>{hero.name}</h2>
          <a
            className={styles.badgeLink}
            href={heroUrl(hero, lang)}
            target="_blank"
            rel="noopener noreferrer"
            // Имя ссылки начинается с видимого текста (WCAG 2.5.3 «Label in Name»).
            aria-label={t('hero.badgeLink', { name: hero.name })}
          >
            dota2.com ↗
          </a>
        </div>
        <DiamondButton icon="close" label={t('hero.clear')} onClick={onClear} />
      </div>
      {spots.length > 1 && (
        <nav aria-label={t('hero.places')}>
          <ul className={styles.places}>
            {spots.map((s) => {
              const screen = spotScreen(s);
              const current = serializeRoute({ screen }) === here;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    className={[styles.place, styles[s.tone]].join(' ')}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => open(screen)}
                  >
                    {spotName(s, lang)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </section>
  );
}
