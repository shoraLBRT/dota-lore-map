import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { getRegion } from '../../data/world';
import { ambientKind, AmbientCanvas } from './AmbientCanvas';
import { particleCount } from './particles';

const canvas = () => document.querySelector('canvas[data-ambient]');

describe('слой частиц (SPEC §7.3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('тип из данных региона; none, нулевая плотность и отсутствие — без канваса', () => {
    expect(ambientKind(getRegion('icewrack')!.ambient)).toBe('snow');
    expect(ambientKind({ type: 'none' })).toBeNull();
    expect(ambientKind({ type: 'rain', density: 0 })).toBeNull();
    expect(ambientKind(undefined)).toBeNull();
    expect(ambientKind({ type: 'fog' })).toBe('fog');
  });

  it('только в S2/S3: в мире частиц нет, в регионе — его тип', () => {
    window.location.hash = '#/world';
    const view = render(<App />);
    expect(canvas()).toBeNull();
    view.unmount();
    window.location.hash = '#/r/hells/narrow-maze';
    render(<App />);
    expect(canvas()).toHaveAttribute('data-ambient', 'ash');
    expect(canvas()).toHaveAttribute('aria-hidden', 'true');
  });

  it('при prefers-reduced-motion частицы выключены', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
    render(<AmbientCanvas ambient={{ type: 'snow', density: 0.7 }} />);
    expect(canvas()).toBeNull();
  });

  it('рисует кадры через requestAnimationFrame и останавливается при размонтировании', () => {
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_, key) => (key === 'canvas' ? undefined : (...args: unknown[]) => calls.push(String(key)) && args && undefined),
        set: () => true,
      },
    ) as CanvasRenderingContext2D;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => 1280 });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => 800 });

    const view = render(<AmbientCanvas ambient={{ type: 'snow', density: 0.5 }} />);
    expect(frames).toHaveLength(1);
    frames[0]!(performance.now() + 16);
    expect(calls).toContain('clearRect');
    expect(calls.filter((c) => c === 'arc')).toHaveLength(80);
    view.unmount();
    expect(cancel).toHaveBeenCalled();

    getContext.mockRestore();
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'clientWidth');
    Reflect.deleteProperty(HTMLCanvasElement.prototype, 'clientHeight');
  });

  it('над регионом (#192): частицы в рамке региона на экране, обрезаны по его форме, число — от его площади', () => {
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_, key) => (key === 'canvas' ? undefined : (...args: unknown[]) => calls.push(String(key)) && args && undefined),
        set: () => true,
      },
    ) as CanvasRenderingContext2D;
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('Path2D', class {});
    const layer = document.createElement('div');
    layer.getBoundingClientRect = () => ({ left: -200, top: -100, width: 1600, height: 1600 }) as DOMRect;
    const layerRef = { current: layer };
    // Габарит 0.2–0.6 × 0.3–0.5 мира: на экране 640×320 px.
    const polygon: [number, number][] = [
      [0.2, 0.3],
      [0.6, 0.3],
      [0.6, 0.5],
      [0.2, 0.5],
    ];

    const view = render(<AmbientCanvas ambient={{ type: 'snow', density: 0.5 }} region={{ layerRef, polygon }} />);
    frames[0]!(performance.now() + 16);
    expect(calls).toContain('clip');
    expect(calls.filter((c) => c === 'arc')).toHaveLength(particleCount('snow', 0.5, 640, 320));
    view.unmount();
    getContext.mockRestore();
  });
});
