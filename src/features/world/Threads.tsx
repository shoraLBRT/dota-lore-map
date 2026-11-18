import { useId, type CSSProperties, type ReactNode } from 'react';
import { EVENT_PATHS } from '../../components/EventIcon';
import type { HeroEvent } from '../../data/types';
import type { HeroThreads, ThreadStep } from '../search/threads';
import styles from './Threads.module.css';
import tones from './tones.module.css';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';
import type { Box } from './labels';
import { arc, badgeAt, chevronsAt, ribbon, segment, type Arc } from './threadGeometry';
import { DEFAULT_THREAD_STYLE, stepTimings, type StepTiming, type ThreadStyle } from './threadStyle';

const STAGE = (p: [number, number]) => [p[0] * STAGE_WIDTH, p[1] * STAGE_HEIGHT] as const;

/** Радиус значка события, экранные px. */
export const BADGE_R = 11;
/** Короче (экранные px) — значка на нити нет: он закрыл бы её целиком. */
const MIN_BADGE_LEN = 56;
/** Короче — нет и стрелки. */
const MIN_ARROW_LEN = 24;
/** Просвет между значком и стрелкой, экранные px (рисунок #67). */
const ARROW_GAP = 7;
/** Радиус вспышки на конце нити, экранные px. */
const FLASH_R = 12;
/** Мир на телефоне (#102): регионы там ≈ 40 px, вспышки и значки в полный размер закрыли бы их подписи. */
export const COMPACT_MARKS = 0.6;
/** Наконечник на телефоне в мире (#168): чуть меньше, но различим. */
const COMPACT_TIP = 0.8;
/** Длина наконечника пути (#168), экранные px: остриё — у вспышки места, куда ведёт шаг. */
export const TIP_LEN = 17;
/** Шаг шевронов каравана, экранные px. */
const CHEVRON_STEP = 42;

interface Props {
  threads: HeroThreads;
  /** Единиц сцены на экранный px: толщина, пунктир, значки и стрелки не зависят от приближения. */
  scale: number;
  /** Подписи и кольца маркеров в координатах сцены: значок события на них не встаёт (#67). */
  obstacles?: Box[];
  /** Видимая часть кадра в координатах сцены — без панели, шторки и плашки героя: значок встаёт только в ней. */
  clip?: Box;
  /** Мир на телефоне (#102): вспышки и значки — в COMPACT_MARKS размера, значков меньше (#168). */
  compact?: boolean;
  /** Рисунок пути (#168): вариант на выбор владельца. */
  variant?: ThreadStyle;
}

const fixed = (n: number) => n.toFixed(1);

interface StepCtx {
  step: ThreadStep;
  i: number;
  a: Arc;
  timing: StepTiming;
  scale: number;
  m: number;
  badgeT: number | null;
  badge: ReactNode;
  maskId: string;
}

/** Значок события (#67): кружок на нити и знак события; проявляется, когда до него дошла прорисовка. */
function Badge({ x, y, k, event }: { x: number; y: number; k: string; event: HeroEvent }) {
  return (
    <g transform={`translate(${fixed(x)} ${fixed(y)}) scale(${k})`} className={styles.threadBadge} data-badge={event}>
      <g className={styles.pop}>
        <circle r={BADGE_R} />
        <svg x={-7.5} y={-7.5} width={15} height={15} viewBox="0 0 24 24">
          <path d={EVENT_PATHS[event]} />
        </svg>
      </g>
    </g>
  );
}

/**
 * Наконечник «перо» (#168): остриё в (0, 0), вырез сзади, светлая грань сверху — как стрелка на старой карте,
 * а не плоский треугольник. Единицы — экранные px до масштаба.
 */
const TIP = `M0 0 L${-TIP_LEN} ${-TIP_LEN * 0.55} L${-TIP_LEN * 0.66} 0 L${-TIP_LEN} ${TIP_LEN * 0.55}Z`;
const TIP_LIT = `M0 0 L${-TIP_LEN} ${-TIP_LEN * 0.55} L${-TIP_LEN * 0.66} 0Z`;

