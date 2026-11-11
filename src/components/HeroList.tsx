import { useState } from 'react';
import type { Hero } from '../data/types';
import { useT } from '../i18n';
import styles from './HeroList.module.css';
import { HeroPortrait } from './HeroPortrait';

interface Props {
  heroes: Hero[];
  /** Сколько портретов видно сразу; остальные — за плашкой «+N», она раскрывает весь список (SPEC §5.4). */
  max?: number;
  /** Курсор или фокус на портрете (null — ушёл): экран рисует нити героя (SPEC §6.6). */
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
            onPointerLeave={onPreview && (() => onPreview(null))}
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
              aria-label={t('panel.allHeroes', { n: String(heroes.length) })}
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
