// Свободная камера (#165, ARCHITECTURE A4): карту тянут мышью или пальцем, приближают колесом, щипком,
// двойным кликом, клавишами и кнопками. Камера здесь — без сдвигов под панель: (x, y) — точка мира в центре кадра.
// Чистые функции — для тестов; хук `useFreeCamera` вешает жесты на кадр и ведёт плавное движение через rAF.

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Camera } from '../../data/types';
import { cameraTransform, clampCamera, prefersReducedMotion, type View } from './camera';

/** Сдвиг, после которого нажатие — уже перетаскивание, а не клик, px. */
export const DRAG_THRESHOLD = 5;
/** Шаг зума кнопками и клавишами `+`/`−`, двойным кликом — вдвое. */
export const ZOOM_STEP = 1.5;
/** Колесо: во сколько раз меняется зум на 100 px прокрутки. */
const WHEEL_RATE = 1.25;
/** Инерция: доля скорости, что остаётся через 16 мс, и порог остановки, px/мс. */
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

/** Приблизить в `factor` раз вокруг точки кадра (px, py): точка мира под курсором остаётся на месте. */
export function zoomAt(camera: Camera, view: View, factor: number, px: number, py: number): Camera {
  if (view.layerWidth <= 0) return camera;
  const zoom = clampCamera({ ...camera, zoom: camera.zoom * factor }, view).zoom;
  return anchorAt(view, zoom, worldAt(camera, view, px, py), px, py);
}

/** Множитель зума на прокрутку колеса (deltaY в px; вниз — отдалить). */
export function wheelFactor(deltaY: number): number {
  return Math.pow(WHEEL_RATE, -deltaY / 100);
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
  view: View;
  /** Камера, которую сейчас показывает кадр (уже без сдвигов, см. `centered`). */
  current: () => Camera;
  /** Свободная камера включена: в мире со списком регионов на телефоне и во время перелёта — нет. */
  enabled: boolean;
  /** Новая свободная камера; вызывается не чаще раза в кадр анимации. */
  onChange: (camera: Camera) => void;
  /** Весь мир — камера по клавише `0` и кнопке. */
  home: Camera;
  /** Кадр сменился снаружи (перелёт к региону, месту, в мир): свободная камера начинается заново от него. */
  resetKey: unknown;
  /** Кадр карты есть в DOM (жесты вешаются на него). */
  attached: boolean;
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
export function useFreeCamera({ viewportRef, layerRef, view, current, enabled, onChange, home, resetKey, attached }: Options): FreeCameraControls {
  const live = useRef({ view, current, enabled, onChange, home });
  useLayoutEffect(() => {
    live.current = { view, current, enabled, onChange, home };
  });
  const cam = useRef<Camera | null>(null);
  const motion = useRef<Motion | null>(null);
  const frame = useRef<number | null>(null);
  const last = useRef(0);

  const apply = (c: Camera) => {
    cam.current = c;
    const el = layerRef.current;
    if (el) el.style.transform = cameraTransform(c);
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
      apply(anchorAt(v, done ? m.zoom : zoom, m.world, m.px, m.py));
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

  /** Плавно приблизить в `factor` раз вокруг точки кадра; повторные шаги копятся. */
  const zoomBy = (factor: number, px: number, py: number) => {
    const { view: v } = live.current;
    if (v.layerWidth <= 0) return;
    const c = base();
    const m = motion.current;
    const from = m?.kind === 'zoom' ? m.zoom : c.zoom;
    const zoom = clampCamera({ ...c, zoom: from * factor }, v).zoom;
    const world = m?.kind === 'zoom' && Math.abs(m.px - px) < 1 && Math.abs(m.py - py) < 1 ? m.world : worldAt(c, v, px, py);
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
    let pinch: { dist: number; mid: { x: number; y: number } } | null = null;
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
      if (pointers.size === 2) pinch = pinchOf();
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
        const world = worldAt(c, v, pinch.mid.x, pinch.mid.y);
        const zoom = clampCamera({ ...c, zoom: c.zoom * (now.dist / (pinch.dist || now.dist)) }, v).zoom;
        apply(anchorAt(v, zoom, world, now.mid.x, now.mid.y));
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
      apply(panBy(base(), v, p.x - prev.x, p.y - prev.y));
      samples.push({ t: e.timeStamp, ...p });
      samples = samples.filter((s) => e.timeStamp - s.t < 100);
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        // Второй палец отпустили — дальше тянем оставшимся.
        pinch = null;
        start = [...pointers.values()][0] ?? null;
        samples = [];
        return;
      }
      if (pointers.size > 0) return;
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
      e.preventDefault();
      const p = local(e);
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      zoomBy(wheelFactor(delta), p.x, p.y);
    };
    const onDouble = (e: MouseEvent) => {
      if (!live.current.enabled) return;
      // Двойной клик по региону или маркеру — это два клика по нему, не зум.
      if ((e.target as Element).closest?.('[role="button"], button, a')) return;
      const p = local(e);
      zoomBy(e.shiftKey ? 1 / 2 : 2, p.x, p.y);
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
      else if (e.key === '-' || e.key === '_') zoomBy(1 / ZOOM_STEP, v.width / 2, v.height / 2);
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
    el.addEventListener('dblclick', onDouble);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDouble);
      el.removeEventListener('keydown', onKey);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- обработчики читают свежие значения из live
  }, [attached]);

  const center = () => [live.current.view.width / 2, live.current.view.height / 2] as const;
  return {
    zoomIn: () => zoomBy(ZOOM_STEP, ...center()),
    zoomOut: () => zoomBy(1 / ZOOM_STEP, ...center()),
    home: () => {
      if (live.current.enabled) {
        if (cam.current === null) cam.current = live.current.current();
        run({ kind: 'fly', goal: live.current.home });
      }
    },
  };
}
