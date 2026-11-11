import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { useMediaQuery } from '../../app/media';
import { getRegion } from '../../data/world';
import { MOBILE_QUERY } from '../world/camera';

// Телефон (SPEC §13): правая панель — нижняя шторка, свёрнута ~30 %, развёрнута ~90 %, «потянуть».

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

  it('переход к месту — шторка снова свёрнута, карта видна', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-state', 'full');
    fireEvent.click(screen.getByRole('button', { name: 'Кобальт' }));
    expect(sheet()).toHaveAttribute('data-state', 'peek');
  });

  it('«потянуть»: вверх за середину — развёрнута, вниз — свёрнута; клик после перетаскивания не переключает', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const h = window.innerHeight;
    fireEvent.pointerDown(handle(), { clientY: h * 0.7, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientY: h * 0.3, pointerId: 1 });
    expect(sheet().style.getPropertyValue('--sheet-h')).toBe(`${Math.round(h * 0.7)}px`);
    fireEvent.pointerUp(handle(), { clientY: h * 0.3, pointerId: 1 });
    fireEvent.click(handle());
    expect(sheet()).toHaveAttribute('data-state', 'full');
    expect(sheet().style.getPropertyValue('--sheet-h')).toBe('');

    fireEvent.pointerDown(handle(), { clientY: h * 0.1, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientY: h * 0.6, pointerId: 1 });
    fireEvent.pointerUp(handle(), { clientY: h * 0.6, pointerId: 1 });
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
