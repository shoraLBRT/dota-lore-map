import { afterEach, describe, expect, it } from 'vitest';
import { PAGE_ZOOM_ATTR, pageZoomed, watchPageZoom } from './pageZoom';

/** Подменный visualViewport: jsdom его не знает. */
function fakeViewport(scale: number) {
  const vv = Object.assign(new EventTarget(), { scale });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
  return vv;
}

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
});

describe('pageZoom (#252)', () => {
  it('без visualViewport страница не приближена', () => {
    expect(pageZoomed()).toBe(false);
  });

  it('масштаб больше 1 — приближена; дробный хвост у 1 — нет', () => {
    fakeViewport(1.6);
    expect(pageZoomed()).toBe(true);
    fakeViewport(1.004);
    expect(pageZoomed()).toBe(false);
  });

  it('атрибут на <html> следует за масштабом и снимается при отписке', () => {
    const vv = fakeViewport(1);
    const root = document.documentElement;
    const stop = watchPageZoom(root);
    expect(root.hasAttribute(PAGE_ZOOM_ATTR)).toBe(false);
    vv.scale = 2;
    vv.dispatchEvent(new Event('resize'));
    expect(root.hasAttribute(PAGE_ZOOM_ATTR)).toBe(true);
    vv.scale = 1;
    vv.dispatchEvent(new Event('resize'));
    expect(root.hasAttribute(PAGE_ZOOM_ATTR)).toBe(false);
    vv.scale = 2;
    vv.dispatchEvent(new Event('resize'));
    stop();
    expect(root.hasAttribute(PAGE_ZOOM_ATTR)).toBe(false);
  });
});
