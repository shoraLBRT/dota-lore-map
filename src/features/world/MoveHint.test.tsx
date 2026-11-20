import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { HINT_STORAGE_KEY, MOVE_HINT_STORAGE_KEY } from './WorldHint';

// Жест «карту можно двигать» при первом входе (#181, SPEC §5.3).

const moveHint = () => screen.queryByTestId('move-hint');
const regionHint = () => screen.queryByTestId('world-hint');
const viewport = () => document.querySelector('[data-map-viewport]')!;

describe('подсказка «карту можно двигать»', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    window.location.hash = '#/world';
  });

  it('при первом входе видна раньше строки «выберите регион»; наведение на регион её не гасит', () => {
    render(<App />);
    expect(moveHint()).toHaveTextContent('Тяните карту мышью, колесо — приблизить');
    expect(moveHint()).toHaveTextContent('стрелки, + и −');
    expect(regionHint()).toBeNull();
    fireEvent.pointerOver(document.querySelector('[data-region="icewrack"]')!);
    expect(moveHint()).not.toBeNull();
    expect(window.localStorage.getItem(HINT_STORAGE_KEY)).toBeNull();
  });

  it('гаснет от первого сдвига камеры (клавиши), больше не показывается, дальше — строка «выберите регион»', async () => {
    const { unmount } = render(<App />);
    fireEvent.keyDown(viewport(), { key: 'ArrowRight' });
    await waitFor(() => expect(moveHint()).toBeNull());
    expect(window.localStorage.getItem(MOVE_HINT_STORAGE_KEY)).toBe('seen');
    expect(regionHint()).not.toBeNull();
    unmount();
    render(<App />);
    expect(moveHint()).toBeNull();
  });

  it('гаснет, когда открыт регион; по-английски', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    render(<App />);
    expect(moveHint()).toHaveTextContent('Drag the map to move, scroll to zoom');
    fireEvent.click(document.querySelector('[data-region="icewrack"]')!);
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(window.localStorage.getItem(MOVE_HINT_STORAGE_KEY)).toBe('seen');
    expect(moveHint()).toBeNull();
  });

  it('на телефоне — палец и щипок, без строки клавиш; строки «выберите регион» нет и после', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }));
    try {
      render(<App />);
      expect(moveHint()).toHaveAttribute('data-input', 'touch');
      expect(moveHint()).toHaveTextContent('Тяните карту пальцем, щипком — приблизить');
      expect(moveHint()).not.toHaveTextContent('стрелки');
      fireEvent.keyDown(viewport(), { key: 'ArrowRight' });
      await waitFor(() => expect(moveHint()).toBeNull());
      expect(regionHint()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('под интро не видна', () => {
    window.location.hash = '';
    render(<App />);
    expect(moveHint()).toBeNull();
  });
});
