import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Hero, Region } from '../../data/types';
import { I18nProvider } from '../../i18n';
import { clampTooltip, placeTooltip, RegionTooltip, splitHeroes } from './RegionTooltip';

const heroes = (n: number): Hero[] =>
  Array.from({ length: n }, (_, i) => ({ key: `h${i}`, name: `Hero ${i}`, slug: `hero${i}`, links: [] }));

const region: Region = {
  id: 'icewrack',
  tier: 'continent',
  side: 'radiant',
  name: { ru: 'Айсрак', en: 'Icewrack' },
  subtitle: { ru: 'Ледяной край', en: 'Frozen land' },
  geo: '',
  places: [],
  regionHeroes: [],
};

function renderTooltip(list: Hero[]) {
  render(
    <I18nProvider initialLang="en">
      <RegionTooltip id="tip" region={region} heroes={list} getAnchor={() => ({ x: 100, y: 100 })} />
    </I18nProvider>,
  );
  return screen.getByRole('tooltip');
}

describe('RegionTooltip', () => {
  it('название, подзаголовок и не больше 6 портретов с плашкой «+N»', () => {
    const tip = renderTooltip(heroes(9));
    expect(tip).toHaveTextContent('Icewrack');
    expect(tip).toHaveTextContent('Frozen land');
    expect(within(tip).getAllByRole('img')).toHaveLength(6);
    expect(within(tip).getByLabelText('and 3 more')).toHaveTextContent('+3');
    // Без onPick портреты не кликаются и ссылок нет (SPEC §5.3, #65).
    expect(within(tip).queryByRole('link')).toBeNull();
    expect(within(tip).queryByRole('button')).toBeNull();
  });

  it('6 и меньше героев — без «+N»', () => {
    const tip = renderTooltip(heroes(6));
    expect(within(tip).getAllByRole('img')).toHaveLength(6);
    expect(tip.textContent).not.toMatch(/\+\d/);
  });

  it('без героев ряд портретов не рисуется', () => {
    const tip = renderTooltip([]);
    expect(within(tip).queryByRole('list')).toBeNull();
  });

  it('splitHeroes', () => {
    expect(splitHeroes(heroes(8))).toMatchObject({ rest: 2 });
    expect(splitHeroes(heroes(8)).shown).toHaveLength(6);
    expect(splitHeroes(heroes(2))).toMatchObject({ rest: 0 });
  });
});

describe('placeTooltip', () => {
  const view = { width: 1000, height: 600 };
  const tip = { width: 200, height: 100 };

  it('по центру под якорем', () => {
    expect(placeTooltip({ x: 500, y: 200 }, tip, view)).toEqual({ left: 400, top: 218 });
  });

  it('не выходит за левый и правый край окна', () => {
    expect(placeTooltip({ x: 10, y: 200 }, tip, view).left).toBe(8);
    expect(placeTooltip({ x: 990, y: 200 }, tip, view).left).toBe(792);
  });

  it('у нижнего края — над якорем', () => {
    expect(placeTooltip({ x: 500, y: 560 }, tip, view).top).toBe(442);
  });

  describe('рядом с габаритом региона (#101)', () => {
    const at = (box: { left: number; top: number; right: number; bottom: number }, x = 500, y = 300) =>
      placeTooltip({ x, y, box, minLeft: 64 }, tip, view);
    const overlaps = (p: { left: number; top: number }, b: { left: number; top: number; right: number; bottom: number }) =>
      p.left < b.right && p.left + tip.width > b.left && p.top < b.bottom && p.top + tip.height > b.top;

    it('справа, на высоте названия', () => {
      const box = { left: 400, top: 200, right: 600, bottom: 400 };
      expect(at(box)).toEqual({ left: 606, top: 250 });
    });

    it('у правого края — слева', () => {
      const box = { left: 700, top: 200, right: 900, bottom: 400 };
      expect(at(box, 800)).toEqual({ left: 494, top: 250 });
    });

    it('слева — левая полоса: снизу', () => {
      const box = { left: 200, top: 100, right: 850, bottom: 300 };
      const p = at(box, 500, 200);
      expect(p).toEqual({ left: 400, top: 306 });
      expect(overlaps(p, box)).toBe(false);
    });

    it('снизу не помещается — сверху', () => {
      const box = { left: 200, top: 250, right: 850, bottom: 550 };
      expect(at(box, 500, 400)).toEqual({ left: 400, top: 144 });
    });

    it('не правее левой полосы и не за краем окна', () => {
      const box = { left: 100, top: 250, right: 850, bottom: 550 };
      expect(at(box, 120, 400).left).toBe(72);
    });

    it('ни одна сторона не подошла — у якоря, как без габарита', () => {
      const box = { left: 100, top: 50, right: 950, bottom: 550 };
      expect(at(box)).toEqual(placeTooltip({ x: 500, y: 300 }, tip, view));
    });
  });
});

describe('clampTooltip', () => {
  const view = { width: 1000, height: 600 };

  it('выросшая подсказка остаётся на месте, если помещается', () => {
    expect(clampTooltip({ left: 100, top: 50 }, { width: 200, height: 300 }, view)).toEqual({ left: 100, top: 50 });
  });

  it('и только вдвигается внутрь окна', () => {
    expect(clampTooltip({ left: 900, top: 400 }, { width: 200, height: 300 }, view)).toEqual({ left: 792, top: 292 });
    expect(clampTooltip({ left: 100, top: 400 }, { width: 200, height: 900 }, view).top).toBe(8);
  });
});
