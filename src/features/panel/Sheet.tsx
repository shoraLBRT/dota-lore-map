import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { PanelFrame } from '../../components/PanelFrame';
import { useT } from '../../i18n';
import { SHEET_FULL, SHEET_PEEK } from '../world/camera';
import styles from './Sheet.module.css';

/** Сдвиг пальца, после которого это перетаскивание, а не тап, px. */
const DRAG_MIN = 6;
/** Скорость броска, px/мс: отпустили быстрее — шторка уходит по направлению броска, а не к ближайшему положению. */
const FLICK = 0.5;
/** Окно, по которому считается скорость в конце перетаскивания, мс. */
const FLICK_WINDOW = 100;
/** #230, Н9: высота шторки «только заголовок» — ручка и шапка с названием и ×, px (как `.head` в CSS). */
export const SHEET_HEAD_PX = 96;

/** Положение шторки: заголовок (видна карта), средняя (половина экрана, по ней кадрирует камера), весь экран. */
export type SheetPos = 'head' | 'peek' | 'full';
const ORDER: SheetPos[] = ['head', 'peek', 'full'];

/**
 * #230, Н9: куда встать после перетаскивания из трёх положений. Бросок — на шаг по направлению
 * броска от текущей высоты (вниз из заголовка — закрыть), медленно — ближайшее; ниже ~60 % заголовка — закрыть.
 */
export function settleSheet(height: number, viewport: number, velocity: number): SheetPos | 'close' {
  const stops = [SHEET_HEAD_PX, SHEET_PEEK * viewport, SHEET_FULL * viewport];
  if (Math.abs(velocity) >= FLICK) {
    if (velocity < 0) return ORDER[stops.findIndex((s) => s > height + 1)] ?? 'full';
    let below = -1;
    stops.forEach((s, i) => {
      if (s < height - 1) below = i;
    });
    return below >= 0 ? ORDER[below]! : 'close';
  }
  if (height < SHEET_HEAD_PX * 0.6) return 'close';
  let best = 0;
  stops.forEach((s, i) => {
    if (Math.abs(s - height) < Math.abs(stops[best]! - height)) best = i;
  });
  return ORDER[best]!;
}

interface Props {
  id: string;
  label: string;
  contentKey: string;
  header: ReactNode;
  /** Свайп вниз из заголовка закрывает шторку — шаг вверх (#230, Н9). */
  onClose: () => void;
  children: ReactNode;
}

const HEIGHT: Record<SheetPos, (vh: number) => number> = {
  head: () => SHEET_HEAD_PX,
  peek: (vh) => SHEET_PEEK * vh,
  full: (vh) => SHEET_FULL * vh,
};

/**
 * Нижняя шторка вместо правой панели на телефоне (SPEC §13): три положения — заголовок, половина экрана, ~90 %.
 * Ручка: тап переключает, «потянуть» меняет высоту, отпустили — шторка встаёт в ближайшее положение
 * или, если её бросили, — по направлению броска (инерция, SPEC §7.5).
 * Новый регион или место — снова свёрнута, чтобы была видна карта.
 */
export function Sheet({ id, label, contentKey, header, onClose, children }: Props) {
  const { t } = useT();
  const [state, setState] = useState<{ key: string; pos: SheetPos }>({ key: contentKey, pos: 'peek' });
  const pos: SheetPos = state.key === contentKey ? state.pos : 'peek';
  const full = pos === 'full';
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number; moved: boolean; trail: { y: number; t: number }[] } | null>(null);
  /** Только что тянули: следующий click — конец перетаскивания, а не тап. */
  const dragged = useRef(false);

  // Свёрнутая шторка прокручивается к началу: после разворота текст снова сверху.
  useEffect(() => {
    // Прокручивается внутренний блок рамки — последний: над ним может стоять шапка.
    if (!full) document.getElementById(id)?.lastElementChild?.scrollTo?.({ top: 0 });
  }, [full, id]);

  const set = (next: SheetPos) => setState({ key: contentKey, pos: next });

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    const vh = window.innerHeight || 1;
    start.current = {
      y: e.clientY,
      h: HEIGHT[pos](vh),
      moved: false,
      trail: [{ y: e.clientY, t: e.timeStamp }],
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    s.trail = [...s.trail.filter((p) => e.timeStamp - p.t <= FLICK_WINDOW), { y: e.clientY, t: e.timeStamp }];
    if (!s.moved && Math.abs(dy) < DRAG_MIN) return;
    s.moved = true;
    const vh = window.innerHeight || 1;
    setDrag(Math.min(Math.max(s.h - dy, 0), vh * 0.95));
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.moved || drag === null) {
      setDrag(null);
      return;
    }
    dragged.current = true;
    const first = s.trail[0]!;
    const last = s.trail[s.trail.length - 1]!;
    const velocity = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
    const vh = window.innerHeight || 1;
    setDrag(null);
    const next = settleSheet(drag, vh, velocity);
    if (next === 'close') onClose();
    else set(next);
  };

  const style = { '--sheet-h': drag !== null ? `${Math.round(drag)}px` : undefined } as CSSProperties;

  return (
    <div
      className={[styles.sheet, full && styles.full, pos === 'head' && styles.head, drag !== null && styles.dragging]
        .filter(Boolean)
        .join(' ')}
      style={style}
      data-testid="panel-sheet"
      data-state={pos}
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
          set(full ? 'peek' : pos === 'head' ? 'peek' : 'full');
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className={styles.grip} aria-hidden="true" />
      </button>
      <PanelFrame id={id} label={label} className={styles.frame} header={header}>
        {children}
      </PanelFrame>
    </div>
  );
}
