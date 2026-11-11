// Частицы регионов (SPEC §7.3): чистая симуляция без DOM — её проверяют тесты, рисует AmbientCanvas.

import type { AmbientType } from '../../data/types';

export type Kind = Exclude<AmbientType, 'none'>;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Фаза для покачивания, мерцания, вращения. */
  phase: number;
  alpha: number;
}

/** Поведение вида частиц. Скорости — px/с при «эталонном» кадре 1280×800. */
interface Spec {
  /** Сколько частиц при плотности 1 на эталонном кадре. */
  count: number;
  size: [number, number];
  vx: [number, number];
  vy: [number, number];
  alpha: [number, number];
  /** Покачивание по x: амплитуда (px/с) и частота (рад/с). */
  sway?: [number, number];
}

export const SPECS: Record<Kind, Spec> = {
  snow: { count: 160, size: [1.2, 3.2], vx: [-8, 8], vy: [18, 45], alpha: [0.5, 0.95], sway: [14, 1.1] },
  ash: { count: 110, size: [1, 2.6], vx: [-6, 10], vy: [6, 20], alpha: [0.3, 0.7], sway: [10, 0.7] },
  embers: { count: 70, size: [1, 2.4], vx: [-8, 8], vy: [-40, -16], alpha: [0.5, 1], sway: [16, 1.6] },
  fog: { count: 9, size: [140, 280], vx: [6, 16], vy: [-2, 2], alpha: [0.05, 0.12] },
  rain: { count: 150, size: [10, 18], vx: [-90, -60], vy: [520, 700], alpha: [0.18, 0.4] },
  sparkles: { count: 55, size: [1, 2.4], vx: [-4, 4], vy: [-10, -2], alpha: [0.3, 1] },
  stars: { count: 80, size: [0.8, 2], vx: [-1, 1], vy: [-1, 1], alpha: [0.3, 1] },
  leaves: { count: 32, size: [3, 6], vx: [14, 34], vy: [16, 34], alpha: [0.55, 0.9], sway: [24, 0.9] },
  sand: { count: 130, size: [0.8, 1.8], vx: [160, 260], vy: [-6, 10], alpha: [0.25, 0.6] },
};

/** Потолок частиц на кадр: держим 60 FPS на среднем ноутбуке (SPEC §7.3). */
export const MAX_PARTICLES = 220;

const REF_AREA = 1280 * 800;

/** Сколько частиц нужно для кадра w×h при плотности density ∈ [0, 1]. */
export function particleCount(kind: Kind, density: number, w: number, h: number): number {
  if (w <= 0 || h <= 0 || density <= 0) return 0;
  const scale = Math.min(2, (w * h) / REF_AREA);
  return Math.min(MAX_PARTICLES, Math.round(SPECS[kind].count * Math.min(density, 1) * scale));
}

const between = (r: () => number, [a, b]: [number, number]) => a + (b - a) * r();

/** Новая частица в случайной точке кадра. */
export function spawn(kind: Kind, w: number, h: number, random: () => number = Math.random): Particle {
  const s = SPECS[kind];
  return {
    x: random() * w,
    y: random() * h,
    vx: between(random, s.vx),
    vy: between(random, s.vy),
    size: between(random, s.size),
    phase: random() * Math.PI * 2,
    alpha: between(random, s.alpha),
  };
}

/** Шаг симуляции на dt секунд (t — общее время): движение, покачивание, перенос через край кадра. */
export function step(p: Particle, kind: Kind, dt: number, t: number, w: number, h: number): void {
  const sway = SPECS[kind].sway;
  const dx = p.vx + (sway ? Math.sin(t * sway[1] + p.phase) * sway[0] : 0);
  p.x += dx * dt;
  p.y += p.vy * dt;
  // Частица ушла за край — возвращается с противоположного, с запасом на свой размер.
  const m = kind === 'fog' ? p.size : p.size + 20;
  if (p.x > w + m) p.x -= w + 2 * m;
  else if (p.x < -m) p.x += w + 2 * m;
  if (p.y > h + m) p.y -= h + 2 * m;
  else if (p.y < -m) p.y += h + 2 * m;
}

/** Мерцание (sparkles, stars, embers): множитель прозрачности 0..1. */
export function twinkle(p: Particle, t: number): number {
  return 0.55 + 0.45 * Math.sin(t * 2.2 + p.phase * 3);
}
