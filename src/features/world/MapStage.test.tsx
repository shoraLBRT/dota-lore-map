import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Hero, Region } from '../../data/types';
import { I18nProvider } from '../../i18n';
import { BIOME_COLORS } from './biomes';
import { cameraTransform, placeCamera } from './camera';
import { MapStage } from './MapStage';

const region = (id: string, withLayout: boolean): Region => ({
  id,
  tier: 'continent',
  side: 'neutral',
  name: { ru: `${id} ru`, en: `${id} en` },
  geo: '',
  biome: 'snow',
  places: [{ name: 'Spot', slug: 'spot', capital: false, placement: 'lore', pos: [0.2, 0.2] }],
  regionHeroes: [],
  layout: withLayout
    ? {
        polygon: [
          [0.1, 0.1],
          [0.3, 0.1],
          [0.2, 0.3],
        ],
        label: [0.2, 0.2],
        camera: { x: 0.2, y: 0.2, zoom: 3 },
      }
    : undefined,
});

const heroes = (n: number): Hero[] =>
  Array.from({ length: n }, (_, i) => ({ key: `h${i}`, name: `Hero ${i}`, slug: `hero${i}`, links: [] }));

function renderStage(regions: Region[], activeRegionId?: string, heroCount = 0) {
  const onSelectRegion = vi.fn();
  const onSelectPlace = vi.fn();
  render(
    <I18nProvider initialLang="en">
      <MapStage
        regions={regions}
        activeRegionId={activeRegionId}
        onSelectRegion={onSelectRegion}
        onSelectPlace={onSelectPlace}
        heroesOf={() => heroes(heroCount)}
      />
    </I18nProvider>,
  );
  return { onSelectRegion, onSelectPlace };
}

const tint = (id: string) => document.querySelector(`[data-tint="${id}"]`)!;

describe('MapStage — наведение на регион (S1h)', () => {
  it('мышь: подсветка, подсказка с ≤ 6 портретами и «+N», уход мыши всё снимает', () => {
    renderStage([region('a', true), region('b', true)], undefined, 8);
    const polygon = screen.getByRole('button', { name: 'a en' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.pointerEnter(polygon, { pointerType: 'mouse' });
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('a en');
    expect(within(tip).getAllByRole('img')).toHaveLength(6);
    expect(tip).toHaveTextContent('+2');
    expect(polygon).toHaveAttribute('aria-describedby', tip.id);
    expect(tint('a').getAttribute('class')).toMatch(/lit/);
    expect(tint('b').getAttribute('class')).not.toMatch(/lit/);

    fireEvent.pointerLeave(polygon, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(tint('a').getAttribute('class')).not.toMatch(/lit/);
  });

  it('клавиатура: фокус = наведение', () => {
    renderStage([region('a', true)]);
    const polygon = screen.getByRole('button', { name: 'a en' });
    fireEvent.focus(polygon);
    expect(screen.getByRole('tooltip')).toHaveTextContent('a en');
    expect(tint('a').getAttribute('class')).toMatch(/focused/);
    fireEvent.blur(polygon);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('тач: подсказки нет (SPEC §5.3)', () => {
    renderStage([region('a', true)]);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'a en' }), { pointerType: 'touch' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('в регионе (S2) регионы не кнопки, подсказки региона нет, соседи затемнены', () => {
    renderStage([region('a', true), region('b', true)], 'a');
    expect(screen.queryByRole('button', { name: 'a en' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'b en' })).toBeNull();
    expect(document.querySelector('[data-region="b"]')!.getAttribute('class')).toMatch(/dimmed/);
    expect(document.querySelector('[data-region="a"]')!.getAttribute('class')).not.toMatch(/dimmed/);
    fireEvent.pointerEnter(document.querySelector('[data-region="a"]')!, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('MapStage', () => {
  it('рисует полигоны регионов с layout, остальные — списком', () => {
    const { onSelectRegion } = renderStage([region('a', true), region('b', false)]);
    const polygon = screen.getByRole('button', { name: 'a en' });
    expect(polygon.tagName.toLowerCase()).toBe('polygon');
    expect(polygon).toHaveAttribute('points', '160,100 480,100 320,300');
    expect(polygon).toHaveAttribute('fill', BIOME_COLORS.snow);
    expect(screen.getByRole('navigation').textContent).toBe('b en');

    fireEvent.click(polygon);
    fireEvent.keyDown(screen.getByRole('button', { name: 'b en' }), { key: 'Enter' });
    expect(onSelectRegion).toHaveBeenCalledWith('a');
  });

  it('без layout у всех регионов — только список кнопок', () => {
    const { onSelectRegion } = renderStage([region('a', false), region('b', false)]);
    expect(document.querySelector('svg')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'b en' }));
    expect(onSelectRegion).toHaveBeenCalledWith('b');
  });

  it('в активном регионе показывает маркеры мест и наводит камеру', () => {
    const { onSelectPlace } = renderStage([region('a', true)], 'a');
    fireEvent.click(screen.getByRole('button', { name: 'Spot' }));
    expect(onSelectPlace).toHaveBeenCalledWith('a', 'spot');
    const layer = document.querySelector('svg')!.parentElement!;
    expect(layer.style.transform).toBe(cameraTransform({ x: 0.2, y: 0.2, zoom: 3 }));
  });
});

describe('camera', () => {
  it('весь мир — без сдвига и масштаба', () => {
    expect(cameraTransform({ x: 0.5, y: 0.5, zoom: 1 })).toBe('translate(0%, 0%) scale(1)');
  });
  it('ставит точку камеры в центр кадра', () => {
    expect(cameraTransform({ x: 0.25, y: 0.5, zoom: 2 })).toBe('translate(0%, -50%) scale(2)');
  });
  it('камера места — между регионом и местом, чуть ближе', () => {
    const c = placeCamera({ x: 0.2, y: 0.2, zoom: 2 }, [0.4, 0.6]);
    expect(c.x).toBeCloseTo(0.3);
    expect(c.y).toBeCloseTo(0.4);
    expect(c.zoom).toBeCloseTo(2.3);
  });
});
