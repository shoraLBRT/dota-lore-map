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

/**
 * Пелена интро: облака только по краям и в углах, центр открыт — за заголовком видна карта (#187).
 * Центры вынесены к краю кадра, так что на экране — половина облака. При A1 разъезжаются к краям.
 */
export const VEIL_CLOUDS: Cloud[] = [
  { x: 4, y: 4, w: 46, layer: 3 },
  { x: 50, y: -6, w: 58, layer: 2 },
  { x: 96, y: 6, w: 46, layer: 3 },
  { x: -4, y: 52, w: 34, layer: 2 },
  { x: 104, y: 48, w: 34, layer: 2 },
  { x: 6, y: 98, w: 48, layer: 3 },
  { x: 50, y: 108, w: 60, layer: 2 },
  { x: 94, y: 96, w: 48, layer: 3 },
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
