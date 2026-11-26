import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHero, getPlace, getRegion, placeName } from '../data/world';
import { MOBILE_QUERY } from '../features/world/camera';
import { App } from './App';

// Навигация (#230, SPEC §5.1 «Правила окон»): путь вверху карты, × у каждого окна,
// без «Свернуть» и чипа героя, клик по пустой карте ничего не закрывает, шторки на телефоне.

const icewrack = getRegion('icewrack')!;
const pool = getPlace('icewrack', 'black-pool')!;
const poolName = placeName(pool, 'ru');
const tusk = getHero('tusk')!;

let listeners: (() => void)[] = [];
let mobile = false;

function stubMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === MOBILE_QUERY ? mobile : false;
    },
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: (_: string, cb: () => void) => (listeners = listeners.filter((l) => l !== cb)),
  }));
}

const go = (hash: string) => window.history.replaceState(null, '', `/${hash}`);
const path = () => screen.getByRole('navigation', { name: 'Путь' });
const heading = () => screen.getByRole('heading', { level: 2 });
const close = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  listeners = [];
  stubMedia();
  window.localStorage.setItem('dota-lore-map.lang', 'ru');
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('навигация на компьютере', () => {
  beforeEach(() => {
    mobile = false;
  });

  it('Н1, Н2, Н3: путь вверху вместо крошек, × ведёт на шаг вверх, ромба «Свернуть» нет', () => {
    go('#/r/icewrack/black-pool');
    render(<App />);
    expect(heading()).toHaveTextContent(poolName);
    const steps = within(path()).getAllByRole('listitem').map((li) => li.textContent);
    expect(steps).toEqual(['Мир', icewrack.name.ru, poolName]);
    expect(within(path()).getByText(poolName)).toHaveAttribute('aria-current', 'location');
    expect(screen.queryByRole('navigation', { name: 'Навигация по уровням' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Свернуть панель' })).toBeNull();

    close(`Закрыть: ${poolName}`);
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(heading()).toHaveTextContent(icewrack.name.ru);

    close(`Закрыть: ${icewrack.name.ru}`);
    expect(window.location.hash).toBe('#/world');
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.queryByTestId('path-bar')).toBeNull();
  });

  it('Н1: звено пути ведёт туда — из места сразу в мир', () => {
    go('#/r/icewrack/black-pool');
    render(<App />);
    fireEvent.click(within(path()).getByRole('button', { name: 'Мир' }));
    expect(window.location.hash).toBe('#/world');
  });

  it('Н4: клик по пустой карте в месте ничего не закрывает', () => {
    go('#/r/icewrack/black-pool');
    const { container } = render(<App />);
    fireEvent.click(container.querySelector('[data-map-viewport]')!);
    expect(window.location.hash).toBe('#/r/icewrack/black-pool');
    expect(heading()).toHaveTextContent(poolName);
  });

  it('Н5, Н6, Н7: герой — это профиль поверх панели; × и Esc закрывают его вместе с героем, чипа нет', () => {
    go(`#/r/icewrack?hero=${tusk.key}`);
    render(<App />);
    // Адрес без флага profile (старые ссылки) с флагом показывает профиль: выбранного героя без профиля нет.
    expect(heading()).toHaveTextContent(tusk.name);
    expect(within(path()).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Мир', icewrack.name.ru, tusk.name]);

    close('Закрыть профиль');
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(heading()).toHaveTextContent(icewrack.name.ru);
    expect(screen.queryByRole('region', { name: 'Выбранный герой' })).toBeNull();

    go(`#/r/icewrack?hero=${tusk.key}&profile`);
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(heading()).toHaveTextContent(tusk.name);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(heading()).toHaveTextContent(icewrack.name.ru);
  });

  it('Н1, Н6: звено региона под профилем закрывает профиль; переход на другой экран снимает героя', () => {
    go(`#/r/icewrack?hero=${tusk.key}&profile`);
    render(<App />);
    fireEvent.click(within(path()).getByRole('button', { name: icewrack.name.ru }));
    expect(window.location.hash).toBe('#/r/icewrack');

    go(`#/r/icewrack?hero=${tusk.key}&profile`);
    fireEvent(window, new HashChangeEvent('hashchange'));
    fireEvent.click(within(path()).getByRole('button', { name: 'Мир' }));
    expect(window.location.hash).toBe('#/world');
  });

  it('Н7: профиль сворачивается до шапки и разворачивается обратно', () => {
    go(`#/world?hero=${tusk.key}&profile`);
    render(<App />);
    const panel = screen.getByRole('complementary', { name: tusk.name });
    fireEvent.click(within(panel).getByRole('button', { name: 'Свернуть до шапки' }));
    // Видна только шапка: название и ×, текст профиля скрыт.
    expect(panel.lastElementChild).toHaveAttribute('hidden');
    expect(heading()).toHaveTextContent(tusk.name);
    expect(within(panel).getByRole('button', { name: 'Закрыть профиль' })).toBeVisible();
    fireEvent.click(within(panel).getByRole('button', { name: 'Развернуть профиль' }));
    expect(heading()).toHaveTextContent(tusk.name);
    expect(window.location.hash).toBe(`#/world?hero=${tusk.key}&profile`);
  });

  it('Н11: нажатие на карту поиск не закрывает, тап вне поля без сдвига — закрывает', () => {
    go('#/world');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Поиск героя' }));
    const input = screen.getByRole('combobox');
    input.focus();
    const map = document.querySelector('[data-map-viewport]')!;
    // Перетаскивание: нажали, увели фокус в никуда, отпустили далеко — поиск открыт.
    fireEvent.pointerDown(map, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.blur(input, { relatedTarget: null });
    fireEvent.pointerUp(map, { pointerId: 1, clientX: 200, clientY: 160 });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    // Тап на месте — закрыт.
    fireEvent.pointerDown(map, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(map, { pointerId: 2, clientX: 101, clientY: 100 });
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

describe('навигация на телефоне', () => {
  beforeEach(() => {
    mobile = true;
  });

  const list = () => screen.getByTestId('region-list');
  const handle = () => within(list()).getByRole('button', { name: 'Регионы' });

  it('Н8: тап по затемнённой карте и «назад» сворачивают шторку «Регионы», ручку тянут пальцем', async () => {
    go('#/world');
    render(<App />);
    fireEvent.click(handle());
    expect(list()).toHaveAttribute('data-state', 'open');
    fireEvent.click(screen.getByTestId('region-list-scrim'));
    expect(list()).toHaveAttribute('data-state', 'closed');

    fireEvent.pointerDown(handle(), { pointerId: 1, clientY: 700 });
    fireEvent.pointerUp(handle(), { pointerId: 1, clientY: 600 });
    fireEvent.click(handle());
    expect(list()).toHaveAttribute('data-state', 'open');

    window.history.back();
    await waitFor(() => expect(list()).toHaveAttribute('data-state', 'closed'));
    expect(window.location.hash).toBe('#/world');

    fireEvent.click(handle());
    fireEvent.pointerDown(handle(), { pointerId: 2, clientY: 300 });
    fireEvent.pointerUp(handle(), { pointerId: 2, clientY: 400 });
    fireEvent.click(handle());
    expect(list()).toHaveAttribute('data-state', 'closed');
  });

  it('Н9: шторка места — × в шапке, свайп вниз из заголовка закрывает (шаг вверх)', () => {
    go('#/r/icewrack/black-pool');
    render(<App />);
    const sheet = screen.getByTestId('panel-sheet');
    expect(sheet).toHaveAttribute('data-state', 'peek');
    expect(within(sheet).getByRole('button', { name: `Закрыть: ${poolName}` })).toBeInTheDocument();
    const grip = sheet.querySelector('button')!;
    fireEvent.pointerDown(grip, { pointerId: 1, clientY: 500 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 900 });
    fireEvent.pointerUp(grip, { pointerId: 1, clientY: 900 });
    expect(window.location.hash).toBe('#/r/icewrack');
  });
});
