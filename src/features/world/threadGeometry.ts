// Нити между местами героя (SPEC §6.6, A5): дуги в координатах сцены под камерой.

import type { Camera, Point } from '../../data/types';
import { STAGE_HEIGHT, STAGE_WIDTH, type View } from './camera';
import type { Box } from './labels';

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
  /** Точка дуги при t ∈ [0, 1] в координатах сцены. */
  stage: (t: number) => XY;
  /** Направление дуги при t (градусы, 0 — вправо, по часовой — вниз). */
  angle: (t: number) => number;
  /** t, на котором от начала дуги пройдено `s` единиц сцены (обратная длина дуги, по таблице). */
  tAt: (s: number) => number;
}

export function arc(from: Point, to: Point): Arc {
  const a = toStage(from);
  const b = toStage(to);
  const c = control(a, b);
  // Таблица длины по 48 отрезкам: длина дуги и обратная функция «пройденный путь → t».
  const cum = [0];
  let prev = a;
  for (let i = 1; i <= SAMPLES; i++) {
    const p = at(a, c, b, i / SAMPLES);
    cum.push(cum[i - 1]! + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    prev = p;
  }
  const length = cum[SAMPLES]!;
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    d: `M${r(a[0])} ${r(a[1])} Q${r(c[0])} ${r(c[1])} ${r(b[0])} ${r(b[1])}`,
    length,
    point: (t) => {
      const [x, y] = at(a, c, b, t);
      return [x / STAGE_WIDTH, y / STAGE_HEIGHT];
    },
    stage: (t) => at(a, c, b, t),
    angle: (t) => {
      // Производная квадратичной кривой: 2(1−t)(c−a) + 2t(b−c).
      const dx = (1 - t) * (c[0] - a[0]) + t * (b[0] - c[0]);
      const dy = (1 - t) * (c[1] - a[1]) + t * (b[1] - c[1]);
      return (Math.atan2(dy, dx) * 180) / Math.PI;
    },
    tAt: (dist) => {
      if (dist <= 0) return 0;
      if (dist >= length) return 1;
      let i = 1;
      while (cum[i]! < dist) i++;
      const lo = cum[i - 1]!;
      return (i - 1 + (dist - lo) / (cum[i]! - lo)) / SAMPLES;
    },
  };
}

const SAMPLES = 48;
const n1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** Отрезок дуги t0…t1 ломаной из `steps` звеньев (SVG path, сцена): по нему прорисовка, точка и пунктир каравана. */
export function segment(a: Arc, t0: number, t1: number, steps = 32): { d: string; length: number } {
  let d = '';
  let length = 0;
  let prev: XY | null = null;
  for (let i = 0; i <= steps; i++) {
    const p = a.stage(t0 + ((t1 - t0) * i) / steps);
    d += `${i ? 'L' : 'M'}${n1(p[0])} ${n1(p[1])}`;
    if (prev) length += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return { d, length };
}

/**
 * Ширина ленты пути (#168) на доле u ∈ [0, 1] её длины: мазок кисти — короткий набор у начала,
 * затем плавное сужение к наконечнику. w0 — наибольшая ширина, w1 — у конца.
 */
export function taperWidth(u: number, w0: number, w1: number): number {
  const swell = u < 0.12 ? 0.55 + 0.45 * Math.sin((u / 0.12) * (Math.PI / 2)) : 1;
  const fall = u < 0.12 ? 1 : 1 - ((u - 0.12) / 0.88) ** 0.9;
  return u < 0.12 ? w0 * swell : w1 + (w0 - w1) * fall;
}

/**
 * Лента с сужением (#168) вдоль дуги от t0 до t1: замкнутый контур (SVG path, сцена) — края смещены
 * по нормали на половину `taperWidth`. Конец не острый: там наконечник.
 */
export function ribbon(a: Arc, t0: number, t1: number, w0: number, w1: number, steps = 40): string {
  const left: XY[] = [];
  const right: XY[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const t = t0 + (t1 - t0) * u;
    const [x, y] = a.stage(t);
    const rad = (a.angle(t) * Math.PI) / 180;
    const h = taperWidth(u, w0, w1) / 2;
    const [nx, ny] = [-Math.sin(rad) * h, Math.cos(rad) * h];
    left.push([x + nx, y + ny]);
    right.push([x - nx, y - ny]);
  }
  const pts = [...left, ...right.reverse()];
  return `${pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n1(x)} ${n1(y)}`).join('')}Z`;
}

/**
 * Шевроны каравана (#168): t через каждые `spacing` единиц сцены на участке s0…s1 (путь от начала дуги,
 * единицы сцены), кроме окна `skip` по t (значок события с просветом) — шеврон не налезает на значок и наконечник.
 */
export function chevronsAt(a: Arc, s0: number, s1: number, spacing: number, skip?: [number, number]): number[] {
  const out: number[] = [];
  for (let s = s0 + spacing; s <= s1 - spacing * 0.6; s += spacing) {
    const t = a.tAt(s);
    if (skip && t > skip[0] && t < skip[1]) continue;
    out.push(t);
  }
  return out;
}

/** Где на дуге пробовать значок события (#67): от середины к концам. */
const BADGE_TS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];

/**
 * Значок события на нити (#67): первая из точек BADGE_TS, где квадрат со стороной 2r (единицы сцены)
 * не задевает ни одного препятствия — подписей регионов в мире, колец и подписей маркеров в регионе —
 * и целиком лежит в `clip` (видимая часть кадра: не под панелью и не под плашкой героя).
 * Свободной точки нет — null: значок не встаёт поверх подписи или под панель.
 */
export function badgeAt(a: Arc, r: number, obstacles: Box[], clip?: Box, tail = r): number | null {
  // Не ближе 2r к концам: там кольцо маркера и вспышка; к концу — краем значка не ближе `tail` (наконечник, #168).
  const edge = (2 * r) / a.length;
  const end = 1 - Math.max(edge, (tail + r) / a.length);
  for (const t of BADGE_TS) {
    if (t < edge || t > end) continue;
    const [x, y] = a.stage(t);
    if (clip && (x - r < clip.left || x + r > clip.right || y - r < clip.top || y + r > clip.bottom)) continue;
    const hit = obstacles.some((o) => x + r > o.left && x - r < o.right && y + r > o.top && y - r < o.bottom);
    if (!hit) return t;
  }
  return null;
}

/**
 * Нормированная точка мира → px в кадре карты при камере `camera` и сдвиге `offset` (cameraTransform):
 * слой карты стоит по центру кадра (flex), transform-origin 0 0.
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
