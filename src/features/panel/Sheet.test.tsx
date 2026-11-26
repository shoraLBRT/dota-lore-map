import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { useMediaQuery } from '../../app/media';
import { getRegion } from '../../data/world';
import { MOBILE_QUERY } from '../world/camera';
import { SHEET_HEAD_PX, settleSheet } from './Sheet';

// Телефон (SPEC §13): правая панель — нижняя шторка в три положения (заголовок, половина экрана, ~90 %), «потянуть».

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

const sheet = () => screen.getByTestId('panel-sheet');
const handle = () => sheet().querySelector('button')!;

describe('нижняя шторка', () => {
  beforeEach(() => {
    mobile = true;
    listeners = [];
    stubMedia();
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('на телефоне вместо дока — шторка, открывается свёрнутой; тап по ручке разворачивает и сворачивает', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    expect(screen.queryByTestId('panel-dock')).toBeNull();
    expect(sheet()).toHaveAttribute('data-state', 'peek');
    expect(screen.getByRole('complementary', { name: getRegion('icewrack')!.name.ru })).toBeInTheDocument();
    expect(handle()).toHaveAccessibleName('Развернуть панель');
    expect(handle()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-state', 'full');
    expect(handle()).toHaveAccessibleName('Свернуть панель');
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-state', 'peek');
  });

  it('шапка шторки — под ручкой: название один раз и × в одной строке (#230)', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const name = getRegion('icewrack')!.name.ru;
    const panel = screen.getByRole('complementary', { name });
    const head = panel.firstElementChild as HTMLElement;
    const row = head.querySelector('[data-window-head]') as HTMLElement;
    expect(row.querySelector('h2')).toHaveTextContent(name);
    expect(panel.querySelectorAll('h2')).toHaveLength(1);
    // Порядок в шторке: ручка, затем ×.
    const buttons = Array.from(sheet().querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(buttons.slice(0, 2)).toEqual(['Развернуть панель', `Закрыть: ${name}`]);
  });

  it('переход к месту — шторка снова свёрнута, карта видна', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-state', 'full');
    fireEvent.click(screen.getByRole('button', { name: 'Кобальт' }));
    expect(sheet()).toHaveAttribute('data-state', 'peek');
  });

  it('«потянуть»: бросок вверх — развёрнута, вниз — на шаг ниже; клик после перетаскивания не переключает', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const h = window.innerHeight;
    fireEvent.pointerDown(handle(), { clientY: h * 0.7, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientY: h * 0.3, pointerId: 1 });
    expect(sheet().style.getPropertyValue('--sheet-h')).toBe(`${Math.round(h * 0.9)}px`);
    fireEvent.pointerUp(handle(), { clientY: h * 0.3, pointerId: 1 });
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-state', 'full');
    expect(sheet().style.getPropertyValue('--sheet-h')).toBe('');

    fireEvent.pointerDown(handle(), { clientY: h * 0.1, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientY: h * 0.6, pointerId: 1 });
    fireEvent.pointerUp(handle(), { clientY: h * 0.6, pointerId: 1 });
    // Бросок вниз с высоты ниже половины — на ближайшее положение ниже: заголовок.
    expect(sheet()).toHaveAttribute('data-state', 'head');
  });

  it('свайп по тексту (#253): в среднем положении тянет шторку целиком и отменяет прокрутку; наверху — текст', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const h = window.innerHeight;
    const panel = screen.getByRole('complementary', { name: getRegion('icewrack')!.name.ru });
    const text = panel.lastElementChild as HTMLElement;
    const touch = (y: number) => ({ touches: [{ clientY: y }] });
    fireEvent.touchStart(text, touch(h * 0.7));
    // Отменённый touchmove — браузер не прокручивает текст.
    expect(fireEvent.touchMove(text, touch(h * 0.3))).toBe(false);
    expect(sheet().style.getPropertyValue('--sheet-h')).toBe(`${Math.round(h * 0.9)}px`);
    fireEvent.touchEnd(text, { touches: [] });
    expect(sheet()).toHaveAttribute('data-state', 'full');

    // Наверху свайп вверх — прокрутка текста, шторка не двигается.
    fireEvent.touchStart(text, touch(h * 0.6));
    expect(fireEvent.touchMove(text, touch(h * 0.4))).toBe(true);
    fireEvent.touchMove(text, touch(h * 0.8));
    expect(sheet().style.getPropertyValue('--sheet-h')).toBe('');
    fireEvent.touchEnd(text, { touches: [] });
    expect(sheet()).toHaveAttribute('data-state', 'full');

    // Текст прокручен не к началу — свайп вниз прокручивает его.
    text.scrollTop = 40;
    fireEvent.touchStart(text, touch(h * 0.3));
    expect(fireEvent.touchMove(text, touch(h * 0.5))).toBe(true);
    fireEvent.touchEnd(text, { touches: [] });
    expect(sheet()).toHaveAttribute('data-state', 'full');

    // Прокручен к началу — свайп вниз опускает шторку.
    text.scrollTop = 0;
    fireEvent.touchStart(text, touch(h * 0.2));
    expect(fireEvent.touchMove(text, touch(h * 0.55))).toBe(false);
    fireEvent.touchEnd(text, { touches: [] });
    expect(sheet()).toHaveAttribute('data-state', 'peek');
  });

  it('с компьютера — прежний док справа', () => {
    mobile = false;
    window.location.hash = '#/r/icewrack';
    render(<App />);
    expect(screen.getByTestId('panel-dock')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-sheet')).toBeNull();
  });

  it('useMediaQuery следит за изменением (поворот, ресайз)', () => {
    const { result } = renderHook(() => useMediaQuery(MOBILE_QUERY));
    expect(result.current).toBe(true);
    mobile = false;
    act(() => listeners.forEach((l) => l()));
    expect(result.current).toBe(false);
  });
});

describe('settleSheet: три положения шторки и инерция (#230, Н9; SPEC §7.5)', () => {
  const vh = 800;
  it('медленно отпустили — ближайшее из трёх; ниже заголовка — закрыть', () => {
    expect(settleSheet(SHEET_HEAD_PX + 10, vh, 0)).toBe('head');
    expect(settleSheet(vh * 0.33, vh, 0)).toBe('peek');
    expect(settleSheet(vh * 0.8, vh, 0)).toBe('full');
    expect(settleSheet(SHEET_HEAD_PX * 0.5, vh, 0)).toBe('close');
  });

  it('бросили — на шаг по направлению броска; вниз из заголовка — закрыть', () => {
    expect(settleSheet(vh * 0.28, vh, 0.8)).toBe('head');
    expect(settleSheet(vh * 0.52, vh, -0.8)).toBe('full');
    expect(settleSheet(SHEET_HEAD_PX + 20, vh, -0.8)).toBe('peek');
    expect(settleSheet(SHEET_HEAD_PX - 10, vh, 0.8)).toBe('close');
  });
});
