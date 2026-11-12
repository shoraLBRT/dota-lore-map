import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { HINT_STORAGE_KEY } from './WorldHint';

// Подсказка мира при первом входе (аудит E13, SPEC §8.6).

const hint = () => screen.queryByTestId('world-hint');
const region = () => document.querySelector('[data-region="icewrack"]')!;

describe('подсказка «выберите регион»', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    window.location.hash = '#/world';
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('в мире при первом входе видна; гаснет от наведения на регион и больше не показывается', () => {
    const { unmount } = render(<App />);
    expect(hint()).toHaveTextContent('Выберите регион, чтобы узнать о нём больше');
    fireEvent.pointerOver(region());
    expect(window.localStorage.getItem(HINT_STORAGE_KEY)).toBe('seen');
    unmount();

    render(<App />);
    expect(hint()).toBeNull();
  });

  it('по-английски; наведение мимо регионов её не гасит', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    render(<App />);
    fireEvent.pointerOver(screen.getByTestId('world-screen'));
    expect(hint()).toHaveTextContent('Pick a region to learn more');
    expect(window.localStorage.getItem(HINT_STORAGE_KEY)).toBeNull();
  });

  it('гаснет, когда открыт регион (тап на телефоне), и не видна в регионе', () => {
    render(<App />);
    fireEvent.click(region());
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(window.localStorage.getItem(HINT_STORAGE_KEY)).toBe('seen');
    expect(hint()).toBeNull();
  });

  it('без localStorage подсказка всё равно работает', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    render(<App />);
    expect(hint()).not.toBeNull();
    expect(() => fireEvent.pointerOver(region())).not.toThrow();
  });
});
