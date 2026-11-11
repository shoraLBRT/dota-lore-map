import type { CSSProperties } from 'react';
import { mediaThumb, resolveMedia } from '../../data/world';
import { useT } from '../../i18n';
import styles from './Blocks.module.css';

/** Больше трёх карточек в панели не показываем (SPEC §5.4 п. 7, §5.5 п. 5). */
export const MAX_MEDIA = 3;

interface Props {
  title: string;
  /** id медиа из World.media (SPEC §10). */
  items: string[] | undefined;
  /** Открыть галерею на элементе (S4, `?media=<id>`). */
  onOpen: (mediaId: string) => void;
}

/** Блок «Медиа в регионе / в месте»: до 3 карточек. Без медиа блок не рисуется. */
export function MediaCards({ title, items, onOpen }: Props) {
  const { l, lang, t } = useT();
  const media = resolveMedia(items);
  if (media.length === 0) return null;
  return (
    <section>
      <h3>{title}</h3>
      <ul className={styles.media}>
        {media.slice(0, MAX_MEDIA).map((m) => {
          const thumb = mediaThumb(m, lang);
          return (
          <li key={m.id}>
            <button
              type="button"
              className={styles.card}
              style={thumb ? ({ '--thumb': `url("${thumb}")` } as CSSProperties) : undefined}
              onClick={() => onOpen(m.id)}
            >
              <span className={styles.cardTitle}>{l(m.title)}</span>
              <span className={styles.cardType}>
                {l(m.subtitle)}
                {m.excerpt && ` · ${t('gallery.excerpt')}`}
              </span>
            </button>
          </li>
          );
        })}
      </ul>
    </section>
  );
}
