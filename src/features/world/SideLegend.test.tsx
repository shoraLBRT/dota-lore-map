import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { MOBILE_QUERY } from './camera';

// Легенда сторон в мире (#102): три ромба на широком экране; на телефоне, в регионе и при профиле её нет.

let mobile = false;
const legend = () => screen.queryByTestId('side-legend');

describe('легенда сторон', () => {
  beforeEach(() => {
    mobile = false;
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === MOBILE_QUERY ? mobile : false;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('в мире: Radiant, Dire, Нейтральные земли', () => {
    window.location.hash = '#/world';
    render(<App />);
    expect(legend()).toHaveAccessibleName('Стороны');
    expect([...legend()!.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Radiant', 'Dire', 'Нейтральные земли']);
  });

  it('по-английски', () => {
    window.localStorage.setItem('dota-lore-map.lang', 'en');
    window.location.hash = '#/world';
    render(<App />);
    expect(legend()).toHaveAccessibleName('Sides');
    expect(legend()).toHaveTextContent('Neutral lands');
  });

  it('нет в регионе, при открытом профиле и на телефоне', () => {
    window.location.hash = '#/r/icewrack';
    const { unmount } = render(<App />);
    expect(legend()).toBeNull();
    unmount();

    window.location.hash = '#/world?hero=arc_warden&profile';
    const second = render(<App />);
    expect(legend()).toBeNull();
    second.unmount();

    mobile = true;
    window.location.hash = '#/world';
    render(<App />);
    expect(legend()).toBeNull();
  });
});
