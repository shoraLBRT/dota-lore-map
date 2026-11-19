import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorldArt } from './WorldArt';

// Арт мира (ARCHITECTURE A10): HTML-картинки в слое камеры (#185) и тайлы пирамиды над ними (#164).
const rect = (left: number, top: number, width: number, height: number) => () =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

function setup(layerWidth: number) {
  const layer = document.createElement('div');
  const frame = document.createElement('div');
  layer.getBoundingClientRect = rect(-2000, -2000, layerWidth, layerWidth);
  frame.getBoundingClientRect = rect(0, 0, 1440, 900);
  return render(
    <WorldArt tiles={{ tile: 512, levels: [4] }} layerRef={{ current: layer }} viewportRef={{ current: frame }} />,
  ).container;
}

describe('WorldArt', () => {
  it('полная картинка проявляется после загрузки и декодирования', async () => {
    const c = setup(1440);
    const full = c.querySelector<HTMLImageElement>('img[src$="world-4096.webp"]')!;
    expect(full).not.toHaveAttribute('data-ready');
    full.decode = () => Promise.resolve();
    fireEvent.load(full);
    await waitFor(() => expect(full).toHaveAttribute('data-ready'));
  });

  it('полная картинка ждёт load страницы и грузится с низким приоритетом (#186)', async () => {
    const state = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const c = setup(1440);
    expect(c.querySelector('img[src$="world-4096.webp"]')).toBeNull();
    state.mockReturnValue('complete');
    window.dispatchEvent(new Event('load'));
    await waitFor(() => expect(c.querySelector('img[src$="world-4096.webp"]')).toHaveAttribute('fetchpriority', 'low'));
    state.mockRestore();
  });

  it('под интро полной картинки нет в DOM — она не станет элементом LCP; после интро вставляется (#186)', async () => {
    const props = { tiles: undefined, layerRef: { current: null }, viewportRef: { current: null } };
    const { container, rerender } = render(<WorldArt {...props} deferFull />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector('img[src$="world-4096.webp"]')).toBeNull();
    rerender(<WorldArt {...props} deferFull={false} />);
    expect(container.querySelector('img[src$="world-4096.webp"]')).toHaveAttribute('fetchpriority', 'low');
    rerender(<WorldArt {...props} deferFull />);
    expect(container.querySelector('img[src$="world-4096.webp"]')).not.toBeNull();
  });

  it('без сильного приближения — только картинка мира', () => {
    expect(setup(1440).querySelectorAll('[data-world-tiles] image')).toHaveLength(0);
  });

  it('при приближении — видимые тайлы на своих местах; проявляются после загрузки', () => {
    const c = setup(6144);
    const tiles = c.querySelectorAll('[data-world-tiles] image');
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(30);
    const first = tiles[0]!;
    expect(first.getAttribute('href')).toMatch(/map\/tiles\/4\/\d+_\d+\.webp$/);
    expect(first.getAttribute('width')).toBe('100');
    const loadedBefore = first.getAttribute('class');
    fireEvent.load(first);
    expect(first.getAttribute('class')).not.toBe(loadedBefore);
  });
});
