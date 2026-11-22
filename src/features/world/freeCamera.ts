// Свободная камера (#165, ARCHITECTURE A4): карту тянут мышью или пальцем, приближают колесом, щипком,
// двойным кликом, клавишами и кнопками. Камера здесь — без сдвигов под панель: (x, y) — точка мира в центре кадра.
// Чистые функции — для тестов; хук `useFreeCamera` вешает жесты на кадр и ведёт плавное движение через rAF.

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Camera } from '../../data/types';
import { cameraTransform, clampCamera, prefersReducedMotion, type View } from './camera';
import { perspectiveOf, tiltAt, untiltPoint } from './depth';
import { placeAnchors } from './screenAnchors';

/** Сдвиг, после которого нажатие — уже перетаскивание, а не клик, px. */
export const DRAG_THRESHOLD = 5;
/** Шаг зума кнопками и клавишами `+`/`−`, двойным кликом — вдвое (#179). */
export const ZOOM_STEP = 1.3;
/**
 * Колесо (#179): во сколько раз меняется зум на 100 px прокрутки (один щелчок мыши); от «мир целиком» до потолка
 * FREE_ZOOM_MAX — не меньше 5 щелчков (до потолка мира #209 на 1440×900 — около 4).
 */
export const WHEEL_RATE = 1.2;
/** Не больше одного щелчка за событие: «быстрые» колёса и deltaMode строк/страниц не прыгают. */
export const WHEEL_MAX_DELTA = 100;
/** Скорость колеса не выше одного щелчка за WHEEL_REFILL мс: частые мелкие шаги тачпада не разгоняют зум. */
export const WHEEL_REFILL = 120;
/** Инерция: доля скорости, что остаётся через 16 мс, и порог остановки, px/мс. */
/** Щипок дальше нижнего упора во столько раз (сумма за жест) — выход из региона в мир (#196), как колесо на упоре. */
export const PINCH_EXIT = 0.75;
/** Двойное касание (#196): второе касание не позже, мс, и не дальше, px, от первого. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 30;

const FRICTION = 0.92;
const MIN_SPEED = 0.02;
/** Плавный зум и перелёт: доля пути, проходимая за 16 мс. */
const EASE = 0.22;

/** Камера с учётом сдвигов cameraTransform → камера, у которой (x, y) — точка в центре всего кадра. */
export function centered(camera: Camera, view: View, offset = 0, offsetY = 0): Camera {
  if (view.layerWidth <= 0) return camera;
  return {
    x: camera.x + offset / (view.layerWidth * camera.zoom),
    y: camera.y + offsetY / (view.layerHeight * camera.zoom),
    zoom: camera.zoom,
  };
}

/** Сдвинуть камеру вслед за пальцем на (dx, dy) px экрана (карта едет туда же, куда палец). */
export function panBy(camera: Camera, view: View, dx: number, dy: number): Camera {
  if (view.layerWidth <= 0) return camera;
  return clampCamera(
    {
      x: camera.x - dx / (view.layerWidth * camera.zoom),
      y: camera.y - dy / (view.layerHeight * camera.zoom),
      zoom: camera.zoom,
    },
    view,
  );
}

/** Точка мира под точкой кадра (px от его левого верхнего угла). */
export function worldAt(camera: Camera, view: View, px: number, py: number): [number, number] {
  return [
    camera.x + (px - view.width / 2) / (view.layerWidth * camera.zoom),
    camera.y + (py - view.height / 2) / (view.layerHeight * camera.zoom),
  ];
}

/** Камера с зумом `zoom`, при которой точка мира `world` стоит в точке кадра (px, py). */
export function anchorAt(view: View, zoom: number, world: [number, number], px: number, py: number): Camera {
  return clampCamera(
    {
      x: world[0] - (px - view.width / 2) / (view.layerWidth * zoom),
      y: world[1] - (py - view.height / 2) / (view.layerHeight * zoom),
      zoom,
    },
    view,
  );
}

/**
 * Точка плоского кадра, которая видна в точке экрана (px, py) при приближении `zoom`: под наклоном карты (#232) —
 * обратная проекция наклона, который `useDepth` ставит при этом зуме (`tiltAt`); без наклона — та же точка.
 */
export function flatAt(view: View, zoom: number, px: number, py: number, reduced = false): [number, number] {
  return untiltPoint(px, py, view.width / 2, view.height / 2, tiltAt(zoom, reduced), perspectiveOf(view.width, view.height));
}

