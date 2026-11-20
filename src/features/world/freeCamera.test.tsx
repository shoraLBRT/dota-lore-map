import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { clampCamera, FREE_ZOOM_MAX, maxZoom } from './camera';
import {
  anchorAt,
  atZoomFloor,
  centered,
  useFreeCamera,
  decay,
  limitWheel,
  panBy,
  WHEEL_MAX_DELTA,
  wheelDelta,
  wheelFactor,
  worldAt,
  ZOOM_STEP,
  zoomAt,
} from './freeCamera';

// Кадр 1440×900, слой покрывает его — 1440×1440 (#165).
const view = { width: 1440, height: 900, layerWidth: 1440, layerHeight: 1440, inset: 0 };

describe('свободная камера (#165)', () => {
  it('за краем мира пустоты нет: zoom ≥ 1, центр держит кадр на картинке', () => {
    expect(clampCamera({ x: 0, y: 0, zoom: 0.5 }, view)).toEqual({ x: 0.5, y: 900 / 1440 / 2, zoom: 1 });
    const c = clampCamera({ x: 1, y: 1, zoom: 2 }, view);
    expect(c.x).toBeCloseTo(1 - 1440 / 2880 / 2);
    expect(c.y).toBeCloseTo(1 - 900 / 2880 / 2);
    expect(clampCamera({ x: 0.5, y: 0.5, zoom: 100 }, view).zoom).toBe(maxZoom(view));
  });

  it('перетаскивание: карта едет за пальцем и упирается в край', () => {
    const c = { x: 0.5, y: 0.5, zoom: 2 };
    expect(panBy(c, view, 288, 0).x).toBeCloseTo(0.5 - 288 / 2880);
    expect(panBy(c, view, 100000, 0).x).toBeCloseTo(0.25);
  });

  it('зум вокруг курсора: точка мира под курсором остаётся на месте', () => {
    const c = { x: 0.5, y: 0.5, zoom: 1.5 };
    const before = worldAt(c, view, 400, 300);
    const after = zoomAt(c, view, 1.6, 400, 300);
    expect(after.zoom).toBeCloseTo(2.4);
    const [wx, wy] = worldAt(after, view, 400, 300);
    expect(wx).toBeCloseTo(before[0]);
    expect(wy).toBeCloseTo(before[1]);
    expect(anchorAt(view, after.zoom, before, 400, 300)).toEqual(after);
  });

  it('камера со сдвигом под панель → точка в центре всего кадра', () => {
    expect(centered({ x: 0.4, y: 0.5, zoom: 2 }, view, 288)).toEqual({ x: 0.5, y: 0.5, zoom: 2 });
  });

  it('колесо вниз отдаляет, вверх приближает; инерция затухает', () => {
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100) * wheelFactor(-100)).toBeCloseTo(1);
    expect(decay(1, 16)).toBeCloseTo(0.92);
    expect(decay(1, 32)).toBeCloseTo(0.92 * 0.92);
  });

  it('потолок свободной камеры — FREE_ZOOM_MAX от «мир целиком» (#179)', () => {
    expect(maxZoom(view)).toBe(FREE_ZOOM_MAX);
    expect(maxZoom({ width: 375, height: 812, layerWidth: 812, layerHeight: 812, inset: 0 })).toBe(FREE_ZOOM_MAX);
    // Огромный экран: ближе разрешения арта не приближаем.
    expect(maxZoom({ width: 3840, height: 2160, layerWidth: 3840, layerHeight: 3840, inset: 0 })).toBe(2);
  });

  it('колесо: от «мир целиком» до потолка — не меньше 5 щелчков; шаг кнопок ~1.3 (#179)', () => {
    let zoom = 1;
    let clicks = 0;
    while (zoom < FREE_ZOOM_MAX) {
      zoom = clampCamera({ x: 0.5, y: 0.5, zoom: zoom * wheelFactor(-100) }, view).zoom;
      clicks += 1;
    }
    expect(clicks).toBeGreaterThanOrEqual(5);
    expect(ZOOM_STEP).toBeCloseTo(1.3);
  });

  it('колесо: шаг за событие не больше щелчка, частые события тачпада не разгоняют зум (#179)', () => {
    expect(wheelDelta(-400)).toBe(-WHEEL_MAX_DELTA);
    expect(wheelDelta(3, 1)).toBeCloseTo(WHEEL_MAX_DELTA);
    expect(wheelDelta(9, 1)).toBe(WHEEL_MAX_DELTA);
    expect(wheelDelta(-20)).toBe(-20);
    // Тачпад: 30 событий по −20 px за 240 мс — не больше трёх щелчков, а не шесть.
    let budget = { left: WHEEL_MAX_DELTA, at: 0 };
    let total = 0;
    for (let i = 0; i < 30; i += 1) {
      const step = limitWheel(-20, budget, i * 8);
      budget = step.budget;
      total += step.delta;
    }
    expect(total).toBeLessThan(0);
    expect(-total).toBeLessThanOrEqual(3 * WHEEL_MAX_DELTA);
    // Мышь: щелчок раз в 150 мс проходит целиком.
    expect(limitWheel(100, { left: 0, at: 0 }, 150).delta).toBe(100);
  });
});

