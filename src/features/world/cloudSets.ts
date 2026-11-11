// Облака интро и мира (SPEC §5.2, §5.3, §7.1 A1/A7, ARCHITECTURE A9).
// Облако — CSS-пятно из радиальных градиентов; координаты — проценты контейнера,
// ширина — проценты ширины контейнера. Слой 1 — дальний (мелкий, бледный, медленный), 3 — ближний.

export type CloudLayer = 1 | 2 | 3;

export interface Cloud {
  /** Центр, % ширины и высоты контейнера. */
  x: number;
  y: number;
  /** Ширина, % ширины контейнера (высота — по пропорции облака). */
  w: number;
  layer: CloudLayer;
}

/** Плотная пелена интро: закрывает края и частично центр, при A1 разъезжается к краям. */
export const VEIL_CLOUDS: Cloud[] = [
  { x: 8, y: 12, w: 48, layer: 3 },
  { x: 50, y: 4, w: 56, layer: 2 },
  { x: 92, y: 14, w: 50, layer: 3 },
  { x: 4, y: 50, w: 42, layer: 2 },
  { x: 96, y: 52, w: 44, layer: 2 },
  { x: 10, y: 88, w: 50, layer: 3 },
  { x: 52, y: 96, w: 60, layer: 2 },
  { x: 90, y: 88, w: 52, layer: 3 },
  { x: 28, y: 30, w: 34, layer: 1 },
  { x: 72, y: 30, w: 34, layer: 1 },
  { x: 26, y: 72, w: 36, layer: 1 },
  { x: 74, y: 72, w: 36, layer: 1 },
  { x: 40, y: 52, w: 30, layer: 1 },
  { x: 62, y: 50, w: 30, layer: 1 },
];

/** Облака мира: только по краям карты, медленно дрейфуют (A7). */
export const EDGE_CLOUDS: Cloud[] = [
  { x: 6, y: 6, w: 30, layer: 3 },
  { x: 40, y: -2, w: 34, layer: 1 },
  { x: 78, y: 2, w: 30, layer: 2 },
  { x: 100, y: 30, w: 24, layer: 1 },
  { x: -2, y: 40, w: 22, layer: 2 },
  { x: 102, y: 66, w: 26, layer: 3 },
  { x: -4, y: 78, w: 28, layer: 1 },
  { x: 24, y: 102, w: 34, layer: 2 },
  { x: 64, y: 100, w: 32, layer: 1 },
  { x: 96, y: 98, w: 30, layer: 3 },
];

/**
 * Куда облако уходит при A1: от центра экрана наружу, в единицах vw/vh.
 * Облако у самого центра уходит вверх, чтобы не стоять на месте.
 */
export function partOffset(cloud: Cloud, distance = 70): { dx: number; dy: number } {
  const vx = cloud.x - 50;
  const vy = cloud.y - 50;
  const len = Math.hypot(vx, vy);
  if (len < 1) return { dx: 0, dy: -distance };
  return { dx: Math.round((vx / len) * distance), dy: Math.round((vy / len) * distance) };
}
