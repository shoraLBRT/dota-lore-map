import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { PanelFrame } from '../../components/PanelFrame';
import { useT } from '../../i18n';
import { SHEET_FULL, SHEET_PEEK } from '../world/camera';
import styles from './Sheet.module.css';

/** Сдвиг пальца, после которого это перетаскивание, а не тап, px. */
const DRAG_MIN = 6;

interface Props {
  id: string;
  label: string;
  contentKey: string;
  children: ReactNode;
}

/**
 * Нижняя шторка вместо правой панели на телефоне (SPEC §13): свёрнута ~30 % высоты, развёрнута ~90 %.
 * Ручка: тап переключает, «потянуть» меняет высоту, отпустили — шторка встаёт в ближайшее положение.
 * Новый регион или место — снова свёрнута, чтобы была видна карта.
 */
export function Sheet({ id, label, contentKey, children }: Props) {
  const { t } = useT();
  const [state, setState] = useState<{ key: string; full: boolean }>({ key: contentKey, full: false });
  const full = state.key === contentKey && state.full;
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  /** Только что тянули: следующий click — конец перетаскивания, а не тап. */
  const dragged = useRef(false);

  // Свёрнутая шторка прокручивается к началу: после разворота текст снова сверху.
  useEffect(() => {
    // Прокручивается внутренний блок рамки.
    if (!full) document.getElementById(id)?.firstElementChild?.scrollTo?.({ top: 0 });
  }, [full, id]);

  const set = (next: boolean) => setState({ key: contentKey, full: next });

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    const vh = window.innerHeight || 1;
    start.current = { y: e.clientY, h: (full ? SHEET_FULL : SHEET_PEEK) * vh, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    if (!s.moved && Math.abs(dy) < DRAG_MIN) return;
    s.moved = true;
    const vh = window.innerHeight || 1;
    setDrag(Math.min(Math.max(s.h - dy, vh * 0.15), vh * 0.95));
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.moved || drag === null) {
      setDrag(null);
      return;
    }
    dragged.current = true;
    const vh = window.innerHeight || 1;
    set(drag > ((SHEET_PEEK + SHEET_FULL) / 2) * vh);
    setDrag(null);
  };

  const style = { '--sheet-h': drag !== null ? `${Math.round(drag)}px` : undefined } as CSSProperties;

  return (
    <div
      className={[styles.sheet, full && styles.full, drag !== null && styles.dragging].filter(Boolean).join(' ')}
      style={style}
      data-testid="panel-sheet"
      data-state={full ? 'full' : 'peek'}
    >
      <button
        type="button"
        className={styles.handle}
        aria-label={t(full ? 'panel.collapse' : 'panel.expand')}
        aria-expanded={full}
        aria-controls={id}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          set(!full);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className={styles.grip} aria-hidden="true" />
      </button>
      <PanelFrame id={id} label={label} className={styles.frame}>
        {children}
      </PanelFrame>
    </div>
  );
}