describe('выход из региона колесом (#190)', () => {
  it('нижний упор уровня: дальше не отдалить', () => {
    const region = { ...view, zoomMin: 2, zoomMax: 3 };
    expect(atZoomFloor({ x: 0.5, y: 0.5, zoom: 2 }, region)).toBe(true);
    expect(atZoomFloor({ x: 0.5, y: 0.5, zoom: 2.2 }, region)).toBe(false);
  });

  it('колесо наружу на упоре зовёт onFloor, выше упора — только отдаляет', () => {
    const onFloor = vi.fn();
    function Stage({ zoom }: { zoom: number }) {
      const viewportRef = useRef<HTMLDivElement>(null);
      const layerRef = useRef<HTMLDivElement>(null);
      useFreeCamera({
        viewportRef,
        layerRef,
        view: { ...view, zoomMin: 2, zoomMax: 3 },
        current: () => ({ x: 0.5, y: 0.5, zoom }),
        enabled: true,
        onChange: () => {},
        home: { x: 0.5, y: 0.5, zoom: 2 },
        resetKey: zoom,
        attached: true,
        onFloor,
      });
      return (
        <div ref={viewportRef} data-testid="vp">
          <div ref={layerRef} />
        </div>
      );
    }
    const { getByTestId, rerender } = render(<Stage zoom={2.5} />);
    fireEvent.wheel(getByTestId('vp'), { deltaY: 100 });
    expect(onFloor).not.toHaveBeenCalled();
    rerender(<Stage zoom={2} />);
    fireEvent.wheel(getByTestId('vp'), { deltaY: 100, timeStamp: 1000 });
    expect(onFloor).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

describe('жесты на телефоне (#196)', () => {
  function touch(el: Element, type: string, id: number, x: number, y: number, t: number) {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(e, 'pointerId', { value: id });
    Object.defineProperty(e, 'pointerType', { value: 'touch' });
    Object.defineProperty(e, 'timeStamp', { value: t });
    el.dispatchEvent(e);
  }
  function Stage({ zoom, onFloor, onChange }: { zoom: number; onFloor?: () => void; onChange: (c: { zoom: number }) => void }) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const layerRef = useRef<HTMLDivElement>(null);
    useFreeCamera({
      viewportRef,
      layerRef,
      view: { ...view, zoomMin: 2, zoomMax: 3 },
      current: () => ({ x: 0.5, y: 0.5, zoom }),
      enabled: true,
      onChange,
      home: { x: 0.5, y: 0.5, zoom: 2 },
      resetKey: zoom,
      attached: true,
      onFloor,
    });
    return (
      <div ref={viewportRef} data-testid="vp">
        <div ref={layerRef} />
      </div>
    );
  }

  it('двойное касание пустого места приближает вдвое (до потолка уровня); одиночное — нет', () => {
    // Без анимации: камера встаёт на место сразу.
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
    const onChange = vi.fn();
    const { getByTestId } = render(<Stage zoom={1.2} onChange={onChange} />);
    const vp = getByTestId('vp');
    touch(vp, 'pointerdown', 1, 100, 100, 0);
    touch(vp, 'pointerup', 1, 100, 100, 50);
    expect(onChange).not.toHaveBeenCalled();
    touch(vp, 'pointerdown', 1, 104, 102, 200);
    touch(vp, 'pointerup', 1, 104, 102, 250);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0].zoom).toBeCloseTo(2.4);
    // Слишком поздно — снова одиночное.
    touch(vp, 'pointerdown', 1, 100, 100, 1000);
    touch(vp, 'pointerup', 1, 100, 100, 1050);
    touch(vp, 'pointerdown', 1, 100, 100, 1500);
    touch(vp, 'pointerup', 1, 100, 100, 1550);
    expect(onChange).toHaveBeenCalledTimes(1);
    cleanup();
    vi.unstubAllGlobals();
  });

  it('щипок дальше нижнего упора региона зовёт onFloor; щипок до упора — нет', () => {
    const onFloor = vi.fn();
    const { getByTestId } = render(<Stage zoom={2} onFloor={onFloor} onChange={() => {}} />);
    const vp = getByTestId('vp');
    const pinch = (to: number) => {
      touch(vp, 'pointerdown', 1, 500, 400, 0);
      touch(vp, 'pointerdown', 2, 700, 400, 0);
      touch(vp, 'pointermove', 2, 500 + to, 400, 20);
      touch(vp, 'pointerup', 2, 500 + to, 400, 40);
      touch(vp, 'pointerup', 1, 500, 400, 40);
    };
    // Пальцы сошлись на 10 % — упор держит камеру.
    pinch(180);
    expect(onFloor).not.toHaveBeenCalled();
    // Вдвое — выход в мир.
    pinch(100);
    expect(onFloor).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