/** Точка мира, которую видно в точке экрана (px, py), — с учётом наклона карты. */
export function worldOnScreen(camera: Camera, view: View, px: number, py: number, reduced = false): [number, number] {
  return worldAt(camera, view, ...flatAt(view, camera.zoom, px, py, reduced));
}

/**
 * Камера с зумом `zoom`, при которой точку мира `world` видно в точке экрана (px, py) — под наклоном этого зума.
 * Наклон растёт с зумом, поэтому точку под курсором держит именно она, а не `anchorAt` в плоских координатах.
 */
export function pinOnScreen(view: View, zoom: number, world: [number, number], px: number, py: number, reduced = false): Camera {
  return anchorAt(view, zoom, world, ...flatAt(view, zoom, px, py, reduced));
}

/** Приблизить в `factor` раз вокруг точки кадра (px, py): точка мира под курсором остаётся на месте. */
export function zoomAt(camera: Camera, view: View, factor: number, px: number, py: number): Camera {
  if (view.layerWidth <= 0) return camera;
  const zoom = clampCamera({ ...camera, zoom: camera.zoom * factor }, view).zoom;
  return anchorAt(view, zoom, worldAt(camera, view, px, py), px, py);
}

/** Камера стоит на нижнем упоре уровня (`clampCamera`: дальше не отдалить). */
export function atZoomFloor(camera: Camera, view: View): boolean {
  return clampCamera({ ...camera, zoom: camera.zoom / 1.01 }, view).zoom >= camera.zoom * (1 - 1e-3);
}

/** Множитель зума на прокрутку колеса (deltaY в px; вниз — отдалить). */
export function wheelFactor(deltaY: number): number {
  return Math.pow(WHEEL_RATE, -deltaY / 100);
}

/**
 * Прокрутка события в px, не больше WHEEL_MAX_DELTA по модулю. Строки (deltaMode 1, Firefox: 3 строки на щелчок)
 * — по 100/3 px, чтобы щелчок был щелчком; страницы — по 400 px.
 */
export function wheelDelta(deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? (deltaY * 100) / 3 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.min(Math.max(px, -WHEEL_MAX_DELTA), WHEEL_MAX_DELTA);
}

/**
 * Ограничитель скорости колеса: запас прокрутки (px) до WHEEL_MAX_DELTA, пополняется на WHEEL_MAX_DELTA за
 * WHEEL_REFILL мс. Возвращает прокрутку, которую можно пропустить, и новый запас на момент `now`.
 */
export function limitWheel(
  delta: number,
  budget: { left: number; at: number },
  now: number,
): { delta: number; budget: { left: number; at: number } } {
  const left = Math.min(WHEEL_MAX_DELTA, budget.left + (Math.max(now - budget.at, 0) * WHEEL_MAX_DELTA) / WHEEL_REFILL);
  const pass = Math.sign(delta) * Math.min(Math.abs(delta), left);
  return { delta: pass, budget: { left: left - Math.abs(pass), at: now } };
}

/** Затухание скорости инерции за `dt` мс. */
export function decay(speed: number, dt: number): number {
  return speed * Math.pow(FRICTION, dt / 16);
}

/** Доля пути плавного движения за `dt` мс. */
export function easeStep(dt: number): number {
  return 1 - Math.pow(1 - EASE, dt / 16);
}

type Motion =
  | { kind: 'zoom'; zoom: number; world: [number, number]; px: number; py: number }
  | { kind: 'fly'; goal: Camera }
  | { kind: 'glide'; vx: number; vy: number };

interface Options {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  layerRef: React.RefObject<HTMLDivElement | null>;
  /** Экранный слой подписей и маркеров (#180): камера ставит его группы в их точки (`placeAnchors`, #231). */
  screenRef?: React.RefObject<HTMLDivElement | null>;
  view: View;
  /** Камера, которую сейчас показывает кадр (уже без сдвигов, см. `centered`). */
  current: () => Camera;
  /** Свободная камера включена: во время перелёта — нет. */
  enabled: boolean;
  /** Новая свободная камера; вызывается не чаще раза в кадр анимации. */
  onChange: (camera: Camera) => void;
  /** Весь мир — камера по клавише `0` и кнопке. */
  home: Camera;
  /** Кадр сменился снаружи (перелёт к региону, месту, в мир): свободная камера начинается заново от него. */
  resetKey: unknown;
  /** Кадр карты есть в DOM (жесты вешаются на него). */
  attached: boolean;
  /**
   * Отдаление колесом, `−` или кнопкой, когда камера уже стоит на нижнем упоре уровня (#190), или щипок дальше упора
   * в PINCH_EXIT раз (#196): в регионе и месте — выход в мир. Без него упор просто держит камеру.
   */
  onFloor?: (camera: Camera) => void;
}

