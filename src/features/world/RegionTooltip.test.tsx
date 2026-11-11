import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Hero, Region } from '../../data/types';
import { I18nProvider } from '../../i18n';
import { placeTooltip, RegionTooltip, splitHeroes } from './RegionTooltip';

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
    // Портреты в подсказке не кликаются (SPEC §5.3).
    expect(within(tip).queryByRole('link')).toBeNull();
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
});
