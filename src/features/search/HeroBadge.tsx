import { useId, useState } from 'react';
import { useNavigation } from '../../app/navigation';
import { serializeRoute } from '../../app/router';
import { DiamondButton } from '../../components/DiamondButton';
import { EventIcon, hasBadge, type BadgeEvent } from '../../components/EventIcon';
import { HeroPortrait } from '../../components/HeroPortrait';
import type { Hero } from '../../data/types';
import { heroUrl } from '../../data/world';
import { useT } from '../../i18n';
import styles from './HeroBar.module.css';
import { spotName, spotScreen, type Spot } from './search';
import type { HeroThreads } from './threads';

interface Props {
  hero: Hero;
  spots: Spot[];
  /** Нити героя на карте (#67); есть — в плашке легенда «как читать нити». */
  threads?: HeroThreads;
  onClear: () => void;
}

/**
 * Плашка выбранного героя (SPEC §6.5): портрет, имя, ссылка ↗, ×;
 * несколько мест — их список со значками событий, клик ведёт к месту (герой остаётся выбранным);
 * есть нити — раскрывающаяся легенда «как читать нити» (#67).
 */
export function HeroBadge({ hero, spots, threads, onClear }: Props) {
  const { lang, t } = useT();
  const { route, open } = useNavigation();
  const here = serializeRoute({ screen: route.screen });
  const [legendOpen, setLegendOpen] = useState(false);
  const legendId = useId();
  const steps = threads?.steps ?? [];
  const kinds = new Set(steps.map((s) => s.kind));
  // В легенде — только значки событий, которые есть у этого героя, по порядку его мест.
  const events = [...new Set(spots.map((s) => s.event))].filter(hasBadge);

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
                    title={t(`hero.event.${s.event}`)}
                  >
                    {hasBadge(s.event) && <EventIcon event={s.event} className={styles.placeIcon} />}
                    {spotName(s, lang)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      {steps.length > 0 && (
        <div className={styles.legend}>
          <button
            type="button"
            className={styles.legendToggle}
            aria-expanded={legendOpen}
            aria-controls={legendId}
            onClick={() => setLegendOpen((v) => !v)}
          >
            {t('hero.legend')}
            <span aria-hidden="true">{legendOpen ? ' ▴' : ' ▾'}</span>
          </button>
          <ul id={legendId} className={styles.legendList} hidden={!legendOpen}>
            {kinds.has('path') && (
              <li>
                <LineSample kind="path" />
                {t('hero.legendPath')}
              </li>
            )}
            {kinds.has('link') && (
              <li>
                <LineSample kind="link" />
                {t('hero.legendLink')}
              </li>
            )}
            {events.map((e: BadgeEvent) => (
              <li key={e}>
                <EventIcon event={e} className={styles.legendIcon} />
                {t(`hero.event.${e}`)}
              </li>
            ))}
            <li className={styles.legendNote}>{t('hero.legendColor')}</li>
          </ul>
        </div>
      )}
    </section>
  );
}

/** Образец линии для легенды: сплошная со стрелкой — путь, пунктир — прочая связь. */
function LineSample({ kind }: { kind: 'path' | 'link' }) {
  return (
    <svg className={styles.legendLine} viewBox="0 0 28 12" width="28" height="12" aria-hidden="true" focusable="false">
      <path d="M2 6h22" strokeDasharray={kind === 'link' ? '4 3' : undefined} />
      {kind === 'path' && <path className={styles.legendArrow} d="M15 2.5 21 6l-6 3.5Z" />}
    </svg>
  );
}
