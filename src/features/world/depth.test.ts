import { describe, expect, it } from 'vitest';
import { depthFlagsFrom, dofAt, NO_DEPTH, tiltAt, TILT_MAX, tiltPoint } from './depth';

describe('depthFlagsFrom (#197)', () => {
  it('без флага — всё выключено', () => {
    expect(depthFlagsFrom('')).toEqual(NO_DEPTH);
    expect(depthFlagsFrom('?threads=caravan')).toEqual(NO_DEPTH);
  });
  it('список и all', () => {
    expect(depthFlagsFrom('?depth=tilt')).toEqual({ tilt: true, dof: false });
    expect(depthFlagsFrom('?depth=all')).toEqual({ tilt: true, dof: true });
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
  it('проекция: центр на месте, верх мельчает, низ крупнеет, без наклона — тождество', () => {
    expect(tiltPoint(500, 400, 500, 400, 20, 2000)).toEqual([500, 400]);
    expect(tiltPoint(700, 100, 500, 400, 0, 2000)).toEqual([700, 100]);
    const [tx, ty] = tiltPoint(700, 100, 500, 400, 20, 2000);
    expect(tx - 500).toBeLessThan(200);
    expect(400 - ty).toBeLessThan(300);
    const [bx] = tiltPoint(700, 700, 500, 400, 20, 2000);
    expect(bx - 500).toBeGreaterThan(200);
  });
  it('глубины резкости на мире нет', () => {
    expect(dofAt(1)).toBe(0);
    expect(dofAt(3)).toBe(1);
  });
});
