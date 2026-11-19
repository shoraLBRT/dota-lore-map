import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Camera, Region } from '../../data/types';
import { TOOLTIP_CLOSE_DELAY, TOOLTIP_MAX_ZOOM, TOOLTIP_OPEN_DELAY, useRegionTooltip } from './useRegionTooltip';

// Подсказка региона (#193): только у подписи, с задержкой; сдвиг и зум камеры её прячут, на глубоком зуме её нет.

const region = (id: string): Region => ({
  id,
  tier: 'continent',
  side: 'neutral',
  name: { ru: id, en: id },
  geo: '',
  places: [],
  regionHeroes: [],
  layout: {
    polygon: [
      [0.1, 0.1],
      [0.3, 0.1],
      [0.2, 0.3],
    ],
    label: [0.2, 0.2],
    camera: { x: 0.2, y: 0.2, zoom: 3 },
  },
});

const regions = [region('a'), region('b')];
const [a] = regions as [Region, Region];

function setup(camera: Camera = { x: 0.5, y: 0.5, zoom: 1 }) {
  return renderHook(
    ({ camera: c }) =>
      useRegionTooltip({
        regions,
        inWorld: true,
        svgRef: { current: null },
        labelsRef: { current: null },
        camera: c,
        heroesOf: () => [],
        withMedia: false,
      }),
    { initialProps: { camera } },
  );
}

describe('useRegionTooltip (#193)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('подпись: подсказка через TOOLTIP_OPEN_DELAY; полигон — только подсветка', () => {
    const { result } = setup();
    act(() => result.current.region.onEnter(a));
    act(() => vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY * 2));
    expect(result.current.litId).toBe('a');
    expect(result.current.shownId).toBeNull();

    act(() => result.current.label.onEnter(a));
    act(() => vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY - 1));
    expect(result.current.shownId).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.shownId).toBe('a');

    act(() => result.current.label.onLeave(a));
    act(() => vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY));
    expect(result.current.shownId).toBeNull();
  });

  it('перетаскивание или колесо (камера сдвинулась) прячут подсказку; движение мыши по подписи — снова через задержку', () => {
    const { result, rerender } = setup();
    act(() => result.current.label.onEnter(a));
    act(() => vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY));
    expect(result.current.shownId).toBe('a');

    rerender({ camera: { x: 0.52, y: 0.5, zoom: 1 } });
    expect(result.current.shownId).toBeNull();
    // Мышь стоит на подписи, камера едет дальше (колесо) — подсказки нет.
    rerender({ camera: { x: 0.52, y: 0.5, zoom: 1.2 } });
    act(() => vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY * 2));
    expect(result.current.shownId).toBeNull();

    act(() => result.current.label.onMove(a));
    expect(result.current.shownId).toBeNull();
    act(() => vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY));
    expect(result.current.shownId).toBe('a');
  });

  it('камера сдвинулась, пока шла задержка, — подсказка не появляется', () => {
    const { result, rerender } = setup();
    act(() => result.current.label.onEnter(a));
    act(() => vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY / 2));
    rerender({ camera: { x: 0.5, y: 0.55, zoom: 1 } });
    act(() => vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY));
    expect(result.current.shownId).toBeNull();
  });

  it('глубже TOOLTIP_MAX_ZOOM подсказки нет ни от мыши, ни от фокуса', () => {
    const deep = { x: 0.5, y: 0.5, zoom: TOOLTIP_MAX_ZOOM + 0.5 };
    const { result, rerender } = setup(deep);
    act(() => result.current.region.onFocus(a));
    expect(result.current.shownId).toBeNull();
    act(() => result.current.label.onEnter(a));
    act(() => vi.advanceTimersByTime(TOOLTIP_OPEN_DELAY));
    expect(result.current.shownId).toBeNull();

    rerender({ camera: { x: 0.5, y: 0.5, zoom: TOOLTIP_MAX_ZOOM } });
    // Фокус с клавиатуры держится и после зума — подсказка вернулась.
    expect(result.current.shownId).toBe('a');
  });
});
