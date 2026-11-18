import { describe, expect, it } from 'vitest';
import { clampCamera, maxZoom } from './camera';
import { anchorAt, centered, decay, panBy, wheelFactor, worldAt, zoomAt } from './freeCamera';

// Кадр 1440×900, слой покрывает его — 1440×1440 (#165).
const view = { width: 1440, height: 900, layerWidth: 1440, layerHeight: 1440, inset: 0 };

describe('свободная камера (#165)', () => {
  it('за краем мира пустоты нет: zoom ≥ 1, центр держит кадр на картинке', () => {
    expect(clampCamera({ x: 0, y: 0, zoom: 0.5 }, view)).toEqual({ x: 0.5, y: 900 / 1440 / 2, zoom: 1 });
    const c = clampCamera({ x: 1, y: 1, zoom: 2 }, view);
    expect(c.x).toBeCloseTo(1 - 1440 / 2880 / 2);
    expect(c.y).toBeCloseTo(1 - 900 / 2880 / 2);
    expect(clampCamera({ x: 0.5, y: 0.5, zoom: 100 }, view).zoom).toBe(maxZoom(view));
  });

  it('перетаскивание: карта едет за пальцем и упирается в край', () => {
    const c = { x: 0.5, y: 0.5, zoom: 2 };
    expect(panBy(c, view, 288, 0).x).toBeCloseTo(0.5 - 288 / 2880);
    expect(panBy(c, view, 100000, 0).x).toBeCloseTo(0.25);
  });

  it('зум вокруг курсора: точка мира под курсором остаётся на месте', () => {
    const c = { x: 0.5, y: 0.5, zoom: 1.5 };
    const before = worldAt(c, view, 400, 300);
    const after = zoomAt(c, view, 1.6, 400, 300);
    expect(after.zoom).toBeCloseTo(2.4);
    const [wx, wy] = worldAt(after, view, 400, 300);
    expect(wx).toBeCloseTo(before[0]);
    expect(wy).toBeCloseTo(before[1]);
    expect(anchorAt(view, after.zoom, before, 400, 300)).toEqual(after);
  });

  it('камера со сдвигом под панель → точка в центре всего кадра', () => {
    expect(centered({ x: 0.4, y: 0.5, zoom: 2 }, view, 288)).toEqual({ x: 0.5, y: 0.5, zoom: 2 });
  });

  it('колесо вниз отдаляет, вверх приближает; инерция затухает', () => {
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100) * wheelFactor(-100)).toBeCloseTo(1);
    expect(decay(1, 16)).toBeCloseTo(0.92);
    expect(decay(1, 32)).toBeCloseTo(0.92 * 0.92);
  });
});
