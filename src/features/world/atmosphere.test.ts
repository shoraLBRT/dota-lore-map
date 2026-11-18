import { describe, expect, it } from 'vitest';
import layout from '../../../map/layout.json';
import {
  approachVeil,
  PATH_VEIL,
  cloudsFor,
  drift,
  FOG_PATCHES,
  GLOWS,
  project,
  pulse,
  SKY_CLOUDS,
  sizeFade,
  strength,
  visible,
  zoomOf,
} from './atmosphere';

const box = { width: 1000, height: 800 };
/** Мир без приближения: квадрат 1000 px, по вертикали выходит за кадр на 100 px с каждой стороны. */
const home = { left: 0, top: -100, size: 1000 };

describe('постэффекты карты (#167)', () => {
  it('без сдвига и приближения облако стоит на своей точке мира на любой высоте', () => {
    for (const depth of [1, 2, 3] as const) {
      const p = project(0.25, 0.4, depth, home, box, 1000);
      expect(p.x).toBeCloseTo(250);
      expect(p.y).toBeCloseTo(300);
      expect(p.scale).toBeCloseTo(1000);
    }
  });

  it('панорамирование уводит ближние облака дальше земли (параллакс)', () => {
    const panned = { ...home, left: -200 };
    const ground = 0.5 * 1000 - 200;
    const [d1, d3] = [1, 3].map((d) => project(0.5, 0.5, d as 1 | 3, panned, box, 1000).x - ground);
    expect(d1).toBeLessThan(0);
    expect(d3).toBeLessThan(d1!);
  });

  it('приближение растит ближние облака быстрее земли', () => {
    const zoomed = { left: -1000, top: -1100, size: 3000 };
    expect(zoomOf(zoomed, 1000)).toBe(3);
    const near = project(0.5, 0.5, 3, zoomed, box, 1000);
    const far = project(0.5, 0.5, 1, zoomed, box, 1000);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(far.scale).toBeGreaterThan(3000);
  });

  it('вблизи эффекты сильнее, весь мир почти чистый; в регионе облака тоньше', () => {
    const world = strength(1);
    const close = strength(4);
    expect(world.grain).toBe(0);
    expect(world.clouds).toBeLessThanOrEqual(0.5);
    expect(close).toEqual({ clouds: 1, fog: 1, glow: 1, grain: 1 });
    expect(strength(8)).toEqual(close);
    expect(strength(4, true).clouds).toBeLessThan(close.clouds);
  });

  it('облако шире кадра тает, обычное — нет', () => {
    expect(sizeFade(300, box)).toBe(1);
    expect(sizeFade(1400, box)).toBe(0);
    expect(sizeFade(1100, box)).toBeGreaterThan(0);
    expect(sizeFade(1100, box)).toBeLessThan(1);
  });

  it('дрейф и пульс ограничены и без времени не двигают', () => {
    expect(drift(3, 0, 0)).toBe(0);
    for (let t = 0; t < 100; t += 7) {
      expect(Math.abs(drift(3, t, 1))).toBeLessThanOrEqual(0.016);
      expect(pulse(t, 3.2, 1)).toBeGreaterThanOrEqual(0.8);
      expect(pulse(t, 3.2, 1)).toBeLessThanOrEqual(1);
    }
  });

  it('за кадром не рисуется', () => {
    expect(visible(-60, 100, 50, 50, box)).toBe(false);
    expect(visible(-40, 100, 50, 50, box)).toBe(true);
    expect(visible(500, 900, 50, 50, box)).toBe(false);
  });

  it('на телефоне облаков меньше половины', () => {
    const lite = cloudsFor(true);
    expect(lite.length).toBeGreaterThan(0);
    expect(lite.length).toBeLessThanOrEqual(Math.ceil(SKY_CLOUDS.length / 2));
    expect(cloudsFor(false)).toBe(SKY_CLOUDS);
  });

  it('пятна внутри мира, туман — у существующих регионов', () => {
    const ids = new Set(Object.keys(layout.regions));
    for (const p of [...SKY_CLOUDS, ...FOG_PATCHES, ...GLOWS]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    for (const p of FOG_PATCHES) if (p.region) expect(ids.has(p.region)).toBe(true);
    expect(new Set(FOG_PATCHES.map((p) => p.region).filter(Boolean))).toEqual(new Set(['uncharted', 'the-deep', 'underdark']));
  });
});

describe('облака расходятся под путём героя (#168)', () => {
  it('плавно к цели, без перелёта; близко — ровно цель', () => {
    const step = approachVeil(1, PATH_VEIL, 1 / 60);
    expect(step).toBeLessThan(1);
    expect(step).toBeGreaterThan(PATH_VEIL);
    let v = 1;
    for (let i = 0; i < 180; i++) v = approachVeil(v, PATH_VEIL, 1 / 60);
    expect(v).toBe(PATH_VEIL);
    expect(approachVeil(PATH_VEIL, 1, 10)).toBe(1);
  });
});
