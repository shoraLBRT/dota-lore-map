import { describe, expect, it } from 'vitest';
import type { View } from './camera';
import { arc, edgeExit, rayExit, toScreen, visibleFrame } from './threadGeometry';

const view: View = { width: 1000, height: 600, layerWidth: 960, layerHeight: 600, inset: 0 };

describe('нити: геометрия (SPEC §6.6)', () => {
  it('дуга: концы на месте, выгнута вверх, длиннее хорды', () => {
    const a = arc([0.25, 0.5], [0.75, 0.5]);
    expect(a.point(0)).toEqual([0.25, 0.5]);
    expect(a.point(1)).toEqual([0.75, 0.5]);
    expect(a.point(0.5)[1]).toBeLessThan(0.5);
    expect(a.length).toBeGreaterThan(800);
    expect(a.d).toMatch(/^M400 500 Q800 \d+(\.\d)? 1200 500$/);
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
});
