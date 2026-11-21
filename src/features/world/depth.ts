// Прототипы объёма карты (#197, исследование E20): наклон и глубина резкости (задачи #232, #233).
// Включаются флагом в адресе до `#`: `?depth=tilt,dof` или `?depth=all`. Без флага карта прежняя.
// Здесь — флаги и чистая геометрия; применяет `useDepth`. Облака при входе в регион — уже продукт (`atmosphere.ts`, #234).
// Итоги и цена в кадрах — docs/research/E20-depth.md.

export interface DepthFlags {
  /** Наклон слоя карты (`perspective` + `rotateX`), растёт с приближением. */
  tilt: boolean;
  /** Глубина резкости: размытие и затемнение полос сверху и снизу кадра на приближении. */
  dof: boolean;
}

export const DEPTH_KEYS = ['tilt', 'dof'] as const;

export const NO_DEPTH: DepthFlags = { tilt: false, dof: false };

/** Флаги из строки запроса (`location.search`): `?depth=tilt,dof`, `?depth=all`; иного или нет — всё выключено. */
export function depthFlagsFrom(search: string): DepthFlags {
  const raw = new URLSearchParams(search).get('depth');
  if (!raw) return NO_DEPTH;
  const keys = new Set(raw.split(',').map((s) => s.trim().toLowerCase()));
  const all = keys.has('all');
  return {
    tilt: all || keys.has('tilt'),
    dof: all || keys.has('dof'),
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
