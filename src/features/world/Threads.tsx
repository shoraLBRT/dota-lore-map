import type { CSSProperties } from 'react';
import { EVENT_PATHS } from '../../components/EventIcon';
import { stepBadge, type HeroThreads } from '../search/threads';
import styles from './Threads.module.css';
import tones from './tones.module.css';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';
import type { Box } from './labels';
import { arc, badgeAt } from './threadGeometry';

const STAGE = (p: [number, number]) => [p[0] * STAGE_WIDTH, p[1] * STAGE_HEIGHT] as const;

/** Радиус значка события, экранные px: круг 30 px, поле значка — BADGE_ICON px (#254: не меньше 20 px; было 22 и 15). */
export const BADGE_R = 15;
/** Сторона значка события внутри круга, экранные px. */
export const BADGE_ICON = 22;
/** Короче (экранные px) — значка на нити нет: он закрыл бы её целиком. */
const MIN_BADGE_LEN = 64;
/** Короче — нет и стрелки. */
const MIN_ARROW_LEN = 24;
/** Просвет между значком и стрелкой, экранные px. */
const ARROW_GAP = 7;
/** Радиус вспышки на конце нити, экранные px. */
const FLASH_R = 12;
/** Мир на телефоне (#102): регионы там ≈ 40 px, вспышки и значки в полный размер закрыли бы их подписи. */
export const COMPACT_MARKS = 0.6;

interface Props {
  threads: HeroThreads;
  /** Единиц сцены на экранный px: толщина, пунктир, значки и стрелки не зависят от приближения. */
  scale: number;
  /** Подписи и кольца маркеров в координатах сцены: значок события на них не встаёт (#67). */
  obstacles?: Box[];
  /** Видимая часть кадра в координатах сцены — без панели, шторки и плашки героя: значок встаёт только в ней. */
  clip?: Box;
  /** Мир на телефоне (#102): вспышки и значки — в COMPACT_MARKS размера. */
  compact?: boolean;
}

const fixed = (n: number) => n.toFixed(1);

/**
 * Нити (SPEC §6.6, A5, A11): светящиеся дуги цвета стороны первого места, прорисовка за --dur-thread.
 * Шаг пути — сплошная со стрелкой «откуда → куда»; прочая связь — пунктир, он течёт (reduced motion — нет).
 * У нити — значок события места, куда она ведёт (#67); на концах — вспышка.
 */
export function Threads({ threads, scale, obstacles = [], clip, compact = false }: Props) {
  const { steps, tone } = threads;
  const k = scale.toFixed(4);
  // Значки и вспышки: масштаб сцены, на телефоне в мире — ещё и меньше (#102).
  const m = compact ? COMPACT_MARKS : 1;
  const km = (scale * m).toFixed(4);
  const badgeR = BADGE_R * m;
  const ends = new Map(steps.flatMap((s) => [s.from, s.to]).map((s) => [s.key, s]));
  return (
    <g className={[styles.threads, tones[tone]].join(' ')} aria-hidden="true" data-testid="threads" data-tone={tone}>
      {steps.map((step, i) => {
        const a = arc(step.from.point!, step.to.point!);
        const style = {
          '--len': a.length.toFixed(1),
          '--dash': (7 * scale).toFixed(2),
          '--w': (2.2 * scale).toFixed(2),
        } as CSSProperties;
        const len = a.length / scale;
        // Передвижение без события (`journey`) — без значка: его показывают линия и стрелка (#254).
        const badge = stepBadge(step);
        const badgeT = badge && len >= MIN_BADGE_LEN * m ? badgeAt(a, badgeR * scale, obstacles, clip) : null;
        const arrowT =
          step.kind === 'path' && len >= MIN_ARROW_LEN
            ? badgeT === null
              ? 0.5
              : Math.min(badgeT + ((badgeR + ARROW_GAP) * scale) / a.length, 0.88)
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
              className={[styles.thread, step.kind === 'aside' && styles.threadAside].filter(Boolean).join(' ')}
              d={a.d}
              style={style}
              data-thread=""
            />
            {arrowT !== null && (
              <g transform={`${at(arrowT)} rotate(${a.angle(arrowT).toFixed(1)}) scale(${k})`}>
                <path className={styles.threadArrow} d="M-5 -4.5 4.5 0-5 4.5-2.5 0Z" data-arrow="" />
              </g>
            )}
            {badge && badgeT !== null && (
              <g transform={`${at(badgeT)} scale(${km})`} className={styles.threadBadge} data-badge={badge}>
                <circle r={BADGE_R} />
                <svg x={-BADGE_ICON / 2} y={-BADGE_ICON / 2} width={BADGE_ICON} height={BADGE_ICON} viewBox="0 0 24 24">
                  <path d={EVENT_PATHS[badge]} />
                </svg>
              </g>
            )}
          </g>
        );
      })}
      {[...ends.values()].map((s) => {
        const [x, y] = STAGE(s.point!);
        return (
          <g key={s.key} transform={`translate(${fixed(x)} ${fixed(y)}) scale(${km})`}>
            <circle className={styles.flash} r={FLASH_R} />
          </g>
        );
      })}
    </g>
  );
}
