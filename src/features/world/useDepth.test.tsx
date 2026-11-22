import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STILL_FRAMES, useDepth } from './useDepth';

describe('useDepth: цикл кадров и наклон (#232)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function setup() {
    const viewport = document.createElement('div');
    const tilt = document.createElement('div');
    const layer = document.createElement('div');
    const dof = document.createElement('div');
    tilt.append(layer);
    viewport.append(tilt, dof);
    document.body.append(viewport);
    Object.defineProperty(viewport, 'clientWidth', { value: 1440 });
    Object.defineProperty(viewport, 'clientHeight', { value: 900 });
    const refs = {
      viewportRef: { current: viewport },
      layerRef: { current: layer },
      tiltRefs: [{ current: tilt }],
      dofRef: { current: dof },
      screenSvgRef: { current: null },
    };
    const hook = renderHook(() => useDepth(refs));
    return { viewport, layer, tilt, dof, hook };
  }

  it('камера стоит — кадры прекращаются, runAllTimers не зацикливается', () => {
    const { hook } = setup();
    vi.runAllTimers();
    expect(vi.getTimerCount()).toBe(0);
    hook.unmount();
  });

  it('жест будит цикл, и после остановки камеры он снова засыпает', () => {
    const { viewport } = setup();
    vi.runAllTimers();
    viewport.dispatchEvent(new Event('wheel'));
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(16 * (STILL_FRAMES + 2));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('наклон без флага: на мире нет, с приближением — сразу после записи камеры, до следующего кадра', async () => {
    const { layer, tilt, dof } = setup();
    vi.runAllTimers();
    expect(tilt.style.transform).toBe('');
    layer.style.transform = 'translate(-60%, -40%) scale(3)';
    await Promise.resolve();
    expect(tilt.style.transform).toBe('perspective(2016px) rotateX(20deg)');
    expect(dof.hasAttribute('data-on')).toBe(true);
    layer.style.transform = 'translate(0%, 0%) scale(1)';
    await Promise.resolve();
    expect(tilt.style.transform).toBe('');
  });

  it('reduced motion — без наклона', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
    const { layer, tilt } = setup();
    layer.style.transform = 'translate(-60%, -40%) scale(3)';
    await Promise.resolve();
    expect(tilt.style.transform).toBe('');
  });
});
