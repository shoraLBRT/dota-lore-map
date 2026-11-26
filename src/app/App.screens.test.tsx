import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlace, getRegion, placeName } from '../data/world';
import { App } from './App';

// Экраны региона и места (E5, SPEC §5.4, §5.5): Esc, крошки, глобус, ссылки на героев, клики во время анимации.

const icewrack = getRegion('icewrack')!;
const pool = getPlace('icewrack', 'black-pool')!;
const cobalt = getPlace('icewrack', 'cobalt')!;

const heading = () => screen.getByRole('heading', { level: 2 });

describe('регион и место', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('Esc: место → регион → мир; в мире Esc ничего не делает', () => {
    window.location.hash = '#/r/icewrack/black-pool';
    render(<App />);
    expect(heading()).toHaveTextContent(placeName(pool, 'ru'));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(heading()).toHaveTextContent(icewrack.name.ru);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
  });

  it('маркеры мест: столица — звезда; клик по маркеру — место, по другому маркеру — сразу другое место', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const capital = screen.getByRole('button', { name: 'Айсрак' });
    expect(capital.querySelector('[data-shape]')!.getAttribute('data-shape')).toBe('star');
    expect(screen.getByRole('button', { name: placeName(pool, 'ru') }).querySelector('[data-shape]')!.getAttribute('data-shape')).not.toBe('star');

    fireEvent.click(screen.getByRole('button', { name: placeName(pool, 'ru') }));
    expect(window.location.hash).toBe('#/r/icewrack/black-pool');
    expect(screen.getByRole('button', { name: placeName(pool, 'ru') })).toHaveAttribute('aria-current', 'true');

    fireEvent.keyDown(screen.getByRole('button', { name: placeName(cobalt, 'ru') }), { key: 'Enter' });
    expect(window.location.hash).toBe('#/r/icewrack/cobalt');
    expect(heading()).toHaveTextContent(placeName(cobalt, 'ru'));
  });

  it('строка пути и глобус: место → «Регион» → «Мир»; глобус из места — сразу в мир (#230)', () => {
    window.location.hash = '#/r/icewrack/cobalt';
    render(<App />);
    fireEvent.click(within(screen.getByTestId('path-bar')).getByRole('button', { name: icewrack.name.ru }));
    expect(window.location.hash).toBe('#/r/icewrack');
    fireEvent.click(within(screen.getByTestId('path-bar')).getByRole('button', { name: 'Мир' }));
    expect(window.location.hash).toBe('#/world');

    window.location.hash = '#/r/icewrack/cobalt';
    fireEvent(window, new HashChangeEvent('hashchange'));
    fireEvent.click(screen.getByRole('button', { name: 'Весь мир' }));
    expect(window.location.hash).toBe('#/world');
  });

  it('портрет героя открывает профиль; dota2.com — в профиле, в новой вкладке, на языке интерфейса (A6, §6.7, §6.8)', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Crystal Maiden: открыть профиль/ }));
    // Камера не двигается: экран тот же, поверх — профиль.
    expect(window.location.hash).toBe('#/r/icewrack?hero=crystal_maiden&profile');
    const panel = screen.getByRole('complementary', { name: 'Crystal Maiden' });
    const cm = within(panel).getByRole('link', { name: /Crystal Maiden/ });
    expect(cm).toHaveAttribute('href', 'https://www.dota2.com/hero/crystalmaiden?l=russian');
    expect(cm).toHaveAttribute('target', '_blank');
    expect(cm.getAttribute('rel')).toMatch(/noopener/);

    fireEvent.click(screen.getByRole('button', { name: 'Язык: RU' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(within(panel).getByRole('link', { name: /Crystal Maiden/ })).toHaveAttribute(
      'href',
      'https://www.dota2.com/hero/crystalmaiden?l=english',
    );
  });

});

describe('клики во время анимации камеры (SPEC §7.1)', () => {
  let finish: (() => void)[] = [];
  /** Перелёты слоя карты; экранный слой подписей (#180) летит вместе с ним и здесь не считается. */
  let flights = 0;
  const original = Element.prototype.animate;

  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    finish = [];
    flights = 0;
    // jsdom не умеет WAAPI: подменяем animate управляемой анимацией.
    Element.prototype.animate = vi.fn(function (this: Element) {
      if (this.querySelector('[data-screen-layer]')) {
        return { finished: Promise.resolve(), cancel: () => undefined } as unknown as Animation;
      }
      flights += 1;
      let resolve!: () => void;
      let reject!: (e: unknown) => void;
      const finished = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      finish.push(() => resolve());
      return { finished, cancel: () => reject(new DOMException('aborted', 'AbortError')) } as unknown as Animation;
    });
  });

  afterEach(() => {
    Element.prototype.animate = original;
  });

  const done = async () => {
    await act(async () => {
      finish.shift()?.();
      await new Promise((r) => setTimeout(r, 0));
    });
  };

  it('пока камера летит, клики не прерывают её; после посадки выполняется последний запрошенный переход', async () => {
    window.location.hash = '#/world';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: icewrack.name.ru }));
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(flights).toBe(1);

    // Во время перелёта: глобус, Esc, строка пути и маркер — встают в очередь, адрес и панель не меняются.
    fireEvent.click(screen.getByRole('button', { name: 'Весь мир' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(within(screen.getByTestId('path-bar')).getByRole('button', { name: 'Мир' }));
    fireEvent.click(screen.getByRole('button', { name: placeName(pool, 'ru') }));
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(heading()).toHaveTextContent(icewrack.name.ru);
    expect(flights).toBe(1);

    await done();
    expect(window.location.hash).toBe('#/r/icewrack/black-pool');
    expect(heading()).toHaveTextContent(placeName(pool, 'ru'));
    expect(flights).toBe(2);

    // Вторая анимация (A4) тоже держит навигацию, потом всё снова отвечает сразу.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/r/icewrack/black-pool');
    await done();
    await waitFor(() => expect(window.location.hash).toBe('#/r/icewrack'));
    await done();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(window.location.hash).toBe('#/world'));
  });
});
