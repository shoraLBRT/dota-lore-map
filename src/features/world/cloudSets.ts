// Облака пелены интро (SPEC §5.2, §7.1 A1, ARCHITECTURE A9). Облака над миром — atmosphere.ts (#167).
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
