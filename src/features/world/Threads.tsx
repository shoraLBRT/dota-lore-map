import type { CSSProperties } from 'react';
import type { Spot } from '../search/search';
import styles from './MapStage.module.css';
import { STAGE_HEIGHT, STAGE_WIDTH } from './camera';
import { arc } from './threadGeometry';

const STAGE = (p: [number, number]) => [p[0] * STAGE_WIDTH, p[1] * STAGE_HEIGHT] as const;

interface Props {
  /** Места героя по порядку; нить соединяет соседние. Меньше двух точек — ничего. */
  spots: Spot[];
  /** Единиц сцены на экранный px: толщина и пунктир не зависят от приближения. */
  scale: number;
}

/**
 * Нити (SPEC §6.6, A5): светящиеся пунктирные дуги цвета стороны первого места,
 * прорисовка за --dur-thread, затем течение пунктира; на концах — вспышка.
 */
export function Threads({ spots, scale }: Props) {
  const placed = spots.filter((s): s is Spot & { point: [number, number] } => s.point !== undefined);
  if (placed.length < 2) return null;
  const arcs = placed.slice(1).map((s, i) => arc(placed[i]!.point, s.point));
  const k = scale.toFixed(4);
  return (
    <g className={[styles.threads, styles[placed[0]!.tone]].join(' ')} aria-hidden="true" data-testid="threads">
      {arcs.map((a, i) => (
        <path
          key={i}
          className={styles.thread}
          d={a.d}
          style={
            {
              '--len': a.length.toFixed(1),
              '--dash': (7 * scale).toFixed(2),
              '--w': (2.2 * scale).toFixed(2),
            } as CSSProperties
          }
        />
      ))}
      {placed.map((s) => {
        const [x, y] = STAGE(s.point);
        return (
          <g key={s.key} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k})`}>
            <circle className={styles.flash} r={12} />
          </g>
        );
      })}
    </g>
  );
}