/** Шаг пути или прочая связь в новом рисунке (#168): лента или караван, раскрываются маской по порядку. */
function NewStep({ step, i, a, timing, scale, m, badgeT, badge, maskId, variant }: StepCtx & { variant: 'ribbon' | 'caravan' }) {
  const len = a.length;
  const px = (n: number) => n * scale;
  const path = step.kind === 'path';
  const tipM = m === 1 ? 1 : COMPACT_TIP;
  const tip = path && len / scale >= MIN_ARROW_LEN;
  // Концы — не под кольцом маркера: начало чуть отступает, остриё касается вспышки.
  const s0 = px(5 * m);
  const s1 = len - px(FLASH_R * m + 1.5);
  if (s1 <= s0) return null;
  const t0 = a.tAt(s0);
  const t1 = a.tAt(s1);
  // Лента кончается под вырезом наконечника.
  const sLine = tip ? s1 - px(TIP_LEN * tipM * 0.55) : s1;
  const tLine = a.tAt(sLine);
  const line = segment(a, t0, tLine);
  const reveal = segment(a, t0, t1);
  const style = {
    '--d': timing.delay.toFixed(3),
    '--s': timing.dur.toFixed(3),
    '--len': reveal.length.toFixed(1),
    '--len2': (reveal.length * 2 + 10).toFixed(1),
    '--w': px(2.2).toFixed(2),
    '--dot': px(1.8).toFixed(2),
    '--gap': px(5.5).toFixed(2),
    '--dash': px(6).toFixed(2),
    '--dash-gap': px(4.5).toFixed(2),
    '--run-w': px(5 * (m === 1 ? 1 : 0.8)).toFixed(2),
    '--i': i,
  } as CSSProperties;
  const [tx, ty] = a.stage(t1);
  const tipAngle = a.angle(t1).toFixed(1);
  const badgeGap = badgeT === null ? undefined : ((BADGE_R * m + 6) * scale) / len;

  let body: ReactNode;
  if (!path) {
    // Прочая связь: пунктир точками по тёмной подложке, без стрелки и бегущей точки.
    body = (
      <>
        <path className={styles.asideCasing} d={line.d} />
        <path className={styles.asideDots} d={line.d} data-thread="" />
      </>
    );
  } else if (variant === 'ribbon') {
    body = (
      <>
        <path className={styles.ribbon} d={ribbon(a, t0, tLine, px(6.4), px(2))} data-thread="" />
        <path className={styles.ribbonCore} d={segment(a, t0, a.tAt(s0 + (sLine - s0) * 0.75)).d} />
      </>
    );
  } else {
    const chevrons = chevronsAt(
      a,
      s0 + px(10),
      s1 - px(TIP_LEN * tipM + 6),
      px(CHEVRON_STEP),
      badgeT === null || badgeGap === undefined ? undefined : [badgeT - badgeGap, badgeT + badgeGap],
    );
    body = (
      <>
        <path className={styles.caravanCasing} d={line.d} />
        <path className={styles.caravanDash} d={line.d} data-thread="" />
        {chevrons.map((t) => {
          const [x, y] = a.stage(t);
          return (
            <path
              key={t.toFixed(3)}
              className={styles.chevron}
              transform={`translate(${fixed(x)} ${fixed(y)}) rotate(${a.angle(t).toFixed(1)}) scale(${scale.toFixed(4)})`}
              d="M-2.5 -4 1.5 0-2.5 4"
              data-chevron=""
            />
          );
        })}
      </>
    );
  }

  return (
    <g
      data-step={step.kind}
      data-event={step.event}
      data-variant={variant}
      style={style}
      className={styles.step}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={STAGE_WIDTH} height={STAGE_HEIGHT}>
        <path className={styles.reveal} d={reveal.d} style={{ strokeWidth: px(16) }} />
      </mask>
      <g mask={`url(#${maskId})`}>{body}</g>
      {path && <path className={styles.runner} d={reveal.d} data-runner="" />}
      {tip && (
        <g transform={`translate(${fixed(tx)} ${fixed(ty)}) rotate(${tipAngle}) scale(${(scale * tipM).toFixed(4)})`}>
          <g className={[styles.tip, styles.pop].join(' ')} data-arrow="">
            <path className={styles.tipBody} d={TIP} />
            <path className={styles.tipLit} d={TIP_LIT} />
          </g>
        </g>
      )}
      {badge}
    </g>
  );
}

