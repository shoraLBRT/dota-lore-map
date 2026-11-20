import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '../../data/types';
import { I18nProvider } from '../../i18n';
import { inView, WorldMarkers } from './WorldMarkers';
import type { WorldPlaceItem, WorldPlaceSpot } from './worldPlaces';

afterEach(cleanup);

const unmeasured = { width: 0, height: 0, layerWidth: 0, layerHeight: 0, inset: 0 };
const framed = { camera: { x: 0.5, y: 0.5, zoom: 2 }, offset: 0 };

const place = (slug: string, capital: boolean): Place => ({ name: slug, slug, capital, placement: 'lore', pos: [0.3, 0.3] });
const item = (regionId: string, p: Place, from: number): WorldPlaceItem => ({
  key: `${regionId}/${p.slug}`,
  regionId,
  place: p,
  x: 0.3,
  y: 0.3,
  ring: 9,
  size: 17,
  width: 60,
  from,
});

function renderAt(zoom: number, onSelectPlace = vi.fn()) {
  const items = [item('a', place('cap', true), 1.5), item('a', place('spot', false), 1.8), item('b', place('far', false), 1.9)];
  const spots = new Map<string, WorldPlaceSpot>([
    ['a/cap', { side: 'right', from: 1.5 }],
    ['a/spot', { side: 'hidden', from: 1.8 }],
    ['b/far', { side: 'right', from: Infinity }],
  ]);
  render(
    <I18nProvider initialLang="en">
      <svg>
        <WorldMarkers items={items} spots={spots} zoom={zoom} pxScale={1} view={unmeasured} framed={framed} focusPlaces={null} onSelectPlace={onSelectPlace} />
      </svg>
    </I18nProvider>,
  );
  return onSelectPlace;
}

const shown = () => [...document.querySelectorAll('[data-world-place][data-shown]')].map((e) => e.getAttribute('data-world-place'));

describe('WorldMarkers — места в мире (#190)', () => {
  it('маркер виден с порога: на 1× — ничего, на 1.5 — столица, глубже — остальные; без места в мире — никогда', () => {
    renderAt(1);
    expect(shown()).toEqual([]);
    cleanup();
    renderAt(1.5);
    expect(shown()).toEqual(['a/cap']);
    cleanup();
    renderAt(2.5);
    expect(shown()).toEqual(['a/cap', 'a/spot']);
    // Место без места в мире не монтируется; прочие смонтированы и скрыты до порога.
    expect(document.querySelector('[data-world-place="b/far"]')).toBeNull();
  });

  it('клик по маркеру сразу открывает место, скрытый до порога маркер не кликается; скрытая подпись — класс как у маркера региона', () => {
    const hidden = renderAt(1.6);
    fireEvent.click(document.querySelector('[data-world-place="a/spot"]')!);
    expect(hidden).not.toHaveBeenCalled();
    cleanup();
    const onSelectPlace = renderAt(2);
    fireEvent.click(document.querySelector('[data-world-place="a/spot"]')!);
    expect(onSelectPlace).toHaveBeenCalledWith('a', 'spot');
    expect(document.querySelector('[data-world-place="a/spot"]')!.getAttribute('class')).toMatch(/labelHidden/);
    expect(document.querySelector('[data-world-place="a/cap"] [data-shape]')!.getAttribute('data-shape')).toBe('star');
  });
});

describe('маркеры мира за краем кадра не рисуются (#190, A14)', () => {
  it('в кадре и с запасом под подпись — да, далеко за краем — нет; без замера — все', () => {
    const view = { width: 1000, height: 800, layerWidth: 1000, layerHeight: 1000, inset: 0 };
    expect(inView({ x: 0.5, y: 0.5 }, view, framed)).toBe(true);
    expect(inView({ x: 0.27, y: 0.5 }, view, framed)).toBe(true);
    expect(inView({ x: 0.05, y: 0.5 }, view, framed)).toBe(false);
    expect(inView({ x: 0.05, y: 0.5 }, unmeasured, framed)).toBe(true);
  });
});
