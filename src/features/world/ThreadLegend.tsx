import { useId, useState, type CSSProperties } from 'react';
import { EVENT_PATHS } from '../../components/EventIcon';
import { useT, type MessageKey } from '../../i18n';
import type { Tone } from '../search/search';
import { legendRows, type HeroThreads, type StepKind } from '../search/threads';
import styles from './ThreadLegend.module.css';
import tones from './tones.module.css';

const TONE_NAME: Record<Tone, MessageKey> = {
  radiant: 'side.radiant',
  dire: 'side.dire',
  neutral: 'side.neutral',
  upper: 'list.upper',
  abyss: 'list.abyss',
};

/**
 * Легенда нитей на карте (#254, SPEC §6.6): пока на карте путь героя — что значат линия, стрелка,
 * значки событий и цвет. Строки — только то, что есть у этих нитей. На компьютере — всегда раскрыта
 * в левом верхнем углу карты, под строкой пути; на телефоне — кнопка «?» в правом верхнем углу, раскрывается по нажатию.
 */
export function ThreadLegend({ threads, top = 0 }: { threads: HeroThreads; /** Низ строки пути или поиска над кадром, px: легенда — под ней. */ top?: number }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const { kinds, events, tone } = legendRows(threads);
  const title = t('legend.title');
  return (
    <section
      className={[styles.legend, tones[tone]].join(' ')}
      aria-label={title}
      data-testid="thread-legend"
      data-open={open || undefined}
      style={{ '--top': `${top}px` } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t('hero.legend')}
        title={t('hero.legend')}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '×' : '?'}
      </button>
      <div id={listId} className={styles.body}>
        <p className={styles.title} aria-hidden="true">
          {title}
        </p>
        <ul className={styles.list}>
          {kinds.map((k) => (
            <li key={k} data-legend-kind={k}>
              <LineSample kind={k} />
              {t(k === 'path' ? 'hero.legendPath' : 'hero.legendAside')}
            </li>
          ))}
          {events.map((e) => (
            <li key={e} data-legend-event={e}>
              <svg className={styles.badge} viewBox="-15 -15 30 30" width="24" height="24" aria-hidden="true" focusable="false">
                <circle r="14" />
                <svg x={-11} y={-11} width={22} height={22} viewBox="0 0 24 24">
                  <path d={EVENT_PATHS[e]} />
                </svg>
              </svg>
              {t(`hero.event.${e}`)}
            </li>
          ))}
          <li data-legend-tone={tone}>
            <span className={styles.swatch} aria-hidden="true" />
            {t('legend.tone', { side: t(TONE_NAME[tone]) })}
          </li>
        </ul>
      </div>
    </section>
  );
}

/** Образец линии: сплошная со стрелкой — шаг пути, пунктир — прочая связь. Цвет — цвет нитей. */
function LineSample({ kind }: { kind: StepKind }) {
  return (
    <svg className={styles.line} viewBox="0 0 32 12" width="32" height="12" aria-hidden="true" focusable="false">
      <path d="M2 6h26" strokeDasharray={kind === 'aside' ? '5 3' : undefined} />
      {kind === 'path' && <path className={styles.arrow} d="M17 2 24 6l-7 4 2-4Z" />}
    </svg>
  );
}
