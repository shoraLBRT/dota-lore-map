import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hero, Region } from '../../data/types';
import { I18nProvider } from '../../i18n';
import {
  cameraTransform,
  clampCamera,
  frameCamera,
  PLACE_ZOOM,
  placeCamera,
  REGION_ZOOM_MAX,
  UNMEASURED,
  worldListLayout,
} from './camera';
import { MapStage, TOOLTIP_CLOSE_DELAY } from './MapStage';

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
    vi.useFakeTimers();
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

    // Подсказка закрывается с задержкой (#65): успеть перевести на неё мышь.
    fireEvent.pointerLeave(polygon, { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY));
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(tint('a').getAttribute('class')).not.toMatch(/lit/);
    vi.useRealTimers();
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

  it('тач: фокус от тапа не подсвечивает регион (#188)', () => {
    renderStage([region('a', true)]);
    const polygon = screen.getByRole('button', { name: 'a en' });
    fireEvent.pointerDown(polygon, { pointerType: 'touch' });
    fireEvent.focus(polygon);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(tint('a').getAttribute('class')).not.toMatch(/lit/);
  });

  it('мышь: фокус от клика и возврат фокуса после клика не подсвечивают регион (#207)', () => {
    renderStage([region('a', true)]);
    const polygon = screen.getByRole('button', { name: 'a en' });
    fireEvent.pointerDown(polygon, { pointerType: 'mouse' });
    fireEvent.focus(polygon);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(tint('a').getAttribute('class')).not.toMatch(/lit|focused/);
    fireEvent.blur(polygon);
    // Возврат в мир кнопкой «назад» мышью: фокус ставится на полигон программно, последним вводом был указатель.
    fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
    fireEvent.focus(polygon);
    expect(tint('a').getAttribute('class')).not.toMatch(/lit|focused/);
    fireEvent.blur(polygon);
    // Выход по Esc: последним вводом была клавиша — кольцо фокуса по форме региона.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.focus(polygon);
    expect(tint('a').getAttribute('class')).toMatch(/focused/);
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
    // #188: на арте соседей затемняет вуаль с маской по всей сцене, а не по габариту региона.
    const mask = screen.getByTestId('region-veil').querySelector('mask')!;
    expect(mask).toHaveAttribute('maskUnits', 'userSpaceOnUse');
    expect(mask).toHaveAttribute('width', '1600');
    fireEvent.pointerEnter(document.querySelector('[data-region="a"]')!, { pointerType: 'mouse' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  // #94: рамка открытого региона — тон его стороны или яруса (SPEC §8.3), а не красный акцент.
  it.each([
    ['radiant', 'continent', /radiant/],
    ['dire', 'continent', /dire/],
    ['neutral', 'continent', /neutral/],
    ['neutral', 'upper', /upper/],
    ['neutral', 'abyss', /abyss/],
  ] as const)('в регионе (S2) у активного региона (%s, %s) — тон стороны или яруса', (side, tier, tone) => {
    renderStage([{ ...region('a', true), side, tier }, { ...region('b', true), side: 'dire' }], 'a');
    const active = document.querySelector('[data-region="a"]')!.getAttribute('class')!;
    expect(active).toMatch(/active/);
    expect(active).toMatch(tone);
    for (const other of ['radiant', 'dire', 'neutral', 'upper', 'abyss'].filter((t) => !tone.test(t)))
      expect(active).not.toMatch(new RegExp(other));
    expect(document.querySelector('[data-region="b"]')!.getAttribute('class')).not.toMatch(/dire/);
    // Рамку не перекрывают границы соседей: активный полигон рисуется последним.
    expect([...document.querySelectorAll('polygon[data-region]')].at(-1)!.getAttribute('data-region')).toBe('a');
  });
});

describe('MapStage', () => {
  it('рисует полигоны регионов с layout, остальные — списком', () => {
    const { onSelectRegion } = renderStage([region('a', true), region('b', false)]);
    const polygon = screen.getByRole('button', { name: 'a en' });
    expect(polygon.tagName.toLowerCase()).toBe('polygon');
    expect(polygon).toHaveAttribute('points', '160,160 480,160 320,480');
    // Поверх картинки мира (A10) полигон прозрачный: чёрная заливка нужна только для затемнения соседей.
    expect(polygon).toHaveAttribute('fill', '#000');
    expect(document.querySelector('[data-world-art] img:last-of-type')).toHaveAttribute('src', expect.stringMatching(/art\/world-4096\.webp$/));
    expect(screen.getByRole('navigation').textContent).toBe('b en');

    fireEvent.click(polygon);
    fireEvent.keyDown(screen.getByRole('button', { name: 'b en' }), { key: 'Enter' });
    expect(onSelectRegion).toHaveBeenCalledWith('a', 'map');
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

describe('MapStage — список регионов на телефоне (#39)', () => {
  function renderWithList(activeRegionId?: string, focus?: { key: string; regionId: string; tone: 'neutral'; event: 'origin' }[]) {
    const onSelectRegion = vi.fn();
    render(
      <I18nProvider initialLang="en">
        <MapStage
          regions={[region('a', true), region('b', true)]}
          activeRegionId={activeRegionId}
          onSelectRegion={onSelectRegion}
          onSelectPlace={vi.fn()}
          heroesOf={(id) => heroes(id === 'a' ? 1 : 3)}
          focus={focus}
          regionList
        />
      </I18nProvider>,
    );
    return { onSelectRegion };
  }
  const item = (name: RegExp) => within(screen.getByTestId('region-list')).getByRole('button', { name });

  it('в мире — список под картой; нажатие открывает регион, как тап по карте', () => {
    const { onSelectRegion } = renderWithList();
    expect(item(/a en/)).toHaveTextContent('1 hero');
    expect(item(/b en/)).toHaveTextContent('3 heroes');
    fireEvent.click(item(/b en/));
    expect(onSelectRegion).toHaveBeenCalledWith('b', 'list');
  });

  it('фокус и наведение на пункт подсвечивают регион на карте без подсказки', () => {
    renderWithList();
    fireEvent.focus(item(/a en/));
    expect(tint('a').getAttribute('class')).toMatch(/lit/);
    expect(document.querySelector('[data-label="a"]')!.getAttribute('class')).toMatch(/lit/);
    expect(tint('b').getAttribute('class')).not.toMatch(/lit/);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.blur(item(/a en/));
    expect(tint('a').getAttribute('class')).not.toMatch(/lit/);
    fireEvent.pointerEnter(item(/b en/), { pointerType: 'mouse' });
    expect(tint('b').getAttribute('class')).toMatch(/lit/);
  });

  it('в регионе (S2) списка нет — только шторка', () => {
    renderWithList('a');
    expect(screen.queryByTestId('region-list')).toBeNull();
  });

  it('выбран герой: его регион отмечен и в списке', () => {
    renderWithList(undefined, [{ key: 'b', regionId: 'b', tone: 'neutral', event: 'origin' }]);
    expect(item(/b en/).className).toMatch(/heroRegion/);
    expect(item(/a en/).className).toMatch(/muted/);
  });

  it('без regionList (компьютер, планшет) списка нет', () => {
    renderStage([region('a', true)]);
    expect(screen.queryByTestId('region-list')).toBeNull();
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

  it('герой под наведением (#66): его маркер пульсирует, место за кадром — метка у края, клик ведёт туда', () => {
    const names = ['clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight'];
    const saved = names.map((name) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, name));
    const size = (name: string, value: number) =>
      Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => value });
    size('clientWidth', 1000);
    size('clientHeight', 600);
    size('offsetWidth', 960);
    size('offsetHeight', 600);
    try {
      const onSelectSpot = vi.fn();
      const far = { key: 'icewrack', regionId: 'icewrack', point: [0.9, 0.9] as [number, number], tone: 'neutral' as const, event: 'origin' as const };
      render(
        <I18nProvider initialLang="en">
          <MapStage
            regions={[region('a', true)]}
            activeRegionId="a"
            onSelectRegion={vi.fn()}
            onSelectPlace={vi.fn()}
            onSelectSpot={onSelectSpot}
            preview={[{ key: 'a/spot', regionId: 'a', placeSlug: 'spot', point: [0.2, 0.2], tone: 'neutral', event: 'origin' }, far]}
          />
        </I18nProvider>,
      );
      expect(document.querySelector('[data-place="spot"] [data-pulse]')).not.toBeNull();
      // Нитей нет (они — от WorldScreen), а метка у края есть только у места за кадром.
      const exits = screen.getAllByRole('button', { name: /Icewrack/ });
      expect(exits).toHaveLength(1);
      fireEvent.click(exits[0]!);
      expect(onSelectSpot).toHaveBeenCalledWith(far);
    } finally {
      names.forEach((name, i) => {
        const d = saved[i];
        if (d) Object.defineProperty(HTMLElement.prototype, name, d);
        else Reflect.deleteProperty(HTMLElement.prototype, name);
      });
    }
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

describe('MapStage — подписи и подсказки (аудит E13)', () => {
  it('длинное название региона — в две строки, ярус — одной', () => {
    const long: Region = { ...region('a', true), name: { ru: 'Квойдж и Поля Бойни', en: 'Quoidge and the Fields of Carnage' } };
    const tier: Region = { ...region('b', true), tier: 'abyss', name: { ru: 'Семь преисподних и Загробье', en: 'The Seven Hells and the Afterlife' } };
    renderStage([long, tier]);
    const lines = (id: string) => [...document.querySelectorAll(`[data-label="${id}"] tspan`)].map((t) => t.textContent);
    expect(lines('a')).toEqual(['Quoidge and the', 'Fields of Carnage']);
    expect(lines('b')).toEqual([]);
    expect(document.querySelector('[data-label="b"]')!.textContent).toBe('The Seven Hells and the Afterlife');
  });

  it('у столицы подпись есть всегда; у тесно стоящих маркеров лишние подписи прячутся до наведения', () => {
    const crowded: Region = {
      ...region('a', true),
      places: [
        { name: 'Capital', slug: 'cap', capital: true, placement: 'lore', pos: [0.2, 0.2] },
        { name: 'North', slug: 'n', capital: false, placement: 'lore', pos: [0.2, 0.198] },
        { name: 'South', slug: 's', capital: false, placement: 'lore', pos: [0.2, 0.202] },
        { name: 'East', slug: 'e', capital: false, placement: 'lore', pos: [0.202, 0.2] },
        { name: 'West', slug: 'w', capital: false, placement: 'lore', pos: [0.198, 0.2] },
      ],
    };
    renderStage([crowded], 'a');
    const side = (slug: string) => document.querySelector(`[data-place="${slug}"] text`)!.getAttribute('data-side');
    expect(side('cap')).not.toBe('hidden');
    const hidden = ['n', 's', 'e', 'w'].filter((slug) => side(slug) === 'hidden');
    expect(hidden.length).toBeGreaterThan(0);
    for (const slug of hidden) {
      expect(document.querySelector(`[data-place="${slug}"]`)!.getAttribute('class')).toMatch(/labelHidden/);
    }
  });

  it('значимость (#68): место события ярче, второстепенное меньше; подпись события ставится раньше', () => {
    const at = (slug: string, pos: [number, number], significance?: 'event' | 'minor') => ({
      name: slug.toUpperCase(),
      slug,
      capital: false,
      placement: 'lore' as const,
      pos,
      ...(significance && { significance }),
    });
    renderStage([{ ...region('a', true), places: [at('ev', [0.1, 0.1], 'event'), at('mi', [0.2, 0.1], 'minor'), at('old', [0.25, 0.1])] }], 'a');
    const marker = (slug: string) => document.querySelector(`[data-place="${slug}"]`)!;
    const ring = (slug: string) => marker(slug).querySelector('circle:not([r="18"])')!.getAttribute('r');
    expect(marker('ev').getAttribute('data-significance')).toBe('event');
    expect(marker('ev').getAttribute('class')).toMatch(/event/);
    expect(marker('mi').getAttribute('class')).toMatch(/minor/);
    // Нет поля — как место события.
    expect(marker('old').getAttribute('data-significance')).toBe('event');
    expect([ring('ev'), ring('old'), ring('mi')]).toEqual(['9', '9', '7']);
    // Второстепенное место не убираем — оно на карте и кликается.
    expect(screen.getByRole('button', { name: 'MI' })).toBeInTheDocument();
    cleanup();

    // Тесно (пять мест в одной точке — сторон для подписей четыре): второстепенные места идут в данных первыми,
    // но подпись места события встаёт раньше них, прячется последняя из них.
    const crowd = ['m1', 'm2', 'm3', 'm4'].map((slug) => at(slug, [0.2, 0.2], 'minor'));
    renderStage([{ ...region('a', true), places: [...crowd, at('ev', [0.2, 0.2], 'event')] }], 'a');
    const side = (slug: string) => document.querySelector(`[data-place="${slug}"] text`)!.getAttribute('data-side');
    expect(side('ev')).toBe('top');
    expect(side('m4')).toBe('hidden');
  });

  describe('подсказка региона ждёт посадки камеры', () => {
    let finish: (() => void)[] = [];
    const original = Element.prototype.animate;

    beforeEach(() => {
      finish = [];
      Element.prototype.animate = vi.fn(function () {
        let resolve!: () => void;
        const finished = new Promise<void>((res) => {
          resolve = res;
        });
        finish.push(() => resolve());
        return { finished, cancel: () => undefined } as unknown as Animation;
      });
    });

    afterEach(() => {
      Element.prototype.animate = original;
    });

    it('регион → мир: фокус на полигоне, подсказка появляется только после перелёта', async () => {
      const props = {
        regions: [region('a', true), region('b', true)],
        onSelectRegion: vi.fn(),
        onSelectPlace: vi.fn(),
        heroesOf: () => heroes(2),
      };
      const { rerender } = render(
        <I18nProvider initialLang="en">
          <MapStage {...props} activeRegionId="a" />
        </I18nProvider>,
      );
      rerender(
        <I18nProvider initialLang="en">
          <MapStage {...props} />
        </I18nProvider>,
      );
      // Перелёт — у слоя карты и у экранного слоя подписей (#180).
      expect(Element.prototype.animate).toHaveBeenCalledTimes(2);
      fireEvent.focus(screen.getByRole('button', { name: 'a en' }));
      expect(screen.queryByRole('tooltip')).toBeNull();

      await act(async () => {
        finish.shift()?.();
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(screen.getByRole('tooltip')).toHaveTextContent('a en');
    });
  });
});

describe('MapStage — мир с открытой панелью (#97)', () => {
  const original = Element.prototype.animate;
  const sizes = ['offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight'] as const;
  // Свои свойства прототипа (offset*) возвращаем, унаследованные от Element (client*) — просто снимаем.
  const own = sizes.map((k) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k));
  beforeEach(() => {
    Element.prototype.animate = vi.fn(() => ({ finished: new Promise(() => undefined), cancel: () => undefined }) as unknown as Animation);
    document.documentElement.style.setProperty('--panel-inset', '480px');
    for (const k of sizes) {
      Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => (k.endsWith('Width') ? 1600 : 1000) });
    }
  });
  afterEach(() => {
    Element.prototype.animate = original;
    document.documentElement.style.removeProperty('--panel-inset');
    sizes.forEach((k, i) => {
      const d = own[i];
      if (d) Object.defineProperty(HTMLElement.prototype, k, d);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
    });
  });

  it('панель открыта — карта переезжает влево от неё, закрыта — обратно на весь кадр', () => {
    const props = { regions: [region('a', true)], onSelectRegion: vi.fn(), onSelectPlace: vi.fn(), heroesOf: () => heroes(0) };
    const stage = (panel: boolean) => (
      <I18nProvider initialLang="en">
        <MapStage {...props} panel={panel} />
      </I18nProvider>
    );
    const { rerender, container } = render(stage(false));
    const layer = () => container.querySelector<HTMLElement>('svg')!.parentElement!;
    expect(layer().style.transform).toBe('translate(0%, 0%) scale(1)');
    rerender(stage(true));
    // Слой покрывает кадр (#165): мир не ужимается, сдвиг под панель гасится прижатием к краю картинки.
    expect(layer().style.transform).toBe('translate(calc(15% - 240px), 0%) scale(1)');
    // Экранный слой подписей (#180) летит вместе со слоем карты: тот же transform и та же анимация.
    const screenLayer = () => container.querySelector<HTMLElement>('[data-screen-layer]')!.parentElement!;
    expect(screenLayer().style.transform).toBe(layer().style.transform);
    const contexts = () => vi.mocked(Element.prototype.animate).mock.contexts;
    expect(contexts()).toEqual([layer(), screenLayer()]);
    expect(vi.mocked(Element.prototype.animate).mock.calls[1]?.[1]).toMatchObject({ duration: 700 });
    rerender(stage(false));
    expect(layer().style.transform).toBe('translate(0%, 0%) scale(1)');
    expect(screenLayer().style.transform).toBe('translate(0%, 0%) scale(1)');
    expect(contexts()).toHaveLength(4);
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
  it('кадр самого маленького региона не ближе REGION_ZOOM_MAX, места — ×PLACE_ZOOM (#179)', () => {
    const view = { width: 1440, height: 900, layerWidth: 1440, layerHeight: 1440, inset: 0 };
    const region = { x: 0.5, y: 0.5, zoom: 5 };
    expect(frameCamera(region, view).camera.zoom).toBe(REGION_ZOOM_MAX);
    const place = placeCamera(region, [0.5, 0.5]);
    const box = { left: 0.45, top: 0.45, right: 0.55, bottom: 0.55 };
    expect(frameCamera(place, view, { box, place: [0.5, 0.5] }).camera.zoom).toBeCloseTo(REGION_ZOOM_MAX * PLACE_ZOOM);
    // Телефон: вписанный мир уже кадра, потолок не достигается.
    const phone = { width: 375, height: 812, layerWidth: 812, layerHeight: 812, inset: 0 };
    expect(frameCamera(region, phone).camera.zoom).toBeCloseTo(5 * (375 / 812));
  });

  it('рамка региона под панелью: zoom — от вписанного мира, до свободной ширины', () => {
    const camera = { x: 0.5, y: 0.5, zoom: 3 };
    expect(frameCamera(camera, UNMEASURED)).toEqual({ camera, offset: 0 });
    // Кадр 1600×1000, слой покрывает его: 1600×1600; вписанный мир — 1000 px, свободно 1120 px.
    const view = { width: 1600, height: 1000, layerWidth: 1600, layerHeight: 1600, inset: 480 };
    const framed = frameCamera(camera, view);
    expect(framed.offset).toBe(240);
    expect(framed.camera.zoom).toBeCloseTo(3 * (1000 / 1600));
    expect(framed.camera.x).toBeCloseTo(0.5);
    // У края мира центр сдвигается внутрь: за картинкой пустоты нет.
    const edge = frameCamera({ x: 0.05, y: 0.05, zoom: 3 }, view).camera;
    const k = 1600 * edge.zoom;
    expect(edge.x + 240 / k - 1600 / k / 2).toBeCloseTo(0);
    expect(edge.y - 1000 / k / 2).toBeCloseTo(0);
  });
  it('регион у правого края мира встаёт в свободную часть кадра, а не под панель (#112)', () => {
    const view = { width: 1600, height: 1000, layerWidth: 1600, layerHeight: 1600, inset: 480 };
    const { camera, offset } = frameCamera({ x: 0.95, y: 0.5, zoom: 3 }, view);
    const k = 1600 * camera.zoom;
    // Центр свободной части (560 px) — на центре региона; правый край свободной части (1120 px) — не дальше края мира.
    expect(camera.x).toBeCloseTo(1 - 560 / k);
    expect(camera.x + offset / k + (1120 - 800) / k).toBeLessThanOrEqual(1 + 1e-9);
    // Свободная камера с тем же кадром (без сдвига) прижимается так же: перетаскивание не дёргает карту.
    const free = clampCamera({ x: camera.x + offset / k, y: 0.5, zoom: camera.zoom }, view);
    expect(free.x).toBeCloseTo(camera.x + offset / k);
    // Без панели — прижимается весь кадр.
    expect(clampCamera({ x: 0.95, y: 0.5, zoom: camera.zoom }, { ...view, inset: 0 }).x).toBeCloseTo(1 - 800 / k);
  });
  it('камера места не уводит регион из кадра больше, чем нужно (#96)', () => {
    const view = { width: 1600, height: 1000, layerWidth: 1600, layerHeight: 1600, inset: 480 };
    const zoom = 3 * (1000 / 1600);
    const seen = 1120 / (1600 * zoom);
    // Регион шириной 0.3 помещается: центр, сдвинутый к месту, возвращается так, чтобы регион остался в кадре.
    const fits = frameCamera({ x: 0.55, y: 0.3, zoom: 3 }, view, {
      box: { left: 0.3, top: 0.2, right: 0.6, bottom: 0.4 },
      place: [0.58, 0.3],
    }).camera;
    expect(fits.x - seen / 2).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(fits.x + seen / 2).toBeGreaterThanOrEqual(0.6 - 1e-9);
    // Регион шириной 0.6 не помещается: вылезает поровну за оба края…
    const box = { left: 0.2, top: 0.2, right: 0.8, bottom: 0.4 };
    expect(frameCamera({ x: 0.7, y: 0.3, zoom: 3 }, view, { box, place: [0.55, 0.3] }).camera.x).toBeCloseTo(0.8 - seen / 2);
    // …но место у края региона не уходит к краю кадра ближе чем на пятую часть видимой ширины.
    expect(frameCamera({ x: 0.7, y: 0.3, zoom: 3 }, view, { box, place: [0.76, 0.3] }).camera.x).toBeCloseTo(0.76 - seen * 0.3);
  });
  it('шторка снизу (телефон): центр выше на половину шторки; zoom не меньше 1 — карта всегда во весь кадр', () => {
    // Телефон: кадр 375×760, слой 760×760, вписанный мир — 375 px, шторка 244 px.
    const phone = { width: 375, height: 760, layerWidth: 760, layerHeight: 760, inset: 0, insetBottom: 244 };
    const framed = frameCamera({ x: 0.5, y: 0.5, zoom: 4 }, phone);
    expect(framed.offset).toBe(0);
    expect(framed.offsetY).toBe(122);
    expect(framed.camera.zoom).toBeCloseTo(4 * (375 / 760));
    expect(cameraTransform(framed.camera, framed.offset, framed.offsetY)).toMatch(/^translate\(-?[\d.]+%, calc\(-?[\d.]+% - 122px\)\) scale\([\d.]+\)$/);
    expect(frameCamera({ x: 0.5, y: 0.5, zoom: 2 }, phone).camera.zoom).toBe(1);
    // Альбомная ориентация: свободной высоты меньше вписанного мира — zoom уменьшается.
    const landscape = { width: 760, height: 360, layerWidth: 760, layerHeight: 760, inset: 0, insetBottom: 108 };
    expect(frameCamera({ x: 0.5, y: 0.5, zoom: 4 }, landscape).camera.zoom).toBeCloseTo(4 * (360 / 760) * (252 / 360));
  });
  it('мир под панелью (#97): карта остаётся во весь кадр, под панелью — тоже арт', () => {
    const view = { width: 1440, height: 900, layerWidth: 1440, layerHeight: 1440, inset: 492 };
    const framed = frameCamera({ x: 0.5, y: 0.5, zoom: 1 }, view);
    expect(framed.offset).toBe(246);
    expect(framed.camera.zoom).toBe(1);
    expect(framed.camera.x).toBeCloseTo(0.5 - 246 / 1440);
  });
  it('отрицательный сдвиг по вертикали — вниз', () => {
    expect(cameraTransform({ x: 0.5, y: 0.5, zoom: 1 }, 0, -40)).toBe('translate(0%, calc(0% + 40px)) scale(1)');
  });
  it('мир со списком регионов (#39): мир вписан и прижат к верху, список под ним; боком — карта слева, список справа', () => {
    // 375×812: кадр под полосой 375×760, слой покрывает его — 760×760.
    const portrait = { width: 375, height: 760, layerWidth: 760, layerHeight: 760, inset: 0 };
    const p = worldListLayout(portrait);
    expect(p.camera.zoom).toBeCloseTo(375 / 760);
    expect(p.offset).toBe(0);
    expect(p.offsetY).toBe(192.5);
    expect(p.map).toEqual({ top: 0, left: 0, width: 375, height: 375 });
    expect(p.list).toEqual({ top: 375, left: 0, width: 375, height: 385 });
    // Плашка героя сверху: карта встаёт под неё, сдвиг меньше.
    const withBar = worldListLayout(portrait, 150);
    expect(withBar.offsetY).toBe(42.5);
    expect(withBar.list).toEqual({ top: 525, left: 0, width: 375, height: 235 });
    // Плашка выше свободного места — карта у низа кадра, список пустой.
    expect(worldListLayout(portrait, 900).list.height).toBe(0);
    // 667×375 боком: кадр 667×323, слой 667×667.
    const landscape = worldListLayout({ width: 667, height: 323, layerWidth: 667, layerHeight: 667, inset: 0 });
    expect(landscape.offset).toBe(172);
    expect(landscape.offsetY).toBe(0);
    expect(landscape.list).toEqual({ top: 0, left: 323, width: 344, height: 323 });
    // Без измерений — без сдвига.
    expect(worldListLayout(UNMEASURED)).toMatchObject({ offset: 0, offsetY: 0 });
  });
  it('камера места — между регионом и местом, чуть ближе', () => {
    const c = placeCamera({ x: 0.2, y: 0.2, zoom: 2 }, [0.4, 0.6]);
    expect(c.x).toBeCloseTo(0.3);
    expect(c.y).toBeCloseTo(0.4);
    expect(c.zoom).toBeCloseTo(2.3);
  });
});

describe('MapStage — подсказка региона с героями (#65)', () => {
  function renderPickable(count = 8) {
    const onPickHero = vi.fn();
    const onSelectRegion = vi.fn();
    render(
      <I18nProvider initialLang="en">
        <button type="button">before</button>
        <MapStage
          regions={[region('a', true), region('b', true)]}
          onSelectRegion={onSelectRegion}
          onSelectPlace={vi.fn()}
          heroesOf={(id) => (id === 'a' ? heroes(count) : [])}
          onPickHero={onPickHero}
        />
      </I18nProvider>,
    );
    const polygon = screen.getByRole('button', { name: 'a en' });
    return { onPickHero, onSelectRegion, polygon, tip: () => screen.queryByRole('group', { name: 'a en' }) };
  }

  afterEach(() => vi.useRealTimers());

  it('мышь с региона на подсказку держит её открытой, уход с подсказки закрывает', () => {
    vi.useFakeTimers();
    const { polygon, tip } = renderPickable();
    fireEvent.pointerEnter(polygon, { pointerType: 'mouse' });
    fireEvent.pointerLeave(polygon, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY / 2));
    fireEvent.pointerEnter(tip()!);
    act(() => vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY * 2));
    expect(tip()).not.toBeNull();
    expect(tint('a').getAttribute('class')).toMatch(/lit/);

    fireEvent.pointerLeave(tip()!);
    act(() => vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY));
    expect(tip()).toBeNull();
  });

  it('сосед на пути к подсказке не перехватывает её, сосед в стороне — сразу (#101)', () => {
    vi.useFakeTimers();
    const { polygon, tip } = renderPickable();
    const b = screen.getByRole('button', { name: 'b en' });
    const at = (x: number, y: number) => ({ pointerType: 'mouse', clientX: x, clientY: y });
    fireEvent.pointerMove(window, at(100, 100));
    fireEvent.pointerEnter(polygon, at(100, 100));
    vi.spyOn(tip()!, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 50, 200, 100));
    // К подсказке через b: подсказка остаётся у a и доживает до входа мыши на неё.
    fireEvent.pointerMove(window, at(150, 100));
    fireEvent.pointerLeave(polygon, at(160, 100));
    fireEvent.pointerEnter(b, at(160, 100));
    fireEvent.pointerMove(window, at(220, 100));
    act(() => vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY / 2));
    fireEvent.pointerLeave(b, at(290, 100));
    fireEvent.pointerEnter(tip()!);
    act(() => vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY * 2));
    expect(polygon.getAttribute('aria-describedby')).toBe(tip()!.id);

    // С подсказки обратно на a, затем на b — в сторону от подсказки: подсказка сразу у b.
    fireEvent.pointerLeave(tip()!);
    fireEvent.pointerEnter(polygon, at(100, 100));
    fireEvent.pointerMove(window, at(100, 100));
    fireEvent.pointerLeave(polygon, at(100, 160));
    fireEvent.pointerEnter(b, at(100, 160));
    expect(b.getAttribute('aria-describedby')).not.toBeNull();
  });

  it('портрет выбирает героя, «+N» раскрывает всех на месте, клик по региону открывает регион', () => {
    const { onPickHero, onSelectRegion, polygon, tip } = renderPickable();
    fireEvent.pointerEnter(polygon, { pointerType: 'mouse' });
    expect(within(tip()!).getByText('Click a hero to show them on the map')).toBeInTheDocument();

    const portrait = within(tip()!).getByRole('button', { name: 'Hero 2' });
    fireEvent.pointerEnter(portrait.parentElement!);
    expect(within(tip()!).getByText('Hero 2')).toBeInTheDocument();
    fireEvent.click(portrait);
    expect(onPickHero).toHaveBeenCalledWith(expect.objectContaining({ key: 'h2' }));
    expect(onSelectRegion).not.toHaveBeenCalled();

    const more = within(tip()!).getByRole('button', { name: '+2: show all heroes (8)' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(within(tip()!).getAllByRole('button')).toHaveLength(8);
    expect(within(tip()!).queryByText('+2')).toBeNull();
    fireEvent.click(within(tip()!).getByRole('button', { name: 'Hero 7' }));
    expect(onPickHero).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'h7' }));

    // Подсказка ушла на другой регион и вернулась — снова свёрнуто.
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'b en' }), { pointerType: 'mouse' });
    fireEvent.pointerEnter(polygon, { pointerType: 'mouse' });
    expect(within(tip()!).getAllByRole('button')).toHaveLength(7);

    fireEvent.click(polygon);
    expect(onSelectRegion).toHaveBeenCalledWith('a', 'map');
  });

  it('без героев подсказка без кнопок: только название', () => {
    render(
      <I18nProvider initialLang="en">
        <MapStage
          regions={[region('b', true)]}
          onSelectRegion={vi.fn()}
          onSelectPlace={vi.fn()}
          heroesOf={() => []}
          onPickHero={vi.fn()}
        />
      </I18nProvider>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'b en' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('b en');
  });

  it('клавиатура: Tab с региона — в подсказку, Shift+Tab — назад, Tab с последней — к следующему региону', () => {
    const { polygon, tip } = renderPickable(3);
    act(() => polygon.focus());
    expect(tip()).not.toBeNull();
    fireEvent.keyDown(polygon, { key: 'Tab' });
    const buttons = within(tip()!).getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveFocus();

    fireEvent.keyDown(buttons[0]!, { key: 'Tab', shiftKey: true });
    expect(polygon).toHaveFocus();
    expect(tip()).not.toBeNull();

    fireEvent.keyDown(polygon, { key: 'Tab' });
    act(() => within(tip()!).getAllByRole('button')[2]!.focus());
    expect(tip()).not.toBeNull();
    fireEvent.keyDown(within(tip()!).getAllByRole('button')[2]!, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'b en' })).toHaveFocus();
    expect(tip()).toBeNull();
  });

  it('клавиатура: «+N» ставит фокус на первый раскрытый портрет', () => {
    const { polygon, tip } = renderPickable();
    act(() => polygon.focus());
    fireEvent.keyDown(polygon, { key: 'Tab' });
    const more = within(tip()!).getByRole('button', { name: /^\+2/ });
    act(() => more.focus());
    fireEvent.click(more);
    expect(within(tip()!).getByRole('button', { name: 'Hero 6' })).toHaveFocus();
  });

  it('Esc в подсказке закрывает её и возвращает фокус на регион, не доходя до окна', () => {
    const onWindowKey = vi.fn();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onWindowKey();
    window.addEventListener('keydown', onKey);
    const { polygon, tip } = renderPickable(3);
    act(() => polygon.focus());
    fireEvent.keyDown(polygon, { key: 'Tab' });
    fireEvent.keyDown(within(tip()!).getAllByRole('button')[1]!, { key: 'Escape' });
    expect(tip()).toBeNull();
    expect(polygon).toHaveFocus();
    expect(onWindowKey).not.toHaveBeenCalled();

    // Снова на регион — подсказка снова есть; Esc на регионе тоже закрывает.
    act(() => polygon.blur());
    act(() => polygon.focus());
    expect(tip()).not.toBeNull();
    fireEvent.keyDown(polygon, { key: 'Escape' });
    expect(tip()).toBeNull();
    expect(onWindowKey).not.toHaveBeenCalled();
    window.removeEventListener('keydown', onKey);
  });
});
