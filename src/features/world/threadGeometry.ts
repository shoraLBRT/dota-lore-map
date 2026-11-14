// Нити между местами героя (SPEC §6.6, A5): дуги в координатах сцены 1600×1000 под камерой.

import type { Camera, Point } from '../../data/types';
import { STAGE_HEIGHT, STAGE_WIDTH, type View } from './camera';

type XY = [number, number];

/** Насколько дуга выгибается: доля длины хорды. */
const BEND = 0.22;

const toStage = ([x, y]: Point): XY => [x * STAGE_WIDTH, y * STAGE_HEIGHT];

/** Контрольная точка квадратичной дуги a → b: середина, сдвинутая перпендикулярно хорде — всегда «вверх» по экрану. */
function control(a: XY, b: XY): XY {
  const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  let [nx, ny] = [-dy, dx];
  if (ny > 0 || (ny === 0 && nx > 0)) [nx, ny] = [-nx, -ny];
  return [mx + nx * BEND, my + ny * BEND];
}

function at(a: XY, c: XY, b: XY, t: number): XY {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

export interface Arc {
  /** SVG path в координатах сцены. */
  d: string;
  /** Длина в единицах сцены (для прорисовки по stroke-dashoffset). */
  length: number;
  /** Точка дуги при t ∈ [0, 1] в нормированных координатах. */
  point: (t: number) => Point;
}

export function arc(from: Point, to: Point): Arc {
  const a = toStage(from);
  const b = toStage(to);
  const c = control(a, b);
  let length = 0;
  let prev = a;
  for (let i = 1; i <= 24; i++) {
    const p = at(a, c, b, i / 24);
    length += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    d: `M${r(a[0])} ${r(a[1])} Q${r(c[0])} ${r(c[1])} ${r(b[0])} ${r(b[1])}`,
    length,
    point: (t) => {
      const [x, y] = at(a, c, b, t);
      return [x / STAGE_WIDTH, y / STAGE_HEIGHT];
    },
  };
}

/**
 * Нормированная точка мира → px в кадре карты при камере `camera` и сдвиге `offset` (cameraTransform):
 * слой 16:10 стоит по центру кадра (flex), transform-origin 0 0.
 */
export function toScreen([x, y]: Point, camera: Camera, offset: number, view: View, offsetY = 0): XY {
  return [
    view.width / 2 + view.layerWidth * (x - camera.x) * camera.zoom - offset,
    view.height / 2 + view.layerHeight * (y - camera.y) * camera.zoom - offsetY,
  ];
}

/** Видимая часть кадра: слева от панели и над шторкой, с отступом `margin` px. */
export interface Frame {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function visibleFrame(view: View, inset: number, margin: number, insetBottom = 0): Frame {
  return { left: margin, top: margin, right: view.width - inset - margin, bottom: view.height - insetBottom - margin };
}

const inside = ([x, y]: XY, f: Frame) => x >= f.left && x <= f.right && y >= f.top && y <= f.bottom;

/**
 * Где нить уходит за край (SPEC §6.6): идём по дуге от видимого конца к невидимому и берём последнюю точку в кадре.
 * Возвращает точку (px) и угол направления наружу (градусы, 0 — вправо). Оба конца видны или оба нет — null.
 */
export function edgeExit(
  a: Arc,
  fromVisible: boolean,
  project: (p: Point) => XY,
  frame: Frame,
): { x: number; y: number; angle: number } | null {
  const STEPS = 60;
  const t = (i: number) => (fromVisible ? i / STEPS : 1 - i / STEPS);
  if (!inside(project(a.point(t(0))), frame) || inside(project(a.point(t(STEPS))), frame)) return null;
  let last = project(a.point(t(0)));
  for (let i = 1; i <= STEPS; i++) {
    const p = project(a.point(t(i)));
    if (!inside(p, frame)) {
      const angle = (Math.atan2(p[1] - last[1], p[0] - last[0]) * 180) / Math.PI;
      return { x: last[0], y: last[1], angle };
    }
    last = p;
  }
  return null;
}

/**
 * Где место за кадром без нити (#66): луч из центра видимой части кадра к точке `to` (px) — последняя точка
 * в кадре и угол наружу (градусы, 0 — вправо). Точка в кадре — null.
 */
export function rayExit(to: XY, frame: Frame): { x: number; y: number; angle: number } | null {
  if (inside(to, frame)) return null;
  const cx = (frame.left + frame.right) / 2;
  const cy = (frame.top + frame.bottom) / 2;
  const dx = to[0] - cx;
  const dy = to[1] - cy;
  // Доля пути до ближайшей стороны кадра по каждой оси.
  const tx = dx > 0 ? (frame.right - cx) / dx : dx < 0 ? (frame.left - cx) / dx : Infinity;
  const ty = dy > 0 ? (frame.bottom - cy) / dy : dy < 0 ? (frame.top - cy) / dy : Infinity;
  const t = Math.min(tx, ty, 1);
  return { x: cx + dx * t, y: cy + dy * t, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}
