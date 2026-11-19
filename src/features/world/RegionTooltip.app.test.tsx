import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { parseHash } from '../../app/router';
import { getRegion, heroesOfRegion } from '../../data/world';
import { TOOLTIP_HEROES } from './RegionTooltip';
import { pointAtLabel } from './labelHover.testutil';
import { TOOLTIP_OPEN_DELAY } from './useRegionTooltip';

// Подсказка региона в мире (#65): портрет выбирает героя, не уводя камеру; «+N» раскрывает всех на месте.

const heavens = getRegion('heavens')!;

describe('подсказка региона в мире', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    window.location.hash = '#/world';
  });

  it('у Небес есть «+N»: раскрыть, выбрать героя — адрес ?hero=, экран остаётся миром', async () => {
    const all = heroesOfRegion('heavens');
    expect(all.length).toBeGreaterThan(TOOLTIP_HEROES);
    render(<App />);
    // #193: подсказку вызывает подпись региона, а не полигон.
    fireEvent.pointerEnter(screen.getByRole('button', { name: heavens.name.ru }), { pointerType: 'mouse' });
    expect(screen.queryByRole('group', { name: heavens.name.ru })).toBeNull();
    pointAtLabel('heavens');
    await act(() => new Promise((r) => setTimeout(r, TOOLTIP_OPEN_DELAY)));
    const tip = screen.getByRole('group', { name: heavens.name.ru });
    expect(tip.querySelector('[data-counts]')).toHaveTextContent(new RegExp(`^${all.length} геро`));

    const rest = all.length - TOOLTIP_HEROES;
    fireEvent.click(within(tip).getByRole('button', { name: `+${rest}: показать всех героев (${all.length})` }));
    // Кнопки героев; значок медиа региона — отдельная кнопка.
    expect(within(tip).getAllByRole('button', { name: /^(?!Есть медиа)/ })).toHaveLength(all.length);

    const last = all[all.length - 1]!;
    fireEvent.click(within(tip).getByRole('button', { name: last.name }));
    const route = parseHash(window.location.hash);
    expect(route.hero).toBe(last.key);
    expect(route.screen).toEqual({ name: 'world' });
    // Плашка выбранного героя, как после поиска (SPEC §6.5).
    expect(screen.getByRole('button', { name: heavens.name.ru })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(last.name);
  });

  it('клик по региону по-прежнему открывает регион', () => {
    render(<App />);
    const polygon = screen.getByRole('button', { name: heavens.name.ru });
    fireEvent.pointerEnter(polygon, { pointerType: 'mouse' });
    act(() => polygon.focus());
    fireEvent.click(polygon);
    expect(window.location.hash).toBe('#/r/heavens');
  });
});
