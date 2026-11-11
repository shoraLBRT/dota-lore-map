import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Hero, Region } from '../../data/types';
import { I18nProvider } from '../../i18n';
import { BIOME_COLORS } from './biomes';
import { cameraTransform, frameCamera, placeCamera, UNMEASURED } from './camera';
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

function renderStage(regions: Region[], activeRegionId?: string, heroCount = 0, activePlaceSlug?: string) {
  const onSelectRegion = vi.fn();
  const onSelectPlace = vi.fn();
  render(
    <I18nProvider initialLang="en">
      <MapStage
        regions={regions}
        activeRegionId={activeRegionId}
        activePlaceSlug={activePlaceSlug}
        heroesOfSpot={(_, slug) => (slug === 'spot' ? heroes(heroCount) : [])}
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

describe('MapStage — маркеры мест (S2/S3, SPEC §5.4, §6.3)', () => {
  const withPlaces = (): Region => ({
    ...region('a', true),
    places: [
      { name: 'Spot', slug: 'spot', capital: false, placement: 'lore', pos: [0.2, 0.2] },
      { name: 'Capital', slug: 'cap', capital: true, placement: 'lore', pos: [0.22, 0.15] },
      { name: 'Hidden', slug: 'hidden', capital: false, placement: 'lore' },
    ],
  });

  it('маркер — точка в кольце, столица — звезда; место без позиции не рисуется', () => {
    renderStage([withPlaces()], 'a');
    expect(screen.getByRole('button', { name: 'Spot' }).querySelector('polygon')).toBeNull();
    expect(screen.getByRole('button', { name: 'Capital' }).querySelector('polygon')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Capital' }).getAttribute('class')).toMatch(/capital/);
    expect(screen.queryByRole('button', { name: 'Hidden' })).toBeNull();
  });

  it('наведение и фокус на маркер — подсказка с портретами героев места (≤ 6 и «+N»), без героев — нет', () => {
    renderStage([withPlaces()], 'a', 7);
    const spot = screen.getByRole('button', { name: 'Spot' });
    fireEvent.pointerEnter(spot, { pointerType: 'mouse' });
    const tip = screen.getByRole('tooltip');
    expect(within(tip).getAllByRole('img')).toHaveLength(6);
    expect(tip).toHaveTextContent('+1');
    expect(spot).toHaveAttribute('aria-describedby', tip.id);
    fireEvent.pointerLeave(spot, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.focus(spot);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(spot);

    const capital = screen.getByRole('button', { name: 'Capital' });
    fireEvent.focus(capital);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(capital).not.toHaveAttribute('aria-describedby');
  });

  it('тач по маркеру подсказку не показывает', () => {
    renderStage([withPlaces()], 'a', 3);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Spot' }), { pointerType: 'touch' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('в месте (S3) активный маркер выделен, другие кликаются; клик мимо маркеров — назад в регион', () => {
    const { onSelectPlace, onSelectRegion } = renderStage([withPlaces()], 'a', 0, 'spot');
    expect(screen.getByRole('button', { name: 'Spot' })).toHaveAttribute('aria-current', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Capital' }));
    expect(onSelectPlace).toHaveBeenCalledWith('a', 'cap');
    expect(onSelectRegion).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('[data-region="a"]')!);
    expect(onSelectRegion).toHaveBeenCalledWith('a');
  });

  it('без арта региона детальной картинки нет (ARCHITECTURE A10)', () => {
    renderStage([withPlaces()], 'a');
    expect(screen.queryByTestId('region-art')).toBeNull();
  });
});

describe('camera', () => {
  it('весь мир — без сдвига и масштаба', () => {
    expect(cameraTransform({ x: 0.5, y: 0.5, zoom: 1 })).toBe('translate(0%, 0%) scale(1)');
  });
  it('ставит точку камеры в центр кадра', () => {
    expect(cameraTransform({ x: 0.25, y: 0.5, zoom: 2 })).toBe('translate(0%, -50%) scale(2)');
  });
  it('сдвиг под панель: центр кадра левее на половину ширины панели', () => {
    expect(cameraTransform({ x: 0.25, y: 0.5, zoom: 2 }, 240)).toBe('translate(calc(0% - 240px), -50%) scale(2)');
  });
  it('рамка региона под панелью: zoom уменьшается до свободной ширины, без панели — без изменений', () => {
    const camera = { x: 0.5, y: 0.5, zoom: 3 };
    expect(frameCamera(camera, UNMEASURED)).toEqual({ camera, offset: 0 });
    const view = { width: 1600, height: 1000, layerWidth: 1600, layerHeight: 1000, inset: 480 };
    const framed = frameCamera(camera, view);
    expect(framed.offset).toBe(240);
    expect(framed.camera.zoom).toBeCloseTo(3 * (1120 / 1600));
    expect(framed.camera.x).toBeCloseTo(0.5);
    // У края мира центр сдвигается внутрь, чтобы за картинкой не было пустоты.
    const edge = frameCamera({ x: 0.05, y: 0.05, zoom: 3 }, view).camera;
    expect(edge.x).toBeGreaterThan(0.05);
    expect(edge.y).toBeGreaterThan(0.05);
  });
  it('шторка снизу (телефон): центр выше на половину шторки; высокая рамка — zoom уменьшается до свободной высоты', () => {
    const camera = { x: 0.5, y: 0.5, zoom: 2 };
    // Телефон: слой 375×234, кадр 375×760, шторка 244 px — рамка помещается, zoom прежний.
    const phone = { width: 375, height: 760, layerWidth: 375, layerHeight: 234, inset: 0, insetBottom: 244 };
    const framed = frameCamera(camera, phone);
    expect(framed.offset).toBe(0);
    expect(framed.offsetY).toBe(122);
    expect(framed.camera.zoom).toBe(2);
    expect(cameraTransform(framed.camera, framed.offset, framed.offsetY)).toMatch(/^translate\(-?[\d.]+%, calc\(-?[\d.]+% - 122px\)\) scale\(2\)$/);
    // Альбомная ориентация: свободной высоты меньше слоя — zoom уменьшается.
    const landscape = { width: 760, height: 360, layerWidth: 576, layerHeight: 360, inset: 0, insetBottom: 108 };
    expect(frameCamera(camera, landscape).camera.zoom).toBeCloseTo(2 * (252 / 360));
  });
  it('камера места — между регионом и местом, чуть ближе', () => {
    const c = placeCamera({ x: 0.2, y: 0.2, zoom: 2 }, [0.4, 0.6]);
    expect(c.x).toBeCloseTo(0.3);
    expect(c.y).toBeCloseTo(0.4);
    expect(c.zoom).toBeCloseTo(2.3);
  });
});
