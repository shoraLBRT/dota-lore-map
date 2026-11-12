import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { getPlace, getRegion, placeName } from '../../data/world';

// Поиск героя и нити в приложении (E7, SPEC §6.5, §6.6).

const openSearch = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Поиск героя' }));
  return screen.getByRole('combobox', { name: 'Поиск героя' });
};
const badge = () => screen.queryByRole('region', { name: 'Выбранный герой' });
const threads = () => document.querySelectorAll('[data-testid="threads"] path[data-thread]');

describe('поиск героя и нити', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('автодополнение: портрет и имя, алиас рядом; ↑ / ↓ и Enter выбирают', () => {
    window.location.hash = '#/world';
    render(<App />);
    const input = openSearch();
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'пудж' } });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('PudgeПудж');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);

    fireEvent.change(input, { target: { value: 'sv' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const all = screen.getAllByRole('option');
    expect(all.at(-1)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(all[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(input, { target: { value: 'пудж' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(window.location.hash).toBe('#/r/quoidge?hero=pudge');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('ничего не нашли — так и пишет; Esc закрывает только поиск', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const input = openSearch();
    fireEvent.change(input, { target: { value: 'zzzz' } });
    expect(screen.getByText('Никого не нашли')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(window.location.hash).toBe('#/r/icewrack');
  });

  it('одно место — камера к нему; плашка с портретом, ссылкой ↗ и ×, без списка мест', () => {
    window.location.hash = '#/world';
    render(<App />);
    fireEvent.change(openSearch(), { target: { value: 'cm' } });
    fireEvent.click(screen.getAllByRole('option')[0]!);
    expect(window.location.hash).toBe('#/r/icewrack/icewrack?hero=crystal_maiden');
    const plaque = badge()!;
    within(plaque).getByRole('heading', { name: 'Crystal Maiden' });
    expect(within(plaque).getByRole('link', { name: /^dota2.com: Crystal Maiden, официальная страница/ })).toHaveAttribute(
      'href',
      'https://www.dota2.com/hero/crystalmaiden?l=russian',
    );
    expect(within(plaque).queryByRole('navigation')).toBeNull();
    expect(threads()).toHaveLength(0);
    // Место героя подсвечено, остальные маркеры региона приглушены.
    expect(document.querySelector('[data-place="icewrack"]')?.getAttribute('class')).toMatch(/heroSpot/);
    expect(document.querySelector('[data-place="cobalt"]')?.getAttribute('class')).toMatch(/mutedMarker/);

    fireEvent.click(within(plaque).getByRole('button', { name: 'Снять выбор героя' }));
    expect(badge()).toBeNull();
    expect(window.location.hash).toBe('#/r/icewrack/icewrack');
  });

  it('места в разных регионах: мир, остальные регионы приглушены, нити; список мест ведёт к месту, герой остаётся', () => {
    window.location.hash = '#/world?hero=sven';
    render(<App />);
    expect(threads()).toHaveLength(2);
    expect(document.querySelector('polygon[data-region="shadeshore"]')?.getAttribute('class')).not.toMatch(/muted/);
    expect(document.querySelector('polygon[data-region="icewrack"]')?.getAttribute('class')).toMatch(/muted/);
    expect(document.querySelector('[data-tint="wailing-mountains"]')?.getAttribute('class')).toMatch(/lit/);

    const places = within(badge()!).getByRole('navigation', { name: 'Места героя' });
    const feral = getPlace('wailing-mountains', 'feral-road')!;
    fireEvent.click(within(places).getByRole('button', { name: placeName(feral, 'ru') }));
    expect(window.location.hash).toBe('#/r/wailing-mountains/feral-road?hero=sven');
    expect(within(badge()!).getByRole('button', { name: placeName(feral, 'ru') })).toHaveAttribute('aria-current', 'true');
    expect(threads()).toHaveLength(2);
  });

  it('Esc: сначала снимает героя, потом — на уровень вверх', () => {
    window.location.hash = '#/r/quoidge?hero=pudge';
    render(<App />);
    expect(badge()).not.toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(window.location.hash).toBe('#/r/quoidge');
    expect(badge()).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
  });

  it('наведение на портрет героя с несколькими местами рисует его нити, уход — убирает', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    expect(getRegion('icewrack')).toBeDefined();
    const tusk = screen.getByRole('link', { name: /^Tusk — официальная страница/ }).closest('li')!;
    fireEvent.pointerEnter(tusk);
    expect(threads()).toHaveLength(1);
    fireEvent.pointerLeave(tusk);
    expect(threads()).toHaveLength(0);
    // У героя с одним местом нитей нет.
    const cm = screen.getByRole('link', { name: /^Crystal Maiden — официальная страница/ }).closest('li')!;
    fireEvent.focus(cm);
    expect(threads()).toHaveLength(0);
  });

  it('неизвестный герой в адресе — ни плашки, ни нитей', () => {
    window.location.hash = '#/world?hero=nobody';
    render(<App />);
    expect(badge()).toBeNull();
    expect(threads()).toHaveLength(0);
  });
});
