import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
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
 * Нижняя шторка вместо правой панели на телефоне (SPEC §13): три положения — заголовок, половина экрана, ~80 %.
 * Ручка: тап переключает, «потянуть» меняет высоту (как и свайп по тексту, пока шторка не наверху, #253), отпустили — шторка встаёт в ближайшее положение
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
  /** Высота во время перетаскивания — для конца жеста (состояние `drag` в слушателях может быть старым). */
  const dragH = useRef<number | null>(null);
  /** Только что тянули: следующий click — конец перетаскивания, а не тап. */
  const dragged = useRef(false);
  /** Текущие значения для нативных слушателей касаний (#253): они вешаются один раз. */
  const live = useRef({ pos, onClose, contentKey });
  useLayoutEffect(() => {
    live.current = { pos, onClose, contentKey };
  });

  // Свёрнутая шторка прокручивается к началу: после разворота текст снова сверху.
  useEffect(() => {
    // Прокручивается внутренний блок рамки — последний: над ним может стоять шапка.
    if (!full) document.getElementById(id)?.lastElementChild?.scrollTo?.({ top: 0 });
  }, [full, id]);

  // Перетаскивание — общее для ручки (pointer) и текста шторки (touch, #253); читает только ref и сеттеры.
  const gesture = useRef({
    begin(y: number, t: number) {
      const vh = window.innerHeight || 1;
      start.current = { y, h: HEIGHT[live.current.pos](vh), moved: false, trail: [{ y, t }] };
    },
    /** Палец сдвинулся; true — это уже перетаскивание шторки. */
    move(y: number, t: number): boolean {
      const s = start.current;
      if (!s) return false;
      const dy = y - s.y;
      s.trail = [...s.trail.filter((p) => t - p.t <= FLICK_WINDOW), { y, t }];
      if (!s.moved && Math.abs(dy) < DRAG_MIN) return false;
      s.moved = true;
      const vh = window.innerHeight || 1;
      dragH.current = Math.min(Math.max(s.h - dy, 0), vh * 0.95);
      setDrag(dragH.current);
      return true;
    },
    /** Отпустили; true — это было перетаскивание, шторка встала в новое положение. */
    finish(): boolean {
      const s = start.current;
      const h = dragH.current;
      start.current = null;
      dragH.current = null;
      setDrag(null);
      if (!s?.moved || h === null) return false;
      const first = s.trail[0]!;
      const last = s.trail[s.trail.length - 1]!;
      const velocity = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
      const next = settleSheet(h, window.innerHeight || 1, velocity);
      if (next === 'close') live.current.onClose();
      else setState({ key: live.current.contentKey, pos: next });
      return true;
    },
  });

  // #253: свайп по тексту шторки. Пока шторка не наверху, палец тянет её целиком и текст не прокручивается;
  // наверху текст прокручивается, а свайп вниз, когда текст прокручен к началу, опускает шторку.
  // Нативные слушатели с passive: false — только так touchmove может отменить прокрутку (iOS Safari).
  useEffect(() => {
    const frame = document.getElementById(id);
    if (!frame) return;
    const scroller = frame.lastElementChild;
    const engine = gesture.current;
    /** Жест отдан прокрутке текста — до конца касания шторка его не трогает. */
    let scrolling = false;
    const onStart = (e: TouchEvent) => {
      scrolling = false;
      if (e.touches.length === 1) engine.begin(e.touches[0]!.clientY, e.timeStamp);
      else engine.finish();
    };
    const onMove = (e: TouchEvent) => {
      const s = start.current;
      if (scrolling || !s || e.touches.length !== 1) return;
      const y = e.touches[0]!.clientY;
      if (live.current.pos === 'full' && !s.moved) {
        const dy = y - s.y;
        if (Math.abs(dy) < DRAG_MIN) return;
        const inText = scroller?.contains(e.target as Node) ?? false;
        if (dy < 0 || (inText && scroller!.scrollTop > 0)) {
          scrolling = true;
          start.current = null;
          return;
        }
      }
      if (e.cancelable) e.preventDefault();
      engine.move(y, e.timeStamp);
    };
    const onEnd = () => {
      scrolling = false;
      engine.finish();
    };
    frame.addEventListener('touchstart', onStart, { passive: true });
    frame.addEventListener('touchmove', onMove, { passive: false });
    frame.addEventListener('touchend', onEnd);
    frame.addEventListener('touchcancel', onEnd);
    return () => {
      frame.removeEventListener('touchstart', onStart);
      frame.removeEventListener('touchmove', onMove);
      frame.removeEventListener('touchend', onEnd);
      frame.removeEventListener('touchcancel', onEnd);
    };
  }, [id]);

  const set = (next: SheetPos) => setState({ key: contentKey, pos: next });

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    gesture.current.begin(e.clientY, e.timeStamp);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    gesture.current.move(e.clientY, e.timeStamp);
  };
  const onPointerUp = () => {
    if (gesture.current.finish()) dragged.current = true;
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
