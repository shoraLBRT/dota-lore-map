// Постэффекты карты (#167, ARCHITECTURE A9): облака с параллаксом, туман, дымка над морем и свечение ярусов.
// Всё задано в долях мира (0…1 по стороне квадратного арта) и рисуется на canvas поверх карты.
// Здесь — данные и чистая геометрия; рисует MapAtmosphere.tsx.

/** Высота облака над картой: 1 — у самой земли, 3 — ближе всего к камере. */
export type Depth = 1 | 2 | 3;

export interface SkyCloud {
  /** Центр облака, доли мира. */
  x: number;
  y: number;
  /** Ширина, доля стороны мира (высота — по пропорции спрайта). */
  w: number;
  depth: Depth;
  /** Рисуется и на телефоне (облегчённый вариант). */
  lite?: boolean;
}

export type PatchKind = 'fog' | 'haze' | 'star' | 'lava';

export interface Patch {
  kind: PatchKind;
  x: number;
  y: number;
  /** Полуоси эллипса, доли мира. */
  rx: number;
  ry: number;
  /** Туман региона: в самом регионе он реже, чтобы не прятать маркеры. */
  region?: string;
}

/** Насколько быстрее земли движется облако при панорамировании и приближении. */
export const PARALLAX: Record<Depth, number> = { 1: 1.06, 2: 1.14, 3: 1.26 };

/** Прозрачность облака по высоте: ближние плотнее. */
export const DEPTH_ALPHA: Record<Depth, number> = { 1: 0.55, 2: 0.7, 3: 0.85 };

/** Амплитуда (доля мира) и период (с) дрейфа облака по высоте — те же 48–84 с, что у прежнего A7. */
export const DRIFT: Record<Depth, { amp: number; period: number }> = {
  1: { amp: 0.006, period: 84 },
  2: { amp: 0.01, period: 64 },
  3: { amp: 0.016, period: 48 },
};

/**
 * Облака над миром: реже над материками, плотнее над морем, у кромки Небес и над Подземьем.
 * Положения подогнаны под `public/art/world-4096.webp`.
 */
export const SKY_CLOUDS: SkyCloud[] = [
  // Кромка Небес над северным материком.
  { x: 0.06, y: 0.06, w: 0.22, depth: 3, lite: true },
  { x: 0.13, y: 0.2, w: 0.2, depth: 2, lite: true },
  { x: 0.33, y: 0.22, w: 0.15, depth: 1 },
  { x: 0.53, y: 0.21, w: 0.18, depth: 2, lite: true },
  { x: 0.75, y: 0.24, w: 0.15, depth: 1 },
  { x: 0.95, y: 0.19, w: 0.14, depth: 3 },
  // Море: западный край, пролив между материками, восточное море.
  { x: 0.02, y: 0.45, w: 0.12, depth: 2 },
  { x: 0.05, y: 0.8, w: 0.14, depth: 3, lite: true },
  { x: 0.46, y: 0.545, w: 0.11, depth: 1 },
  { x: 0.67, y: 0.555, w: 0.1, depth: 2 },
  { x: 0.885, y: 0.5, w: 0.1, depth: 2, lite: true },
  { x: 0.8, y: 0.33, w: 0.1, depth: 1 },
  // Над Подземьем и Преисподней.
  { x: 0.2, y: 0.77, w: 0.18, depth: 2, lite: true },
  { x: 0.42, y: 0.79, w: 0.2, depth: 3 },
  { x: 0.64, y: 0.76, w: 0.16, depth: 1, lite: true },
  { x: 0.87, y: 0.81, w: 0.18, depth: 2 },
  { x: 0.31, y: 0.87, w: 0.15, depth: 1 },
  { x: 0.58, y: 0.97, w: 0.2, depth: 2 },
  { x: 0.96, y: 0.96, w: 0.2, depth: 3, lite: true },
  // Над материками — редко и тонко.
  { x: 0.24, y: 0.36, w: 0.09, depth: 1 },
  { x: 0.55, y: 0.61, w: 0.08, depth: 1 },
];

/** Туман в отдельных местах и дымка над морем — лежит на земле, двигается вместе с картой. */
export const FOG_PATCHES: Patch[] = [
  // Неизведанные земли: остров в облаках.
  { kind: 'fog', x: 0.925, y: 0.3, rx: 0.08, ry: 0.05, region: 'uncharted' },
  // Разлом Глубин.
  { kind: 'fog', x: 0.9, y: 0.58, rx: 0.07, ry: 0.1, region: 'the-deep' },
  { kind: 'fog', x: 0.86, y: 0.7, rx: 0.06, ry: 0.07, region: 'the-deep' },
  // Подземье.
  { kind: 'fog', x: 0.15, y: 0.82, rx: 0.14, ry: 0.05, region: 'underdark' },
  { kind: 'fog', x: 0.45, y: 0.84, rx: 0.16, ry: 0.05, region: 'underdark' },
  { kind: 'fog', x: 0.72, y: 0.82, rx: 0.12, ry: 0.05, region: 'underdark' },
  // Дымка над морем.
  { kind: 'haze', x: 0.6, y: 0.25, rx: 0.22, ry: 0.035 },
  { kind: 'haze', x: 0.5, y: 0.545, rx: 0.16, ry: 0.025 },
  { kind: 'haze', x: 0.02, y: 0.6, rx: 0.04, ry: 0.16 },
  { kind: 'haze', x: 0.84, y: 0.42, rx: 0.035, ry: 0.12 },
  { kind: 'haze', x: 0.4, y: 0.75, rx: 0.26, ry: 0.03 },
];

