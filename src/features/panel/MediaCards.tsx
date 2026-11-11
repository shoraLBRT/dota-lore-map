import type { CSSProperties } from 'react';
import type { MediaItem } from '../../data/types';
import { useT } from '../../i18n';
import styles from './Blocks.module.css';

/** Больше трёх карточек в панели не показываем (SPEC §5.4 п. 7, §5.5 п. 5). */
export const MAX_MEDIA = 3;

interface Props {
  title: string;
  items: MediaItem[] | undefined;
  /** Открыть галерею на элементе (S4, `?media=<id>`; сама галерея — E6). */
  onOpen: (mediaId: string) => void;
}

/** Блок «Медиа в регионе / в месте»: до 3 карточек. Без медиа блок не рисуется. */
export function MediaCards({ title, items, onOpen }: Props) {
  const { l } = useT();
  if (!items || items.length === 0) return null;
  return (
    <section>
      <h3>{title}</h3>
      <ul className={styles.media}>
        {items.slice(0, MAX_MEDIA).map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={styles.card}
              style={m.thumb ? ({ '--thumb': `url("${m.thumb}")` } as CSSProperties) : undefined}
              onClick={() => onOpen(m.id)}
            >
              <span className={styles.cardTitle}>{l(m.title)}</span>
              {m.subtitle && <span className={styles.cardType}>{l(m.subtitle)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