/** Шаг в рисунке #67 (вариант `legacy`): дуга, стрелка-треугольник за значком, течение пунктира. */
function LegacyStep({ step, a, scale, m, badgeT, badge }: StepCtx) {
  const style = {
    '--len': a.length.toFixed(1),
    '--dash': (7 * scale).toFixed(2),
    '--w': (2.2 * scale).toFixed(2),
  } as CSSProperties;
  const len = a.length / scale;
  const badgeR = BADGE_R * m;
  const arrowT =
    step.kind === 'path' && len >= MIN_ARROW_LEN
      ? badgeT === null
        ? 0.5
        : Math.min(badgeT + ((badgeR + ARROW_GAP) * scale) / a.length, 0.88)
      : null;
  const [ax, ay] = arrowT === null ? [0, 0] : a.stage(arrowT);
  // Тёмная подложка под нитью: нить того же цвета, что и подсветка регионов героя, иначе теряется (аудит E13).
  return (
    <g data-step={step.kind} data-event={step.event} data-variant="legacy">
      <path className={styles.threadCasing} d={a.d} style={style} />
      <path
        className={[styles.thread, step.kind === 'aside' && styles.threadAside].filter(Boolean).join(' ')}
        d={a.d}
        style={style}
        data-thread=""
      />
      {arrowT !== null && (
        <g transform={`translate(${fixed(ax)} ${fixed(ay)}) rotate(${a.angle(arrowT).toFixed(1)}) scale(${scale.toFixed(4)})`}>
          <path className={styles.threadArrow} d="M-5 -4.5 4.5 0-5 4.5-2.5 0Z" data-arrow="" />
        </g>
      )}
      {badge}
    </g>
  );
}

/**
 * Нити (SPEC §6.6, A5, A11): пути героя цвета стороны первого места поверх арта.
 * Шаг пути — со стрелкой «откуда → куда»; прочая связь — пунктир без стрелки; у нити — значок события места,
 * куда она ведёт (#67); на концах — вспышка. Рисунок — `variant` (#168): лента с сужением или караван
 * прорисовываются шаг за шагом по порядку остановок, по пути бежит светящаяся точка; `legacy` — рисунок #67.
 * Reduced motion — всё сразу целиком, без бегущих эффектов.
 */
export function Threads({ threads, scale, obstacles = [], clip, compact = false, variant = DEFAULT_THREAD_STYLE }: Props) {
  const { steps, tone } = threads;
  const uid = useId().replace(/:/g, '');
  // Значки и вспышки: масштаб сцены, на телефоне в мире — ещё и меньше (#102).
  const m = compact ? COMPACT_MARKS : 1;
  const km = (scale * m).toFixed(4);
  const badgeR = BADGE_R * m;
  const legacy = variant === 'legacy';
  const timings = legacy ? steps.map(() => ({ delay: 0, dur: 1 })) : stepTimings(steps.map((s) => s.kind));
  // Вспышка на месте — когда до него дошла прорисовка.
  const ends = new Map<string, { spot: ThreadStep['from']; at: number }>();
  const reach = (spot: ThreadStep['from'], at: number) => {
    const was = ends.get(spot.key);
    if (!was || at < was.at) ends.set(spot.key, { spot, at });
  };
  steps.forEach((s, i) => {
    reach(s.from, timings[i]!.delay);
    reach(s.to, timings[i]!.delay + timings[i]!.dur);
  });
  return (
    <g className={[styles.threads, tones[tone]].join(' ')} aria-hidden="true" data-testid="threads" data-variant={variant}>
      {steps.map((step, i) => {
        const a = arc(step.from.point!, step.to.point!);
        const len = a.length / scale;
        // Телефон (#168): значки реже — только у шагов пути и на нити не короче полного порога.
        const wantBadge = compact && !legacy ? step.kind === 'path' && len >= MIN_BADGE_LEN : len >= MIN_BADGE_LEN * m;
        // Значок не встаёт на наконечник (#168): от конца — вспышка, наконечник и просвет.
        const tail = legacy || step.kind === 'aside' ? badgeR : FLASH_R * m + TIP_LEN * (compact ? COMPACT_TIP : 1) + 6;
        const badgeT = wantBadge ? badgeAt(a, badgeR * scale, obstacles, clip, tail * scale) : null;
        const [bx, by] = badgeT === null ? [0, 0] : a.stage(badgeT);
        const badge =
          badgeT === null ? null : (
            <g
              className={styles.badgeAt}
              style={{ '--at': (legacy ? 0.6 : timings[i]!.delay + timings[i]!.dur * badgeT).toFixed(3) } as CSSProperties}
            >
              <Badge x={bx} y={by} k={km} event={step.event} />
            </g>
          );
        const ctx: StepCtx = { step, i, a, timing: timings[i]!, scale, m, badgeT, badge, maskId: `${uid}-t${i}` };
        const key = `${i}:${step.from.key}>${step.to.key}`;
        return legacy ? <LegacyStep key={key} {...ctx} /> : <NewStep key={key} {...ctx} variant={variant} />;
      })}
      {[...ends.values()].map(({ spot, at }) => {
        const [x, y] = STAGE(spot.point!);
        return (
          <g key={spot.key} transform={`translate(${fixed(x)} ${fixed(y)}) scale(${km})`}>
            <circle className={styles.flash} r={FLASH_R} style={{ '--at': (legacy ? 0 : at).toFixed(3) } as CSSProperties} />
          </g>
        );
      })}
    </g>
  );
}