/** Свечение ярусов: звёздные туманности Небес и лава Преисподней. Вблизи прячет мягкость картинки. */
export const GLOWS: Patch[] = [
  { kind: 'star', x: 0.63, y: 0.1, rx: 0.07, ry: 0.06 },
  { kind: 'star', x: 0.85, y: 0.16, rx: 0.06, ry: 0.04 },
  { kind: 'star', x: 0.33, y: 0.04, rx: 0.04, ry: 0.03 },
  { kind: 'star', x: 0.52, y: 0.13, rx: 0.03, ry: 0.025 },
  { kind: 'lava', x: 0.12, y: 0.95, rx: 0.09, ry: 0.04 },
  { kind: 'lava', x: 0.06, y: 0.87, rx: 0.05, ry: 0.03 },
  { kind: 'lava', x: 0.25, y: 0.93, rx: 0.04, ry: 0.025 },
  { kind: 'lava', x: 0.7, y: 0.96, rx: 0.08, ry: 0.03 },
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Приближение, при котором эффекты набирают полную силу. */
export const FULL_ZOOM = 4;

export interface Strength {
  clouds: number;
  fog: number;
  glow: number;
  grain: number;
}

/**
 * Сила эффектов от приближения камеры (1 — весь мир в кадре): вблизи сильнее, весь мир — почти чистый.
 * В регионе и месте облака реже, чтобы не прятать маркеры.
 */
export function strength(zoom: number, inRegion = false): Strength {
  const k = clamp01((zoom - 1) / (FULL_ZOOM - 1));
  return {
    clouds: (0.5 + 0.5 * k) * (inRegion ? 0.8 : 1),
    fog: 0.45 + 0.55 * k,
    glow: 0.3 + 0.7 * k,
    grain: k,
  };
}

/** Доля облаков и тумана, пока на карте путь героя (#168): облака расходятся, нить читается поверх арта. */
export const PATH_VEIL = 0.35;

/** За сколько секунд облака расходятся или сходятся (до 1/e расстояния). */
const VEIL_TAU = 0.35;

/** Шаг плавного перехода `veil` к `target` за dt секунд: экспонента, без рывка; почти дошли — ровно target. */
export function approachVeil(veil: number, target: number, dt: number): number {
  const next = target + (veil - target) * Math.exp(-Math.max(0, dt) / VEIL_TAU);
  return Math.abs(next - target) < 0.005 ? target : next;
}

/** Где мир на экране: левый верхний угол и сторона квадрата, px от левого верхнего угла холста. */
export interface WorldRect {
  left: number;
  top: number;
  size: number;
}

export interface Box {
  width: number;
  height: number;
}

/** Приближение камеры: сторона мира на экране к стороне мира без приближения. */
export function zoomOf(rect: WorldRect, homeSize: number): number {
  return homeSize > 0 ? Math.max(1, rect.size / homeSize) : 1;
}

/**
 * Экранное положение облака на высоте `depth` и множитель его размера (параллакс).
 * Без сдвига и приближения облако стоит ровно на своей точке мира; панорамирование уводит его в `PARALLAX`
 * раз дальше земли, приближение — разносит от центра кадра и увеличивает быстрее земли.
 */
export function project(
  x: number,
  y: number,
  depth: Depth,
  rect: WorldRect,
  box: Box,
  homeSize: number,
): { x: number; y: number; scale: number } {
  const d = PARALLAX[depth] - 1;
  const zoom = zoomOf(rect, homeSize);
  const spread = 1 - 1 / zoom;
  const cx = box.width / 2;
  const cy = box.height / 2;
  const gx = rect.left + x * rect.size;
  const gy = rect.top + y * rect.size;
  // Сдвиг центра мира от центра кадра — то, на сколько карту утянули.
  const px = rect.left + rect.size / 2 - cx;
  const py = rect.top + rect.size / 2 - cy;
  return {
    x: gx + (px + (gx - cx) * spread) * d,
    y: gy + (py + (gy - cy) * spread) * d,
    scale: rect.size * (1 + d * spread),
  };
}

/** Облако шире кадра закрыло бы всё — тает по мере роста (камера «проходит сквозь» него). */
export function sizeFade(cloudWidth: number, box: Box): number {
  const w = Math.max(box.width, box.height);
  return clamp01((1.4 * w - cloudWidth) / (0.8 * w));
}

/** Дрейф облака по горизонтали, доли мира: медленное качание, у каждого облака своя фаза. */
export function drift(depth: Depth, t: number, phase: number): number {
  const { amp, period } = DRIFT[depth];
  return amp * Math.sin((2 * Math.PI * t) / period + phase);
}

/** Пульс свечения 0.8…1 с периодом «дыхания» (`--dur-breathe`). */
export function pulse(t: number, periodS: number, phase: number): number {
  return 0.9 + 0.1 * Math.sin((2 * Math.PI * t) / Math.max(0.1, periodS) + phase);
}

/** Пересекает ли эллипс с центром (x, y) и полуосями (rx, ry) кадр. */
export function visible(x: number, y: number, rx: number, ry: number, box: Box): boolean {
  return x + rx > 0 && x - rx < box.width && y + ry > 0 && y - ry < box.height;
}

/** Облегчённый вариант на телефоне: меньше половины облаков. */
export function cloudsFor(lite: boolean): SkyCloud[] {
  return lite ? SKY_CLOUDS.filter((c) => c.lite) : SKY_CLOUDS;
}
