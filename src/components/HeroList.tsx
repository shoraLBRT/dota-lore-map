import { useState } from 'react';
import type { Hero } from '../data/types';
import { useT } from '../i18n';
import styles from './HeroList.module.css';
import { HeroPortrait } from './HeroPortrait';

interface Props {
  heroes: Hero[];
  /** Сколько портретов видно сразу; остальные — за плашкой «+N», она раскрывает весь список (SPEC §5.4). */
  max?: number;
  /** Курсор, фокус или тап на портрете (null — ушёл): экран показывает героя на карте и нити (SPEC §6.6). */
  onPreview?: (hero: Hero | null) => void;
}

/** Портреты героев в ряд со ссылками на официальные страницы (ARCHITECTURE A6). Пустой список не рисуется. */
export function HeroList({ heroes, max, onPreview }: Props) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  if (heroes.length === 0) return null;
  const limit = max !== undefined && !expanded && heroes.length > max ? max : heroes.length;
  const rest = heroes.length - limit;
  return (
    <section>
      <h3>{t('panel.heroes')}</h3>
      <ul className={styles.row}>
        {heroes.slice(0, limit).map((h) => (
          <li
            key={h.key}
            onPointerEnter={onPreview && (() => onPreview(h))}
            // Тап (#66): палец ушёл — герой остаётся на карте до другого портрета, ухода фокуса или смены экрана.
            onPointerLeave={onPreview && ((e) => e.pointerType !== 'touch' && onPreview(null))}
            onFocus={onPreview && (() => onPreview(h))}
            onBlur={onPreview && (() => onPreview(null))}
          >
            <HeroPortrait hero={h} />
          </li>
        ))}
        {rest > 0 && (
          <li>
            <button
              type="button"
              className={styles.more}
              aria-expanded="false"
              // Имя начинается с видимого «+N» (WCAG 2.5.3).
              aria-label={t('panel.allHeroes', { rest: String(rest), n: String(heroes.length) })}
              onClick={() => setExpanded(true)}
            >
              +{rest}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
