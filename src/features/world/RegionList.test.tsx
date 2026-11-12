import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Lang, Region } from '../../data/types';
import { world } from '../../data/world';
import { I18nProvider } from '../../i18n';
import { RegionList } from './RegionList';

// Список регионов под картой мира на телефоне (#39).

function renderList(lang: Lang, focus?: Set<string>, regions: Region[] = world.regions) {
  const onSelect = vi.fn();
  const onHighlight = vi.fn();
  render(
    <I18nProvider initialLang={lang}>
      <RegionList
        regions={regions}
        onSelect={onSelect}
        onHighlight={onHighlight}
        heroCountOf={(id) => (id === 'empire-of-bone' ? 1 : id === 'druud' ? 2 : 7)}
        focus={focus}
      />
    </I18nProvider>,
  );
  return { onSelect, onHighlight };
}

const groupNames = (nav: HTMLElement, title: string) =>
  within(within(nav).getByRole('region', { name: title }))
    .getAllByRole('button')
    .map((b) => b.querySelector('[class*="name"]')!.textContent);

describe('RegionList', () => {
  it('все 26 регионов по группам сверху вниз, как на карте; внутри группы — по алфавиту', () => {
    renderList('ru');
    const nav = screen.getByRole('navigation', { name: 'Регионы' });
    expect(within(nav).getAllByRole('button')).toHaveLength(world.regions.length);
    expect(within(nav).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Верхний ярус',
      'Radiant',
      'Нейтральные земли',
      'Dire',
      'Бездна',
    ]);
    expect(groupNames(nav, 'Верхний ярус')).toEqual(['Небеса', 'Семь планов и Пустота']);
    const radiant = groupNames(nav, 'Radiant');
    expect(radiant).toHaveLength(8);
    expect(radiant).toEqual([...radiant].sort((a, b) => a!.localeCompare(b!, 'ru')));
    expect(groupNames(nav, 'Dire')).toHaveLength(10);
    expect(groupNames(nav, 'Нейтральные земли')).toHaveLength(4);
    expect(groupNames(nav, 'Бездна')).toHaveLength(2);
  });

  it('EN: названия на языке интерфейса, артикль «The» не влияет на порядок', () => {
    renderList('en');
    const nav = screen.getByRole('navigation', { name: 'Regions' });
    expect(groupNames(nav, 'Upper tier')).toEqual(['The Heavens', 'The Seven Planes and the Void']);
    const radiant = groupNames(nav, 'Radiant');
    expect(radiant.indexOf('The Free Cities')).toBeLessThan(radiant.indexOf('Icewrack'));
  });

  it('число героев с правильной формой слова (RU и EN)', () => {
    renderList('ru');
    expect(screen.getByRole('button', { name: /Империя Костей/ })).toHaveTextContent('1 герой');
    expect(screen.getByRole('button', { name: /Друуд/ })).toHaveTextContent('2 героя');
    expect(screen.getByRole('button', { name: /Айсрак/ })).toHaveTextContent('7 героев');
  });

  it('EN: 1 hero / 7 heroes', () => {
    renderList('en');
    expect(screen.getByRole('button', { name: /Empire of Bone/ })).toHaveTextContent('1 hero');
    expect(screen.getByRole('button', { name: /Icewrack/ })).toHaveTextContent('7 heroes');
  });

  it('нажатие — выбор региона; наведение мышью и фокус подсвечивают, тач — нет', () => {
    const { onSelect, onHighlight } = renderList('ru');
    const item = screen.getByRole('button', { name: /Айсрак/ });
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalledWith('icewrack');

    fireEvent.pointerEnter(item, { pointerType: 'touch' });
    expect(onHighlight).not.toHaveBeenCalled();
    fireEvent.pointerEnter(item, { pointerType: 'mouse' });
    expect(onHighlight).toHaveBeenLastCalledWith('icewrack');
    fireEvent.pointerLeave(item, { pointerType: 'mouse' });
    expect(onHighlight).toHaveBeenLastCalledWith(null);
    fireEvent.focus(item);
    expect(onHighlight).toHaveBeenLastCalledWith('icewrack');
    fireEvent.blur(item);
    expect(onHighlight).toHaveBeenLastCalledWith(null);
  });

  it('цвет стороны или яруса — класс пункта, как подсветка на карте', () => {
    renderList('ru');
    expect(screen.getByRole('button', { name: /Айсрак/ }).className).toMatch(/radiant/);
    expect(screen.getByRole('button', { name: /Друуд/ }).className).toMatch(/dire/);
    expect(screen.getByRole('button', { name: /Срединные/ }).className).toMatch(/neutral/);
    expect(screen.getByRole('button', { name: /Небеса/ }).className).toMatch(/upper/);
    expect(screen.getByRole('button', { name: /Подземье/ }).className).toMatch(/abyss/);
  });

  it('выбран герой: его регионы отмечены, остальные приглушены, но нажимаются', () => {
    const { onSelect } = renderList('ru', new Set(['icewrack']));
    expect(screen.getByRole('button', { name: /Айсрак/ }).className).toMatch(/heroRegion/);
    const other = screen.getByRole('button', { name: /Друуд/ });
    expect(other.className).toMatch(/muted/);
    fireEvent.click(other);
    expect(onSelect).toHaveBeenCalledWith('druud');
  });
});
