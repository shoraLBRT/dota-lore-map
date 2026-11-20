// Прототипы объёма и живости карты (#197, исследование E20): наклон, глубина резкости, блики на воде, облака.
// Включаются флагом в адресе до `#`: `?depth=tilt,dof,water,clouds` или `?depth=all`. Без флага карта прежняя.
// Здесь — флаги и чистая геометрия; применяют `useDepth` (наклон, резкость), `MapAtmosphere` (вода, облака).
// Итоги и цена в кадрах — docs/research/E20-depth.md.

import type { SkyCloud } from './atmosphere';

export interface DepthFlags {
  /** Наклон слоя карты (`perspective` + `rotateX`), растёт с приближением. */
  tilt: boolean;
  /** Глубина резкости: размытие и затемнение полос сверху и снизу кадра на приближении. */
  dof: boolean;
  /** Блики на море в холсте атмосферы. */
  water: boolean;
  /** Облака только крупными слоями по краям мира; при входе в регион — расходятся от центра. */
  clouds: boolean;
}

export const DEPTH_KEYS = ['tilt', 'dof', 'water', 'clouds'] as const;

export const NO_DEPTH: DepthFlags = { tilt: false, dof: false, water: false, clouds: false };

/** Флаги из строки запроса (`location.search`): `?depth=tilt,water`, `?depth=all`; иного или нет — всё выключено. */
export function depthFlagsFrom(search: string): DepthFlags {
  const raw = new URLSearchParams(search).get('depth');
  if (!raw) return NO_DEPTH;
  const keys = new Set(raw.split(',').map((s) => s.trim().toLowerCase()));
  const all = keys.has('all');
  return {
    tilt: all || keys.has('tilt'),
    dof: all || keys.has('dof'),
    water: all || keys.has('water'),
    clouds: all || keys.has('clouds'),
  };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (k: number) => k * k * (3 - 2 * k);

/** Наклон на максимуме, градусы, и приближение, с которого он полный (кадр региона — до 2.5, A4). */
export const TILT_MAX = 20;
export const TILT_FULL_ZOOM = 2.5;

/** Наклон камеры при приближении `zoom` (1 — мир целиком): 0° на мире, плавно до `TILT_MAX`. */
export function tiltAt(zoom: number): number {
  return TILT_MAX * smooth(clamp01((zoom - 1) / (TILT_FULL_ZOOM - 1)));
}

/**
 * Куда на экране попадает точка плоской карты после `perspective(p) rotateX(deg)` вокруг центра кадра (cx, cy):
 * верх уходит от зрителя и мельчает, низ приближается. Подписи и маркеры лежат в плоском экранном слое,
 * и их якорь переносится в эту точку — текст остаётся чётким и лицом к зрителю (растр в 3D мылит текст).
 */
export function tiltPoint(x: number, y: number, cx: number, cy: number, deg: number, p: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const dy = y - cy;
  const z = dy * Math.sin(a);
  const k = p / (p - z);
  return [cx + (x - cx) * k, cy + dy * Math.cos(a) * k];
}

/** Расстояние до камеры для `perspective()`, px: больше — мягче перспектива. */
export function perspectiveOf(width: number, height: number): number {
  return Math.round(1.4 * Math.max(width, height, 1));
}

/** Сила глубины резкости: на мире нет, полная с приближения 2.2. */
export function dofAt(zoom: number): number {
  return smooth(clamp01((zoom - 1.2) / (2.2 - 1.2)));
}

type Pt = readonly [number, number];

/** Точка внутри многоугольника (чёт-нечет по лучу вправо). */
export function inPolygon([x, y]: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Детерминированный ГПСЧ (mulberry32): блики стоят на тех же местах при каждой загрузке. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Glint {
  /** Центр, доли мира. */
  x: number;
  y: number;
  /** Ширина, доля стороны мира. */
  w: number;
  /** Фаза и период вспышки, с. */
  phase: number;
  period: number;
}

/** Отступ бликов от берега, доли мира: блик не лезет на сушу. */
export const COAST = 0.008;

/**
 * Блики на море: `count` точек вне всех полигонов регионов (маска воды — дополнение суши из `layout.json`)
 * и не ближе `COAST` к берегу. Ярусы (Небеса, Подземье, Преисподняя) — тоже полигоны, над ними бликов нет.
 */
export function seaGlints(land: readonly (readonly Pt[])[], count: number, seed = 197): Glint[] {
  const rnd = random(seed);
  const wet = (p: Pt) => !land.some((poly) => inPolygon(p, poly));
  const out: Glint[] = [];
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const x = rnd();
    const y = rnd();
    const near: Pt[] = [
      [x, y],
      [x + COAST, y],
      [x - COAST, y],
      [x, y + COAST],
      [x, y - COAST],
    ];
    if (!near.every(wet)) continue;
    out.push({ x, y, w: 0.006 + rnd() * 0.008, phase: rnd() * 10, period: 3 + rnd() * 4 });
  }
  return out;
}

/** Яркость блика в момент `t`, 0…1: короткая вспышка раз за период, остальное время почти не виден. */
export function glintAlpha(g: Glint, t: number): number {
  const s = Math.sin((2 * Math.PI * (t + g.phase)) / g.period);
  return s > 0 ? s ** 6 : 0;
}

/** Сила бликов от приближения: на мире слабые, полные с 2.5. */
export function waterAt(zoom: number): number {
  return 0.45 + 0.55 * clamp01((zoom - 1) / 1.5);
}

/** Доля мира у края, в которой облако считается «краевым». */
export const EDGE_BAND = 0.12;

/** Крупные гряды облаков по краям мира — вместо мелких клочьев над сушей (прототип «облака»). */
export const EDGE_BANKS: SkyCloud[] = [
  { x: 0.3, y: 0.0, w: 0.32, depth: 3, lite: true },
  { x: 0.72, y: 0.02, w: 0.28, depth: 2 },
  { x: 1.0, y: 0.42, w: 0.26, depth: 3, lite: true },
  { x: 0.0, y: 0.62, w: 0.24, depth: 2 },
  { x: 0.28, y: 1.0, w: 0.3, depth: 3, lite: true },
  { x: 0.8, y: 1.0, w: 0.28, depth: 2 },
];

/** Облака прототипа: из прежних — только у края мира, плюс крупные краевые гряды. */
export function edgeClouds(clouds: readonly SkyCloud[], lite: boolean): SkyCloud[] {
  const edge = clouds.filter((c) => Math.min(c.x, 1 - c.x, c.y, 1 - c.y) < EDGE_BAND);
  const banks = lite ? EDGE_BANKS.filter((c) => c.lite) : EDGE_BANKS;
  return [...edge, ...banks];
}

/** Сколько облаков в «завесе» входа в регион. */
export const PART_CLOUDS = 8;

/**
 * Завеса входа в регион: облака стоят у центра кадра и расходятся к краям за перелёт камеры.
 * `k` — доля перелёта 0…1; возвращает центр (доли кадра от центра, по большей стороне), ширину (та же доля) и прозрачность.
 */
export function partCloud(i: number, k: number): { dx: number; dy: number; w: number; alpha: number } {
  const e = 1 - (1 - clamp01(k)) ** 3;
  const a = (i / PART_CLOUDS) * 2 * Math.PI + 0.4;
  const r = 0.08 + 0.75 * e;
  const fadeIn = clamp01(k / 0.12);
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.7, w: 0.42 + 0.2 * e, alpha: 0.85 * fadeIn * (1 - e) };
}