/** Действия кнопок на экране. */
export interface FreeCameraControls {
  zoomIn: () => void;
  zoomOut: () => void;
  home: () => void;
}

/**
 * Жесты свободной камеры на кадре карты. Transform слоя пишется напрямую в каждом кадре анимации,
 * React получает камеру через `onChange` (маркеры и подписи пересчитывают масштаб).
 */
export function useFreeCamera({ viewportRef, layerRef, screenRef, view, current, enabled, onChange, home, resetKey, attached, onFloor }: Options): FreeCameraControls {
  const live = useRef({ view, current, enabled, onChange, home, onFloor });
  useLayoutEffect(() => {
    live.current = { view, current, enabled, onChange, home, onFloor };
  });
  const cam = useRef<Camera | null>(null);
  const motion = useRef<Motion | null>(null);
  const frame = useRef<number | null>(null);
  const last = useRef(0);

  const apply = (c: Camera) => {
    cam.current = c;
    const transform = cameraTransform(c);
    if (layerRef.current) layerRef.current.style.transform = transform;
    placeAnchors(screenRef?.current ?? null, { camera: c, layerWidth: live.current.view.layerWidth });
    live.current.onChange(c);
  };
  const base = () => cam.current ?? live.current.current();

  const stop = () => {
    motion.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  const tick = (now: number) => {
    const m = motion.current;
    const { view: v } = live.current;
    const dt = Math.min(64, now - (last.current || now)) || 16;
    last.current = now;
    if (!m) return void (frame.current = null);
    const c = base();
    if (m.kind === 'glide') {
      const next = panBy(c, v, m.vx * dt, m.vy * dt);
      // Упёрлись в край мира — по этой оси скорость гаснет.
      if (next.x === c.x) m.vx = 0;
      if (next.y === c.y) m.vy = 0;
      m.vx = decay(m.vx, dt);
      m.vy = decay(m.vy, dt);
      apply(next);
      if (Math.hypot(m.vx, m.vy) < MIN_SPEED) motion.current = null;
    } else if (m.kind === 'zoom') {
      const k = easeStep(dt);
      const zoom = Math.exp(Math.log(c.zoom) + (Math.log(m.zoom) - Math.log(c.zoom)) * k);
      const done = Math.abs(Math.log(m.zoom / zoom)) < 0.002;
      apply(pinOnScreen(v, done ? m.zoom : zoom, m.world, m.px, m.py, prefersReducedMotion()));
      if (done) motion.current = null;
    } else {
      const k = easeStep(dt);
      const g = m.goal;
      const zoom = Math.exp(Math.log(c.zoom) + (Math.log(g.zoom) - Math.log(c.zoom)) * k);
      const next = { x: c.x + (g.x - c.x) * k, y: c.y + (g.y - c.y) * k, zoom };
      const done = Math.abs(g.x - next.x) < 1e-4 && Math.abs(g.y - next.y) < 1e-4 && Math.abs(Math.log(g.zoom / zoom)) < 0.002;
      apply(clampCamera(done ? g : next, v));
      if (done) motion.current = null;
    }
    frame.current = motion.current ? requestAnimationFrame(tick) : null;
  };

  const run = (m: Motion) => {
    if (prefersReducedMotion() && m.kind !== 'glide') {
      // Без движения: сразу на место.
      stop();
      const { view: v } = live.current;
      apply(m.kind === 'zoom' ? anchorAt(v, m.zoom, m.world, m.px, m.py) : clampCamera(m.goal, v));
      return;
    }
    if (prefersReducedMotion()) return stop();
    motion.current = m;
    if (frame.current === null) {
      last.current = 0;
      frame.current = requestAnimationFrame(tick);
    }
  };

  /**
   * Плавно приблизить в `factor` раз вокруг точки кадра; повторные шаги копятся. `floor` — шаг колеса, клавиши или
   * кнопки: отдаление с уже достигнутого нижнего упора (камера стоит, а не едет к нему) зовёт `onFloor` (#190).
   */
  const zoomBy = (factor: number, px: number, py: number, floor = false) => {
    const { view: v, onFloor: atFloor } = live.current;
    if (v.layerWidth <= 0) return;
    const c = base();
    const m = motion.current;
    if (floor && atFloor && factor < 1 && m?.kind !== 'zoom' && atZoomFloor(c, v)) {
      stop();
      atFloor(c);
      return;
    }
    const from = m?.kind === 'zoom' ? m.zoom : c.zoom;
    const zoom = clampCamera({ ...c, zoom: from * factor }, v).zoom;
    const world =
      m?.kind === 'zoom' && Math.abs(m.px - px) < 1 && Math.abs(m.py - py) < 1 ? m.world : worldOnScreen(c, v, px, py, prefersReducedMotion());
    run({ kind: 'zoom', zoom, world, px, py });
  };

  // Сброс при смене кадра снаружи (перелёт к региону) и выключении: свободная камера начинается заново от кадра.
  useEffect(() => {
    stop();
    cam.current = null;
  }, [enabled, resetKey]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let start: { x: number; y: number } | null = null;
    let dragging = false;
    let moved = false;
    /** Запас колеса (limitWheel). */
    let wheel = { left: WHEEL_MAX_DELTA, at: 0 };
    let pinch: { dist: number; mid: { x: number; y: number } } | null = null;
    /** Сколько щипок просит отдалить за нижний упор (произведение за жест; 1 — не упирался). */
    let under = 1;
    /** Последнее касание без сдвига — для двойного касания; когда двойное касание сработало — для отсева dblclick. */
    let lastTap: { t: number; x: number; y: number } | null = null;
    let doubleAt = -Infinity;
    let samples: { t: number; x: number; y: number }[] = [];

    const local = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pinchOf = () => {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };

    const onDown = (e: PointerEvent) => {
      if (!live.current.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      stop();
      cam.current = live.current.current();
      const p = local(e);
      pointers.set(e.pointerId, p);
      start = p;
      moved = false;
      samples = [{ t: e.timeStamp, ...p }];
      if (pointers.size === 2) {
        pinch = pinchOf();
        under = 1;
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev || !start) return;
      const p = local(e);
      pointers.set(e.pointerId, p);
      const { view: v } = live.current;
      if (pointers.size >= 2 && pinch) {
        const now = pinchOf();
        const c = base();
        const reduced = prefersReducedMotion();
        const world = worldOnScreen(c, v, pinch.mid.x, pinch.mid.y, reduced);
        const wanted = c.zoom * (now.dist / (pinch.dist || now.dist));
        const zoom = clampCamera({ ...c, zoom: wanted }, v).zoom;
        under = wanted < zoom * (1 - 1e-3) ? under * (wanted / zoom) : 1;
        apply(pinOnScreen(v, zoom, world, now.mid.x, now.mid.y, reduced));
        pinch = now;
        moved = dragging = true;
        return;
      }
      if (!dragging && Math.hypot(p.x - start.x, p.y - start.y) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        moved = true;
        el.setPointerCapture?.(e.pointerId);
        el.dataset.dragging = '';
      }
      // Под наклоном (#232) сдвиг пальца на экране — другой сдвиг плоской карты: карта едет ровно за пальцем.
      const c = base();
      const reduced = prefersReducedMotion();
      const [ax, ay] = flatAt(v, c.zoom, prev.x, prev.y, reduced);
      const [bx, by] = flatAt(v, c.zoom, p.x, p.y, reduced);
      apply(panBy(c, v, bx - ax, by - ay));
      samples.push({ t: e.timeStamp, ...p });
      samples = samples.filter((s) => e.timeStamp - s.t < 100);
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        // Второй палец отпустили — дальше тянем оставшимся; щипок далеко за упор — выход из региона.
        const atFloor = live.current.onFloor;
        if (pinch && under <= PINCH_EXIT && atFloor) {
          pointers.clear();
          pinch = null;
          start = null;
          dragging = false;
          under = 1;
          delete el.dataset.dragging;
          stop();
          atFloor(base());
          return;
        }
        pinch = null;
        start = [...pointers.values()][0] ?? null;
        samples = [];
        return;
      }
      if (pointers.size > 0) return;
      // Двойное касание пустого места карты (#196) — приблизить вдвое; регион или маркер касание открывает сразу.
      if (e.pointerType === 'touch' && !moved && start) {
        const p = start;
        const onTarget = (e.target as Element | null)?.closest?.('[role="button"], button, a');
        if (lastTap && e.timeStamp - lastTap.t <= DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) <= DOUBLE_TAP_PX && !onTarget) {
          lastTap = null;
          doubleAt = e.timeStamp;
          zoomBy(2, p.x, p.y);
        } else lastTap = onTarget ? null : { t: e.timeStamp, ...p };
      }
      if (dragging && samples.length > 1) {
        const a = samples[0]!;
        const b = samples[samples.length - 1]!;
        const dt = Math.max(1, b.t - a.t);
        const vx = (b.x - a.x) / dt;
        const vy = (b.y - a.y) / dt;
        if (Math.hypot(vx, vy) > MIN_SPEED * 4) run({ kind: 'glide', vx, vy });
      }
      dragging = false;
      pinch = null;
      start = null;
      delete el.dataset.dragging;
    };
    // Перетаскивание — не клик: клик после него не доходит до региона или маркера.
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!live.current.enabled) return;
      // Над подсказкой карты (#208): щипок тачпада (ctrlKey) — зум камеры, а не браузера, иначе растёт вся страница
      // вместе с подсказкой; обычное колесо листает раскрытую подсказку, если ей есть куда.
      const tip = e.currentTarget === el ? null : (e.target as Element | null)?.closest?.('[data-map-tip]');
      if (e.currentTarget !== el && !tip) return;
      if (tip && !e.ctrlKey && tip.scrollHeight > tip.clientHeight) return;
      e.preventDefault();
      const p = local(e);
      const limited = limitWheel(wheelDelta(e.deltaY, e.deltaMode), wheel, e.timeStamp);
      wheel = limited.budget;
      if (limited.delta !== 0) zoomBy(wheelFactor(limited.delta), p.x, p.y, true);
    };
    const onDouble = (e: MouseEvent) => {
      if (!live.current.enabled) return;
      // Двойной клик по региону или маркеру — это два клика по нему, не зум.
      if ((e.target as Element).closest?.('[role="button"], button, a')) return;
      // Двойное касание уже приблизило (браузер следом шлёт dblclick).
      if (e.timeStamp - doubleAt < 1000) return;
      const p = local(e);
      zoomBy(e.shiftKey ? 1 / 2 : 2, p.x, p.y);
    };
    // Safari: щипок тачпада — не ctrl+колесо, а gesture*; без preventDefault он масштабирует страницу (#208).
    let gesture = 1;
    const onGesture = (e: Event) => {
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      if (!live.current.enabled) return;
      if (e.currentTarget !== el && !(e.target as Element | null)?.closest?.('[data-map-tip]')) return;
      e.preventDefault();
      if (e.type === 'gesturestart') gesture = 1;
      else if (e.type === 'gesturechange' && g.scale > 0) {
        const p = local(g);
        zoomBy(g.scale / gesture, p.x, p.y);
        gesture = g.scale;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!live.current.enabled || e.altKey || e.ctrlKey || e.metaKey) return;
      const { view: v } = live.current;
      const step = Math.min(v.width, v.height) * 0.2;
      const pan: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      const move = pan[e.key];
      if (move) {
        const [dx, dy] = move;
        const c = base();
        run({ kind: 'fly', goal: panBy(c, v, dx, dy) });
      } else if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP, v.width / 2, v.height / 2);
      else if (e.key === '-' || e.key === '_') zoomBy(1 / ZOOM_STEP, v.width / 2, v.height / 2, true);
      else if (e.key === '0') run({ kind: 'fly', goal: live.current.home });
      else return;
      e.preventDefault();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('click', onClick, true);
    el.addEventListener('wheel', onWheel, { passive: false });
    // Подсказки карты — порталы в body, вне кадра: их колесо и щипок ловим на документе.
    document.addEventListener('wheel', onWheel, { passive: false });
    const gestures = ['gesturestart', 'gesturechange', 'gestureend'];
    for (const type of gestures) {
      el.addEventListener(type, onGesture);
      document.addEventListener(type, onGesture);
    }
    el.addEventListener('dblclick', onDouble);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('wheel', onWheel);
      document.removeEventListener('wheel', onWheel);
      for (const type of gestures) {
        el.removeEventListener(type, onGesture);
        document.removeEventListener(type, onGesture);
      }
      el.removeEventListener('dblclick', onDouble);
      el.removeEventListener('keydown', onKey);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- обработчики читают свежие значения из live
  }, [attached]);

  const center = () => [live.current.view.width / 2, live.current.view.height / 2] as const;
  return {
    zoomIn: () => zoomBy(ZOOM_STEP, ...center()),
    zoomOut: () => zoomBy(1 / ZOOM_STEP, ...center(), true),
    home: () => {
      if (live.current.enabled) {
        if (cam.current === null) cam.current = live.current.current();
        run({ kind: 'fly', goal: live.current.home });
      }
    },
  };
}
