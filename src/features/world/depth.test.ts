import { describe, expect, it } from 'vitest';
import { dofAt, flatRect, pointOnMap, tiltAt, TILT_MAX, tiltOf, tiltPoint, tiltTransform, untiltPoint, untiltRect } from './depth';

describe('наклон и резкость', () => {
  it('0° на мире, растёт с зумом до TILT_MAX; reduced motion — без наклона', () => {
    expect(tiltAt(1)).toBe(0);
    expect(tiltAt(0.8)).toBe(0);
    expect(tiltAt(1.8)).toBeGreaterThan(0);
    expect(tiltAt(1.8)).toBeLessThan(tiltAt(2.2));
    expect(tiltAt(4)).toBe(TILT_MAX);
    expect(tiltAt(4, true)).toBe(0);
    expect(tiltTransform({ deg: 0, p: 2000 })).toBe('');
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
  it('обратная проекция возвращает точку (жесты и клики под наклоном)', () => {
    for (const [x, y] of [
      [100, 50],
      [900, 780],
      [500, 400],
      [-300, 1200],
    ] as const) {
      const [tx, ty] = tiltPoint(x, y, 500, 400, 17.3, 2016);
      const [fx, fy] = untiltPoint(tx, ty, 500, 400, 17.3, 2016);
      expect(fx).toBeCloseTo(x, 6);
      expect(fy).toBeCloseTo(y, 6);
    }
  });
  it('плоская рамка по габариту наклонённой трапеции', () => {
    const t = { deg: 20, p: 2016 };
    for (const flat of [
      { left: -800, top: -600, width: 3000, height: 2000 },
      { left: 600, top: 500, width: 200, height: 100 },
      { left: 100, top: -300, width: 200, height: 150 },
    ]) {
      const corners = [
        [flat.left, flat.top],
        [flat.left + flat.width, flat.top],
        [flat.left, flat.top + flat.height],
        [flat.left + flat.width, flat.top + flat.height],
      ].map(([x, y]) => tiltPoint(x!, y!, 500, 400, t.deg, t.p));
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const box = { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
      const back = untiltRect(box, 500, 400, t);
      expect(back.left).toBeCloseTo(flat.left, 6);
      expect(back.top).toBeCloseTo(flat.top, 6);
      expect(back.width).toBeCloseTo(flat.width, 6);
      expect(back.height).toBeCloseTo(flat.height, 6);
    }
  });
  it('размытия краёв на мире нет, растёт с зумом', () => {
    expect(dofAt(1)).toBe(0);
    expect(dofAt(1.6)).toBeGreaterThan(0);
    expect(dofAt(1.6)).toBeLessThan(dofAt(2));
    expect(dofAt(3)).toBe(1);
  });
});

describe('наклон из DOM (облака, частицы, подсказки — #232)', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

  function setup(transform: string, box: DOMRect) {
    const frame = document.createElement('div');
    const wrap = document.createElement('div');
    const el = document.createElement('div');
    wrap.setAttribute('data-tilt', '');
    wrap.style.transform = transform;
    wrap.append(el);
    frame.append(wrap);
    frame.getBoundingClientRect = () => rect(0, 0, 1000, 800);
    el.getBoundingClientRect = () => box;
    return { wrap, el };
  }

  it('наклон читается из inline-стиля обёртки; без наклона — null', () => {
    expect(tiltOf(setup('perspective(2016px) rotateX(12.5deg)', rect(0, 0, 1, 1)).wrap)).toEqual({ deg: 12.5, p: 2016 });
    expect(tiltOf(setup('', rect(0, 0, 1, 1)).wrap)).toBeNull();
    expect(tiltOf(null)).toBeNull();
  });

  it('без наклона рамка и точка — как в getBoundingClientRect', () => {
    const { el } = setup('', rect(10, 20, 400, 200));
    expect(flatRect(el)).toMatchObject({ left: 10, top: 20, width: 400 });
    expect(pointOnMap(el, 0.5, 0.5)).toEqual([210, 120]);
  });

  it('под наклоном точка карты — там, куда её унёс наклон, а не в долях габарита трапеции', () => {
    const t = { deg: 20, p: 1400 };
    const flat = { left: -200, top: -300, width: 1400, height: 1400 };
    const corners = [
      [flat.left, flat.top],
      [flat.left + flat.width, flat.top],
      [flat.left, flat.top + flat.height],
      [flat.left + flat.width, flat.top + flat.height],
    ].map(([x, y]) => tiltPoint(x!, y!, 500, 400, t.deg, t.p));
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const box = rect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const { el } = setup('perspective(1400px) rotateX(20deg)', box);
    expect(flatRect(el).left).toBeCloseTo(flat.left, 6);
    const [x, y] = pointOnMap(el, 0.25, 0.25);
    const [ex, ey] = tiltPoint(flat.left + 350, flat.top + 350, 500, 400, t.deg, t.p);
    expect(x).toBeCloseTo(ex, 6);
    expect(y).toBeCloseTo(ey, 6);
    // Наивная доля габарита трапеции промахнулась бы заметно.
    expect(Math.abs(box.left + 0.25 * box.width - ex) + Math.abs(box.top + 0.25 * box.height - ey)).toBeGreaterThan(10);
  });
});
