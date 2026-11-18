import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorldArt } from './WorldArt';

// Тайлы пирамиды над картинкой мира (#164, ARCHITECTURE A10): внутри того же SVG, что и мир, — двигаются с камерой.
const rect = (left: number, top: number, width: number, height: number) => () =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

function setup(layerWidth: number) {
  const layer = document.createElement('div');
  const frame = document.createElement('div');
  layer.getBoundingClientRect = rect(-2000, -2000, layerWidth, layerWidth);
  frame.getBoundingClientRect = rect(0, 0, 1440, 900);
  return render(
    <svg>
      <WorldArt tiles={{ tile: 512, levels: [4] }} layerRef={{ current: layer }} viewportRef={{ current: frame }} />
    </svg>,
  ).container;
}

describe('WorldArt', () => {
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
