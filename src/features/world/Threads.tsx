import type { CSSProperties } from 'react';
import { EVENT_PATHS, hasBadge } from '../../components/EventIcon';
import type { HeroThreads } from '../search/threads';
import styles from './MapStage.module.css';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';
import type { Box } from './labels';
import { arc, badgeAt } from './threadGeometry';

const STAGE = (p: [number, number]) => [p[0] * STAGE_WIDTH, p[1] * STAGE_HEIGHT] as const;

/** Радиус значка события, экранные px. */
export const BADGE_R = 11;
/** Короче (экранные px) — значка на нити нет: он закрыл бы её целиком. */
const MIN_BADGE_LEN = 56;
/** Короче — нет и стрелки. */
const MIN_ARROW_LEN = 24;
/** Просвет между значком и стрелкой, экранные px. */
const ARROW_GAP = 7;

interface Props {
  threads: HeroThreads;
  /** Единиц сцены на экранный px: толщина, пунктир, значки и стрелки не зависят от приближения. */
  scale: number;
  /** Подписи и кольца маркеров в координатах сцены: значок события на них не встаёт (#67). */
  obstacles?: Box[];
  /** Видимая часть кадра в координатах сцены — без панели, шторки и плашки героя: значок встаёт только в ней. */
  clip?: Box;
}

const fixed = (n: number) => n.toFixed(1);

/**
 * Нити (SPEC §6.6, A5, A11): светящиеся дуги цвета стороны первого места, прорисовка за --dur-thread.
 * Шаг пути — сплошная со стрелкой «откуда → куда»; прочая связь — пунктир, он течёт (reduced motion — нет).
 * У нити — значок события места, куда она ведёт (#67); на концах — вспышка.
 */
export function Threads({ threads, scale, obstacles = [], clip }: Props) {
  const { steps, tone } = threads;
  const k = scale.toFixed(4);
  const ends = new Map(steps.flatMap((s) => [s.from, s.to]).map((s) => [s.key, s]));
  return (
    <g className={[styles.threads, styles[tone]].join(' ')} aria-hidden="true" data-testid="threads">
      {steps.map((step, i) => {
        const a = arc(step.from.point!, step.to.point!);
        const style = {
          '--len': a.length.toFixed(1),
          '--dash': (7 * scale).toFixed(2),
          '--w': (2.2 * scale).toFixed(2),
        } as CSSProperties;
        const len = a.length / scale;
        const badgeT = hasBadge(step.event) && len >= MIN_BADGE_LEN ? badgeAt(a, BADGE_R * scale, obstacles, clip) : null;
        const arrowT =
          step.kind === 'path' && len >= MIN_ARROW_LEN
            ? badgeT === null
              ? 0.5
              : Math.min(badgeT + ((BADGE_R + ARROW_GAP) * scale) / a.length, 0.88)
            : null;
        const at = (t: number) => {
          const [x, y] = a.stage(t);
          return `translate(${fixed(x)} ${fixed(y)})`;
        };
        // Тёмная подложка под нитью: нить того же цвета, что и подсветка регионов героя, иначе теряется (аудит E13).
        return (
          <g key={`${i}:${step.from.key}>${step.to.key}`} data-step={step.kind} data-event={step.event}>
            <path className={styles.threadCasing} d={a.d} style={style} />
            <path
              className={[styles.thread, step.kind === 'link' && styles.threadLink].filter(Boolean).join(' ')}
              d={a.d}
              style={style}
              data-thread=""
            />
            {arrowT !== null && (
              <g transform={`${at(arrowT)} rotate(${a.angle(arrowT).toFixed(1)}) scale(${k})`}>
                <path className={styles.threadArrow} d="M-5 -4.5 4.5 0-5 4.5-2.5 0Z" data-arrow="" />
              </g>
            )}
            {badgeT !== null && hasBadge(step.event) && (
              <g transform={`${at(badgeT)} scale(${k})`} className={styles.threadBadge} data-badge={step.event}>
                <circle r={BADGE_R} />
                <svg x={-7.5} y={-7.5} width={15} height={15} viewBox="0 0 24 24">
                  <path d={EVENT_PATHS[step.event]} />
                </svg>
              </g>
            )}
          </g>
        );
      })}
      {[...ends.values()].map((s) => {
        const [x, y] = STAGE(s.point!);
        return (
          <g key={s.key} transform={`translate(${fixed(x)} ${fixed(y)}) scale(${k})`}>
            <circle className={styles.flash} r={12} />
          </g>
        );
      })}
    </g>
  );
}
