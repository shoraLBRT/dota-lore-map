import { describe, expect, it } from 'vitest';
import { MAX_PARTICLES, particleCount, SPECS, spawn, step, twinkle, type Kind } from './particles';

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('частицы (SPEC §7.3)', () => {
  it('число частиц растёт с плотностью и площадью, ограничено потолком; нулевая плотность или кадр — ноль', () => {
    expect(particleCount('snow', 0.5, 1280, 800)).toBe(Math.round(SPECS.snow.count * 0.5));
    expect(particleCount('snow', 1, 1280, 800)).toBe(SPECS.snow.count);
    expect(particleCount('snow', 1, 640, 400)).toBe(Math.round(SPECS.snow.count / 4));
    expect(particleCount('rain', 1, 4000, 3000)).toBe(MAX_PARTICLES);
    expect(particleCount('snow', 0, 1280, 800)).toBe(0);
    expect(particleCount('snow', 1, 0, 800)).toBe(0);
  });

  it('новая частица — внутри кадра, параметры в пределах вида', () => {
    for (const kind of Object.keys(SPECS) as Kind[]) {
      const p = spawn(kind, 800, 600, seq(0.1, 0.9, 0.5, 0.3, 0.7, 0.2, 0.6));
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(800);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(600);
      const s = SPECS[kind];
      expect(p.size).toBeGreaterThanOrEqual(s.size[0]);
      expect(p.size).toBeLessThanOrEqual(s.size[1]);
    }
  });

  it('снег падает, угли поднимаются, песок несётся вбок', () => {
    const snow = spawn('snow', 800, 600, seq(0.5));
    const y0 = snow.y;
    step(snow, 'snow', 0.1, 0, 800, 600);
    expect(snow.y).toBeGreaterThan(y0);
    const ember = spawn('embers', 800, 600, seq(0.5));
    const e0 = ember.y;
    step(ember, 'embers', 0.1, 0, 800, 600);
    expect(ember.y).toBeLessThan(e0);
    const sand = spawn('sand', 800, 600, seq(0.5));
    const x0 = sand.x;
    step(sand, 'sand', 0.1, 0, 800, 600);
    expect(sand.x - x0).toBeGreaterThan(10);
  });

  it('ушедшая за край частица возвращается с другой стороны', () => {
    const p = { x: 400, y: 640, vx: 0, vy: 40, size: 2, phase: 0, alpha: 1 };
    step(p, 'rain', 0.1, 0, 800, 600);
    expect(p.y).toBeLessThan(50);
    const q = { x: 830, y: 300, vx: 200, vy: 0, size: 1, phase: 0, alpha: 1 };
    step(q, 'sand', 0.1, 0, 800, 600);
    expect(q.x).toBeLessThan(50);
  });

  it('мерцание — множитель в [0.1, 1]', () => {
    const p = spawn('stars', 100, 100);
    for (let t = 0; t < 10; t += 0.37) {
      const k = twinkle(p, t);
      expect(k).toBeGreaterThanOrEqual(0.1);
      expect(k).toBeLessThanOrEqual(1);
    }
  });
});
