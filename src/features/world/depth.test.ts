import { describe, expect, it } from 'vitest';
import layout from '../../../map/layout.json';
import { cloudsFor, SKY_CLOUDS } from './atmosphere';
import {
  COAST,
  depthFlagsFrom,
  dofAt,
  edgeClouds,
  EDGE_BAND,
  EDGE_BANKS,
  glintAlpha,
  inPolygon,
  NO_DEPTH,
  partCloud,
  seaGlints,
  tiltAt,
  TILT_MAX,
  uprightOf,
} from './depth';

type Pt = [number, number];
const land = Object.values(layout.regions).map((r) => r.polygon as Pt[]);

describe('depthFlagsFrom (#197)', () => {
  it('без флага — всё выключено', () => {
    expect(depthFlagsFrom('')).toEqual(NO_DEPTH);
    expect(depthFlagsFrom('?threads=caravan')).toEqual(NO_DEPTH);
  });
  it('список и all', () => {
    expect(depthFlagsFrom('?depth=tilt,water')).toEqual({ tilt: true, dof: false, water: true, clouds: false });
    expect(depthFlagsFrom('?depth=all')).toEqual({ tilt: true, dof: true, water: true, clouds: true });
  });
});

describe('наклон и резкость', () => {
  it('0° на мире, растёт с зумом до TILT_MAX', () => {
    expect(tiltAt(1)).toBe(0);
    expect(tiltAt(0.8)).toBe(0);
    expect(tiltAt(1.8)).toBeGreaterThan(0);
    expect(tiltAt(1.8)).toBeLessThan(tiltAt(2.2));
    expect(tiltAt(4)).toBe(TILT_MAX);
  });
  it('подпись растягивается на 1 / cos θ', () => {
    expect(uprightOf(0)).toBe(1);
    expect(uprightOf(20)).toBeCloseTo(1.0642, 3);
  });
  it('глубины резкости на мире нет', () => {
    expect(dofAt(1)).toBe(0);
    expect(dofAt(3)).toBe(1);
  });
});

describe('блики на воде', () => {
  it('точка в многоугольнике', () => {
    const sq: Pt[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(inPolygon([0.5, 0.5], sq)).toBe(true);
    expect(inPolygon([1.5, 0.5], sq)).toBe(false);
  });
  it('все блики — на море, не ближе COAST к суше, и те же при каждом вызове', () => {
    const glints = seaGlints(land, 120);
    expect(glints).toHaveLength(120);
    for (const g of glints) {
      expect(land.some((p) => inPolygon([g.x, g.y], p))).toBe(false);
      expect(land.some((p) => inPolygon([g.x + COAST, g.y], p))).toBe(false);
    }
    expect(seaGlints(land, 120)).toEqual(glints);
  });
  it('вспышка в 0…1', () => {
    const g = { x: 0, y: 0, w: 0.01, phase: 0, period: 4 };
    expect(glintAlpha(g, 1)).toBeCloseTo(1, 5);
    expect(glintAlpha(g, 3)).toBe(0);
  });
});

describe('облака по краям', () => {
  it('из прежних остаются только краевые, плюс гряды', () => {
    const out = edgeClouds(SKY_CLOUDS, false);
    for (const c of out.slice(0, out.length - EDGE_BANKS.length)) {
      expect(Math.min(c.x, 1 - c.x, c.y, 1 - c.y)).toBeLessThan(EDGE_BAND);
    }
    expect(out.some((c) => c.x === 0.24 && c.y === 0.36)).toBe(false);
    expect(edgeClouds(cloudsFor(true), true).every((c) => c.lite)).toBe(true);
  });
  it('завеса расходится от центра и тает к концу перелёта', () => {
    const r = (k: number) => Math.hypot(partCloud(0, k).dx, partCloud(0, k).dy);
    expect(r(0.8)).toBeGreaterThan(r(0.2));
    expect(partCloud(0, 0).alpha).toBe(0);
    expect(partCloud(0, 1).alpha).toBeCloseTo(0, 5);
    expect(partCloud(0, 0.3).alpha).toBeGreaterThan(0.2);
  });
});
