// Объём карты (#197, исследование E20): наклон на приближении (#232) и размытие краёв кадра (#233) — в продукте, без флага.
// Здесь — чистая геометрия наклона и её чтение из DOM; применяет `useDepth`. Облака при входе в регион — `atmosphere.ts` (#234).
// Правила — SPEC §8.5.2, ARCHITECTURE A9; итоги исследования и цена в кадрах — docs/research/E20-depth.md.

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (k: number) => k * k * (3 - 2 * k);

/** Наклон на максимуме, градусы, и приближение, с которого он полный (кадр региона — до 2.5, A4). */
export const TILT_MAX = 20;
export const TILT_FULL_ZOOM = 2.5;

/**
 * Наклон камеры при приближении `zoom` (1 — мир целиком): 0° на мире, плавно до `TILT_MAX`, с шагом 0.1°.
 * Reduced motion — без наклона (SPEC §8.5.2). Одно число и для обёртки слоя карты, и для жестов камеры.
 */
export function tiltAt(zoom: number, reduced = false): number {
  if (reduced) return 0;
  return Math.round(TILT_MAX * smooth(clamp01((zoom - 1) / (TILT_FULL_ZOOM - 1))) * 10) / 10;
}

/** Наклон обёртки слоя карты: угол, градусы, и расстояние до камеры `perspective()`, px. */
export interface Tilt {
  deg: number;
  p: number;
}

/** Расстояние до камеры для `perspective()`, px: больше — мягче перспектива. */
export function perspectiveOf(width: number, height: number): number {
  return Math.round(1.4 * Math.max(width, height, 1));
}

/** CSS обёртки: `perspective() rotateX()` вокруг центра кадра; без наклона — пусто (обёртка не 3D-слой). */
export function tiltTransform(t: Tilt): string {
  return t.deg > 0 ? `perspective(${t.p}px) rotateX(${t.deg}deg)` : '';
}

/**
 * Куда на экране попадает точка плоской карты после `perspective(p) rotateX(deg)` вокруг центра кадра (cx, cy):
 * верх уходит от зрителя и мельчает, низ приближается. Подписи и маркеры лежат в плоском экранном слое,
 * и их якорь переносится в эту точку — текст остаётся чётким и лицом к зрителю (растр в 3D мылит текст).
 */
export function tiltPoint(x: number, y: number, cx: number, cy: number, deg: number, p: number): [number, number] {
  if (deg <= 0) return [x, y];
  const a = (deg * Math.PI) / 180;
  const dy = y - cy;
  const k = p / (p - dy * Math.sin(a));
  return [cx + (x - cx) * k, cy + dy * Math.cos(a) * k];
}

/** Во сколько раз наклон увеличивает мелочь на строке `y` кадра (меньше 1 — у дальнего верхнего края). */
export function tiltScale(y: number, cy: number, deg: number, p: number): number {
  return deg > 0 ? p / (p - (y - cy) * Math.sin((deg * Math.PI) / 180)) : 1;
}

/** Обратное к `tiltPoint`: какая точка плоской карты видна в точке экрана (x, y) — для жестов и кликов под наклоном. */
export function untiltPoint(x: number, y: number, cx: number, cy: number, deg: number, p: number): [number, number] {
  if (deg <= 0) return [x, y];
  const a = (deg * Math.PI) / 180;
  const Y = y - cy;
  const dy = (Y * p) / (p * Math.cos(a) + Y * Math.sin(a));
  const k = p / (p - dy * Math.sin(a));
  return [cx + (x - cx) / k, cy + dy];
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Плоская рамка прямоугольника по габариту его наклонённой трапеции (`getBoundingClientRect` под наклоном).
 * Строки трапеции — горизонтальные, ширина растёт сверху вниз: верх и низ — обратная проекция по вертикали,
 * левый и правый край — по строке, где край дальше всего от центра.
 */
export function untiltRect(r: Rect, cx: number, cy: number, t: Tilt): Rect {
  if (t.deg <= 0) return r;
  const a = (t.deg * Math.PI) / 180;
  const kOf = (y: number) => t.p / (t.p - (y - cy) * Math.sin(a));
  const top = untiltPoint(cx, r.top, cx, cy, t.deg, t.p)[1];
  const bottom = untiltPoint(cx, r.top + r.height, cx, cy, t.deg, t.p)[1];
  const kt = kOf(top);
  const kb = kOf(bottom);
  const right = r.left + r.width;
  const left = cx + (r.left - cx) / (r.left < cx ? kb : kt);
  const rightFlat = cx + (right - cx) / (right > cx ? kb : kt);
  return { left, top, width: rightFlat - left, height: bottom - top };
}

/** Обёртка наклона (`data-tilt`), в которой лежит элемент: её пишет `useDepth`. */
export const TILT_ATTR = 'data-tilt';
const TILT_CSS = /perspective\(([\d.]+)px\)\s*rotateX\(([\d.]+)deg\)/;

/** Наклон обёртки сейчас — из её inline-стиля (без `getComputedStyle`); нет наклона — null. */
export function tiltOf(wrap: Element | null): Tilt | null {
  const m = TILT_CSS.exec((wrap as HTMLElement | null)?.style?.transform ?? '');
  if (!m) return null;
  const deg = Number(m[2]);
  return deg > 0 ? { deg, p: Number(m[1]) } : null;
}

/**
 * Наклон над элементом и центр наклона на экране: обёртка `data-tilt` занимает весь кадр карты, центр наклона —
 * центр кадра (её родителя). Нет наклона — null.
 */
export function tiltOver(el: Element): (Tilt & { cx: number; cy: number }) | null {
  const wrap = el.closest(`[${TILT_ATTR}]`);
  const t = tiltOf(wrap);
  const frame = wrap?.parentElement;
  if (!t || !frame) return null;
  const f = frame.getBoundingClientRect();
  return { ...t, cx: f.left + f.width / 2, cy: f.top + f.height / 2 };
}

/** Экранная рамка элемента, каким он был бы без наклона (частицы региона считают положение мира по ней). */
export function flatRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  const t = tiltOver(el);
  return t ? untiltRect(r, t.cx, t.cy, t) : r;
}

/** Точка экрана, где видна точка (fx, fy) в долях рамки элемента на наклонённой карте (подсказки региона и места). */
export function pointOnMap(el: Element, fx: number, fy: number): [number, number] {
  const r = el.getBoundingClientRect();
  const t = tiltOver(el);
  if (!t) return [r.left + fx * r.width, r.top + fy * r.height];
  const f = untiltRect(r, t.cx, t.cy, t);
  return tiltPoint(f.left + fx * f.width, f.top + fy * f.height, t.cx, t.cy, t.deg, t.p);
}

/** Сила размытия краёв кадра (#233): на мире нет, полная с приближения 2.2. */
export function dofAt(zoom: number): number {
  return smooth(clamp01((zoom - 1.2) / (2.2 - 1.2)));
}
