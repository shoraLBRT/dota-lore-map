import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_DEPTH } from './depth';
import { STILL_FRAMES, useDepth } from './useDepth';

describe('useDepth: цикл кадров', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const viewport = document.createElement('div');
    const layer = document.createElement('div');
    const dof = document.createElement('div');
    viewport.append(layer, dof);
    document.body.append(viewport);
    const ref = <T extends HTMLElement>(el: T) => ({ current: el });
    const screen = { current: null };
    const hook = renderHook(() =>
      useDepth(NO_DEPTH, { viewportRef: ref(viewport), layerRef: ref(layer), tiltRef: { current: null }, dofRef: ref(dof), screenSvgRef: screen }),
    );
    return { viewport, hook };
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
});
