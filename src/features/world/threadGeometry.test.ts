import { describe, expect, it } from 'vitest';
import type { View } from './camera';
import { arc, badgeAt, chevronsAt, edgeExit, rayExit, ribbon, segment, taperWidth, toScreen, visibleFrame } from './threadGeometry';

const view: View = { width: 1000, height: 600, layerWidth: 960, layerHeight: 600, inset: 0 };

describe('нити: геометрия (SPEC §6.6)', () => {
  it('дуга: концы на месте, выгнута вверх, длиннее хорды', () => {
    const a = arc([0.25, 0.5], [0.75, 0.5]);
    expect(a.point(0)).toEqual([0.25, 0.5]);
    expect(a.point(1)).toEqual([0.75, 0.5]);
    expect(a.point(0.5)[1]).toBeLessThan(0.5);
    expect(a.length).toBeGreaterThan(800);
    expect(a.d).toMatch(/^M400 800 Q800 \d+(\.\d)? 1200 800$/);
    // В обратную сторону — тоже вверх.
    expect(arc([0.75, 0.5], [0.25, 0.5]).point(0.5)[1]).toBeLessThan(0.5);
  });

  it('точка мира в px кадра: центр камеры — центр кадра, сдвиг панели — влево', () => {
    const cam = { x: 0.3, y: 0.4, zoom: 2 };
    expect(toScreen([0.3, 0.4], cam, 0, view)).toEqual([500, 300]);
    expect(toScreen([0.3, 0.4], cam, 100, view)).toEqual([400, 300]);
    const [x] = toScreen([0.35, 0.4], cam, 0, view);
    expect(x).toBeCloseTo(500 + 960 * 0.05 * 2);
  });

  it('выход за край: точка у края кадра и направление наружу; оба конца видны или не видны — null', () => {
    const cam = { x: 0.5, y: 0.5, zoom: 1 };
    const project = (p: [number, number]) => toScreen(p, cam, 0, view);
    const frame = visibleFrame(view, 400, 20);
    // Кадр — x от 20 до 580: конец на x = 0.9 (≈ 884 px) за правым краем.
    const out = edgeExit(arc([0.3, 0.5], [0.9, 0.5]), true, project, frame)!;
    expect(out.x).toBeGreaterThan(540);
    expect(out.x).toBeLessThanOrEqual(580);
    expect(Math.abs(out.angle)).toBeLessThan(90);
    // Обратный порядок: видимый конец — второй.
    const back = edgeExit(arc([0.9, 0.5], [0.3, 0.5]), false, project, frame)!;
    expect(back.x).toBeGreaterThan(540);
    expect(edgeExit(arc([0.3, 0.5], [0.4, 0.5]), true, project, frame)).toBeNull();
    expect(edgeExit(arc([0.95, 0.5], [0.9, 0.5]), true, project, frame)).toBeNull();
  });
  it('место за кадром без нити (#66): точка на краю кадра по лучу из центра, угол наружу; в кадре — null', () => {
    const frame = { left: 0, top: 0, right: 600, bottom: 400 };
    expect(rayExit([300, 200], frame)).toBeNull();
    expect(rayExit([900, 200], frame)).toEqual({ x: 600, y: 200, angle: 0 });
    const down = rayExit([300, 1000], frame)!;
    expect(down.x).toBeCloseTo(300);
    expect(down.y).toBeCloseTo(400);
    expect(down.angle).toBeCloseTo(90);
    const corner = rayExit([-300, -200], frame)!;
    expect(corner.x).toBeCloseTo(0);
    expect(corner.y).toBeCloseTo(0);
    expect(corner.angle).toBeCloseTo(-146.3, 1);
  });

  it('направление дуги: в начале — вверх-вправо, в середине — вправо, в конце — вниз-вправо', () => {
    const a = arc([0.25, 0.5], [0.75, 0.5]);
    expect(a.angle(0)).toBeLessThan(0);
    expect(a.angle(0.5)).toBeCloseTo(0);
    expect(a.angle(1)).toBeGreaterThan(0);
    expect(a.stage(0)).toEqual([400, 800]);
  });

  it('значок события (#67): середина дуги, если свободна; иначе ближайшая свободная точка; занято всё — null', () => {
    const a = arc([0.25, 0.5], [0.75, 0.5]);
    expect(badgeAt(a, 9, [])).toBe(0.5);
    const [mx, my] = a.stage(0.5);
    const middle = { left: mx - 20, right: mx + 20, top: my - 20, bottom: my + 20 };
    const t = badgeAt(a, 9, [middle]);
    expect(t).not.toBeNull();
    expect(t).not.toBe(0.5);
    expect(badgeAt(a, 9, [{ left: 0, right: 1600, top: 0, bottom: 1000 }])).toBeNull();
  });
});

describe('нити: рисунок пути (#168)', () => {
  const a = arc([0.25, 0.5], [0.75, 0.5]);

  it('обратная длина дуги: tAt(0) = 0, tAt(длина) = 1, середина пути — середина симметричной дуги', () => {
    expect(a.tAt(0)).toBe(0);
    expect(a.tAt(a.length)).toBe(1);
    expect(a.tAt(a.length / 2)).toBeCloseTo(0.5, 2);
    expect(a.tAt(a.length / 4)).toBeLessThan(a.tAt(a.length / 2));
  });

  it('отрезок дуги: ломаная от t0 до t1, длина — доля всей дуги', () => {
    const half = segment(a, 0, 0.5);
    expect(half.d.startsWith('M400 800')).toBe(true);
    expect(half.length).toBeCloseTo(a.length / 2, -1);
  });

  it('сужение: набор у начала, к концу — до w1, ширина нигде не больше w0', () => {
    expect(taperWidth(0, 4, 1)).toBeCloseTo(2.2);
    expect(taperWidth(0.12, 4, 1)).toBeCloseTo(4);
    expect(taperWidth(1, 4, 1)).toBeCloseTo(1);
    for (let u = 0; u <= 1; u += 0.05) expect(taperWidth(u, 4, 1)).toBeLessThanOrEqual(4 + 1e-9);
    expect(taperWidth(0.5, 4, 1)).toBeGreaterThan(taperWidth(0.9, 4, 1));
  });

  it('лента: замкнутый контур вокруг оси дуги', () => {
    const d = ribbon(a, 0, 1, 6, 2, 10);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/[ML]/g)).toHaveLength(22);
  });

  it('шевроны: ровный шаг по длине, окно значка пропущено', () => {
    const all = chevronsAt(a, 0, a.length, 100);
    expect(all.length).toBeGreaterThan(6);
    const skipped = chevronsAt(a, 0, a.length, 100, [0.4, 0.6]);
    expect(skipped.every((t) => t <= 0.4 || t >= 0.6)).toBe(true);
    expect(skipped.length).toBeLessThan(all.length);
  });
});
