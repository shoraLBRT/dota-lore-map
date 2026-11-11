import type { CSSProperties } from 'react';
import { partOffset, type Cloud } from './clouds';
import styles from './Clouds.module.css';

interface Props {
  clouds: Cloud[];
  /** veil — пелена интро; drift — дрейф по краям мира (A7). */
  mode: 'veil' | 'drift';
  /** A1: облака разъезжаются к краям и тают. */
  parting?: boolean;
  hidden?: boolean;
  className?: string;
}

type CloudStyle = CSSProperties & Record<`--${string}`, string | number>;

/** Слой облаков поверх карты (ARCHITECTURE A9). Не перехватывает мышь, скрыт от скринридеров. */
export function Clouds({ clouds, mode, parting = false, hidden = false, className }: Props) {
  const cls = [styles.clouds, styles[mode], parting && styles.parting, hidden && styles.hidden, className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} aria-hidden="true" data-testid={`clouds-${mode}`}>
      {clouds.map((c, i) => {
        const { dx, dy } = partOffset(c);
        const style: CloudStyle = {
          '--x': c.x,
          '--y': c.y,
          '--w': c.w,
          '--dx': dx,
          '--dy': dy,
          // Сдвиг фазы дрейфа, чтобы облака одного слоя не двигались строем.
          '--phase': `${-(i * 7) % 40}s`,
        };
        return <span key={i} className={`${styles.cloud} ${styles[`layer${c.layer}`]}`} style={style} />;
      })}
    </div>
  );
}
