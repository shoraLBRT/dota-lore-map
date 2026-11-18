// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { axisWeight, cells, coastOf, distanceTo, flatShare, matchColor, pyramidLevels, tileRects } from './tiles.mjs';

// Плитки арта мира (#164, docs/map/README.md «Плитки арта»).

describe('map/art/tiles.mjs', () => {
  it('сетка 4×4 с перекрытием 128 px, у края мира — без выхода за край', () => {
    const t = tileRects(5016);
    expect(t).toHaveLength(16);
    expect(t[0]).toMatchObject({ name: 'r0c0', x: 0, y: 0, w: 1254 + 128, h: 1254 + 128 });
    expect(t[5]).toMatchObject({ name: 'r1c1', x: 1254 - 128, w: 1254 + 256 });
    expect(t[15].x + t[15].w).toBe(5016);
  });

  it('растушёвка: веса соседних плиток в сумме дают 1 на всём мире, вне перекрытия — 1 и 0', () => {
    const b = cells(1000);
    for (let p = 0; p < 1000; p += 7) {
      const sum = [0, 1, 2, 3].reduce((s, i) => s + axisWeight(i, p, b, 40), 0);
      expect(sum).toBeCloseTo(1, 6);
    }
    expect(axisWeight(1, 375, b, 40)).toBe(1);
    expect(axisWeight(0, 300, b, 40)).toBe(0);
    expect(axisWeight(0, 250, b, 40)).toBeCloseTo(0.5, 1);
  });

  it('цвет плитки выравнивается под исходник: среднее и разброс каждого канала', () => {
    const ref = Uint8Array.from([10, 100, 200, 30, 120, 220]);
    const data = matchColor(Uint8Array.from([50, 50, 50, 150, 70, 90]), ref);
    expect(Array.from(data)).toEqual([10, 100, 200, 30, 120, 220]);
  });

  it('однотонная плитка (море, космос) — доля ровных блоков около 1, рельеф — около 0', () => {
    const flat = new Uint8Array(32 * 32 * 3).fill(20);
    const noisy = Uint8Array.from({ length: 32 * 32 * 3 }, (_, i) => (i * 7919) % 256);
    expect(flatShare(flat, 32, 32)).toBe(1);
    expect(flatShare(noisy, 32, 32)).toBe(0);
  });

  it('пирамида — уровни крупнее world-4096 и не крупнее мастера', () => {
    expect(pyramidLevels(10032)).toEqual([4]);
    expect(pyramidLevels(20000)).toEqual([4, 5]);
    expect(pyramidLevels(4096)).toEqual([]);
  });

  it('сдвиг берега: расстояние до береговой линии другой маски', () => {
    const n = 20;
    const m = new Uint8Array(n * n).map((_, i) => (i % n < 10 ? 1 : 0));
    const c = coastOf(m, n);
    expect(c[5 * n + 9]).toBe(1);
    expect(c[5 * n + 5]).toBe(0);
    expect(distanceTo(c, n)[5 * n + 14]).toBe(4);
  });
});
