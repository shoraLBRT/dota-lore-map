import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Hero, Region } from '../../data/types';
import { I18nProvider, translate, type MessageKey } from '../../i18n';
import { clampTooltip, overlap, placeTooltip, RegionTooltip, regionCounts, splitHeroes, type Box } from './RegionTooltip';

const heroes = (n: number): Hero[] =>
  Array.from({ length: n }, (_, i) => ({ key: `h${i}`, name: `Hero ${i}`, slug: `hero${i}`, links: [] }));

const region: Region = {
  id: 'icewrack',
  tier: 'continent',
  side: 'radiant',
  name: { ru: 'Айсрак', en: 'Icewrack' },
  subtitle: { ru: 'Ледяной край', en: 'Frozen land' },
  geo: '',
  places: [
    { name: 'A', slug: 'a', capital: false, placement: 'lore', pos: [0.1, 0.1] },
    { name: 'B', slug: 'b', capital: false, placement: 'lore', pos: [0.2, 0.2] },
  ],
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
  it('название, подзаголовок, не больше 5 портретов с плашкой «+N», число героев и мест (#193)', () => {
    const tip = renderTooltip(heroes(9));
    expect(tip).toHaveTextContent('Icewrack');
    expect(tip).toHaveTextContent('Frozen land');
    expect(within(tip).getAllByRole('img')).toHaveLength(5);
    expect(within(tip).getByLabelText('and 4 more')).toHaveTextContent('+4');
    expect(tip.querySelector('[data-counts]')).toHaveTextContent('9 heroes · 2 places');
    // Подсказки про клик по герою больше нет (#193).
    expect(tip).not.toHaveTextContent(/click/i);
    // Без onPick портреты не кликаются и ссылок нет (SPEC §5.3, #65).
    expect(within(tip).queryByRole('link')).toBeNull();
    expect(within(tip).queryByRole('button')).toBeNull();
  });

  it('5 и меньше героев — без «+N»', () => {
    const tip = renderTooltip(heroes(5));
    expect(within(tip).getAllByRole('img')).toHaveLength(5);
    expect(tip.textContent).not.toMatch(/\+\d/);
  });

  it('без героев ряд портретов не рисуется', () => {
    const tip = renderTooltip([]);
    expect(within(tip).queryByRole('list')).toBeNull();
  });

  it('regionCounts: формы числа по-русски и по-английски, нули не пишутся', () => {
    const t = (lang: 'ru' | 'en') => (key: MessageKey, vars?: Record<string, string>) => translate(lang, key, vars);
    expect(regionCounts('ru', 1, 2, t('ru'))).toBe('1 герой · 2 места');
    expect(regionCounts('ru', 5, 21, t('ru'))).toBe('5 героев · 21 место');
    expect(regionCounts('en', 1, 1, t('en'))).toBe('1 hero · 1 place');
    expect(regionCounts('en', 0, 3, t('en'))).toBe('3 places');
    expect(regionCounts('ru', 0, 0, t('ru'))).toBe('');
  });

  it('splitHeroes', () => {
    expect(splitHeroes(heroes(8))).toMatchObject({ rest: 3 });
    expect(splitHeroes(heroes(8)).shown).toHaveLength(5);
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

  describe('у подписи региона (#193)', () => {
    const label = { left: 450, top: 290, right: 550, bottom: 310 };
    const at = (l: Box, avoid: Box[] = [], size = tip) => placeTooltip({ x: 500, y: 300, label: l, avoid, minLeft: 64 }, size, view);
    const covers = (p: { left: number; top: number }, b: Box) =>
      overlap({ left: p.left, top: p.top, right: p.left + tip.width, bottom: p.top + tip.height }, b) > 0;

    it('снизу под подписью, по её центру, и не на ней', () => {
      const p = at(label);
      expect(p).toEqual({ left: 400, top: 316 });
      expect(covers(p, label)).toBe(false);
    });

    it('снизу соседняя подпись — сверху', () => {
      const neighbour = { left: 420, top: 330, right: 580, bottom: 350 };
      const p = at(label, [neighbour]);
      expect(p).toEqual({ left: 400, top: 184 });
      expect(covers(p, neighbour)).toBe(false);
    });

    it('соседи со всех сторон — та сторона, где закрыто меньше всего', () => {
      const below = { left: 400, top: 320, right: 600, bottom: 400 };
      const above = { left: 400, top: 190, right: 600, bottom: 280 };
      const right = { left: 560, top: 250, right: 760, bottom: 350 };
      const left = { left: 300, top: 290, right: 340, bottom: 300 };
      expect(at(label, [below, above, right, left])).toEqual({ left: 244, top: 250 });
    });

    it('у нижнего края — над подписью', () => {
      expect(at({ left: 450, top: 520, right: 550, bottom: 540 })).toEqual({ left: 400, top: 414 });
    });

    it('не левее левой полосы и не за правым краем окна', () => {
      expect(at({ left: 60, top: 290, right: 120, bottom: 310 }).left).toBe(72);
      expect(at({ left: 880, top: 290, right: 980, bottom: 310 }).left).toBe(792);
    });

    it('ни одна сторона не подошла — у якоря, как без подписи', () => {
      const big = { width: 900, height: 560 };
      expect(at(label, [], big)).toEqual(placeTooltip({ x: 500, y: 300 }, big, view));
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
