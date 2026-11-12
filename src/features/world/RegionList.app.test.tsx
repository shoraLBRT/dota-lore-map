import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { getPlace, getRegion, placeName } from '../../data/world';
import { MOBILE_QUERY } from './camera';

// Мир на телефоне (#39): список регионов под картой ведёт туда же, куда тап по карте.

let listeners: (() => void)[] = [];
let mobile = true;

function stubMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === MOBILE_QUERY ? mobile : false;
    },
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: (_: string, cb: () => void) => (listeners = listeners.filter((l) => l !== cb)),
  }));
}

const list = () => screen.queryByTestId('region-list');
const icewrack = getRegion('icewrack')!;

describe('список регионов на телефоне', () => {
  beforeEach(() => {
    mobile = true;
    listeners = [];
    stubMedia();
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('мир → пункт списка → регион со шторкой → Esc → снова мир со списком', () => {
    window.location.hash = '#/world';
    render(<App />);
    expect(list()).not.toBeNull();
    // Список сам и есть подсказка: строки «Выберите регион…» на телефоне нет.
    expect(screen.queryByTestId('world-hint')).toBeNull();

    fireEvent.click(within(list()!).getByRole('button', { name: new RegExp(icewrack.name.ru) }));
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(list()).toBeNull();
    expect(screen.getByTestId('panel-sheet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(icewrack.name.ru);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
    expect(list()).not.toBeNull();
  });

  it('клавиатура: регион открыт из списка → Esc из места и региона → фокус на тот же пункт списка', () => {
    window.location.hash = '#/world';
    render(<App />);
    const item = () => list()!.querySelector<HTMLElement>('[data-list-region="icewrack"]')!;
    act(() => item().focus());
    fireEvent.click(item());
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: icewrack.name.ru }));

    // Вглубь, в место, и обратно по Esc: место → регион → мир.
    fireEvent.keyDown(screen.getByRole('button', { name: placeName(getPlace('icewrack', 'cobalt')!, 'ru') }), { key: 'Enter' });
    expect(window.location.hash).toBe('#/r/icewrack/cobalt');
    fireEvent.keyDown(window, { key: 'Escape' });
    act(() => (document.activeElement as HTMLElement).blur());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
    expect(document.activeElement).toBe(item());
  });

  it('открыт тапом по карте — назад в мир фокус на полигон, как на компьютере', () => {
    window.location.hash = '#/world';
    render(<App />);
    const polygon = () => document.querySelector<SVGElement>('[data-region="icewrack"]')!;
    act(() => polygon().focus());
    fireEvent.keyDown(polygon(), { key: 'Enter' });
    expect(window.location.hash).toBe('#/r/icewrack');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
    expect(document.activeElement).toBe(polygon());
  });

  it('пункт списка и тап по карте ведут на один и тот же адрес', () => {
    window.location.hash = '#/world';
    render(<App />);
    fireEvent.click(document.querySelector('[data-region="druud"]')!);
    const viaMap = window.location.hash;
    window.location.hash = '#/world';
    fireEvent(window, new HashChangeEvent('hashchange'));
    fireEvent.click(document.querySelector('[data-list-region="druud"]')!);
    expect(window.location.hash).toBe(viaMap);
  });

  it('выбран герой в мире: список на месте, регионы героя отмечены', () => {
    // Templar Assassin — места в нескольких регионах, камера остаётся в мире.
    window.location.hash = '#/world?hero=templar_assassin';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Templar Assassin' })).toBeInTheDocument();
    const marked = list()!.querySelectorAll('[class*="heroRegion"]');
    expect(marked.length).toBeGreaterThan(1);
    expect(list()!.querySelectorAll('[class*="muted"]').length).toBe(26 - marked.length);
  });

  it('компьютер и планшет (≥ 768): списка нет, подсказка мира — как раньше; поворот телефона включает список', () => {
    mobile = false;
    window.location.hash = '#/world';
    render(<App />);
    expect(list()).toBeNull();
    expect(screen.getByTestId('world-hint')).toBeInTheDocument();

    mobile = true;
    act(() => listeners.forEach((l) => l()));
    expect(list()).not.toBeNull();
  });
});
