import { render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { AmbientCanvas } from '../atmosphere/AmbientCanvas';
import { MOBILE_QUERY } from './camera';
import { MapAtmosphere } from './MapAtmosphere';

// #255: галерея на весь экран телефона закрывает карту — облака, туман и частицы не рисуются, слои карты скрыты.

function stubMedia(mobile: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === MOBILE_QUERY ? mobile : false,
    addEventListener() {},
    removeEventListener() {},
  }));
}

/** Канвас с пустым контекстом и счётчик запросов кадра. */
function stubFrames() {
  // Любой метод контекста возвращает сам контекст: градиенты и прочее «работают», ничего не рисуя.
  const ctx: CanvasRenderingContext2D = new Proxy({} as CanvasRenderingContext2D, { get: () => () => ctx, set: () => true });
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  restoreCanvas = () => getContext.mockRestore();
  return { frames };
}

let restoreCanvas = () => {};

const viewport = () => document.querySelector('[data-map-viewport]');

describe('карта под галереей (#255)', () => {
  afterEach(() => {
    restoreCanvas();
    restoreCanvas = () => {};
    vi.unstubAllGlobals();
  });

  it('частицы с paused не просят кадров, без него — снова рисуют', () => {
    const { frames } = stubFrames();
    const view = render(<AmbientCanvas ambient={{ type: 'snow', density: 0.5 }} paused />);
    expect(frames).toHaveLength(0);
    view.rerender(<AmbientCanvas ambient={{ type: 'snow', density: 0.5 }} paused={false} />);
    expect(frames).toHaveLength(1);
    view.unmount();
  });

  it('облака и туман с paused не просят кадров, без него — снова рисуют', () => {
    const { frames } = stubFrames();
    const layerRef = createRef<HTMLDivElement>();
    const view = render(<MapAtmosphere layerRef={layerRef} paused />);
    expect(frames).toHaveLength(0);
    view.rerender(<MapAtmosphere layerRef={layerRef} paused={false} />);
    expect(frames).toHaveLength(1);
    view.unmount();
  });

  it('на телефоне галерея ставит карту на паузу, закрытая — снимает', async () => {
    stubMedia(true);
    window.location.hash = '#/r/icewrack/frostreach?media=frostreach-the-dragon';
    render(<App />);
    await waitFor(() => expect(viewport()).toHaveAttribute('data-paused'));
    window.location.hash = '#/r/icewrack/frostreach';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(viewport()).not.toHaveAttribute('data-paused'));
  });

  it('на компьютере галерея карту не останавливает: вокруг окна карта видна', async () => {
    stubMedia(false);
    window.location.hash = '#/r/icewrack/frostreach?media=frostreach-the-dragon';
    render(<App />);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    expect(viewport()).not.toHaveAttribute('data-paused');
  });
});
