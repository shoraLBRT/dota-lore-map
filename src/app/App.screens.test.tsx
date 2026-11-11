import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(capital.querySelector('polygon')).not.toBeNull();
    expect(screen.getByRole('button', { name: placeName(pool, 'ru') }).querySelector('polygon')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: placeName(pool, 'ru') }));
    expect(window.location.hash).toBe('#/r/icewrack/black-pool');
    expect(screen.getByRole('button', { name: placeName(pool, 'ru') })).toHaveAttribute('aria-current', 'true');

    fireEvent.keyDown(screen.getByRole('button', { name: placeName(cobalt, 'ru') }), { key: 'Enter' });
    expect(window.location.hash).toBe('#/r/icewrack/cobalt');
    expect(heading()).toHaveTextContent(placeName(cobalt, 'ru'));
  });

  it('крошки и глобус: место → «‹ Регион» → «‹ Мир»; глобус из места — сразу в мир', () => {
    window.location.hash = '#/r/icewrack/cobalt';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: `‹ ${icewrack.name.ru}` }));
    expect(window.location.hash).toBe('#/r/icewrack');
    fireEvent.click(screen.getByRole('button', { name: '‹ Мир' }));
    expect(window.location.hash).toBe('#/world');

    window.location.hash = '#/r/icewrack/cobalt';
    fireEvent(window, new HashChangeEvent('hashchange'));
    fireEvent.click(screen.getByRole('button', { name: 'Весь мир' }));
    expect(window.location.hash).toBe('#/world');
  });

  it('клик по пустому месту карты в месте возвращает в регион (SPEC §5.1)', () => {
    window.location.hash = '#/r/icewrack/cobalt';
    render(<App />);
    fireEvent.click(document.querySelector('[data-region="icewrack"]')!);
    expect(window.location.hash).toBe('#/r/icewrack');
  });

  it('герой: dota2.com в новой вкладке, язык ссылки — язык интерфейса (A6, §6.7)', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const panel = screen.getByRole('complementary');
    const cm = within(panel).getByRole('link', { name: /Crystal Maiden/ });
    expect(cm).toHaveAttribute('href', 'https://www.dota2.com/hero/crystalmaiden?l=russian');
    expect(cm).toHaveAttribute('target', '_blank');
    expect(cm.getAttribute('rel')).toMatch(/noopener/);

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(within(panel).getByRole('link', { name: /Crystal Maiden/ })).toHaveAttribute(
      'href',
      'https://www.dota2.com/hero/crystalmaiden?l=english',
    );
  });

  it('свёрнутая панель снова раскрывается при переходе к месту', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть панель' }));
    expect(screen.getByRole('button', { name: 'Развернуть панель' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: placeName(pool, 'ru') }));
    expect(screen.getByRole('button', { name: 'Свернуть панель' })).toBeInTheDocument();
  });
});

describe('клики во время анимации камеры (SPEC §7.1)', () => {
  let finish: (() => void)[] = [];
  const original = Element.prototype.animate;

  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    finish = [];
    // jsdom не умеет WAAPI: подменяем animate управляемой анимацией.
    Element.prototype.animate = vi.fn(function () {
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
    expect(Element.prototype.animate).toHaveBeenCalledTimes(1);

    // Во время перелёта: глобус, Esc, крошки и маркер — встают в очередь, адрес и панель не меняются.
    fireEvent.click(screen.getByRole('button', { name: 'Весь мир' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: '‹ Мир' }));
    fireEvent.click(screen.getByRole('button', { name: placeName(pool, 'ru') }));
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(heading()).toHaveTextContent(icewrack.name.ru);
    expect(Element.prototype.animate).toHaveBeenCalledTimes(1);

    await done();
    expect(window.location.hash).toBe('#/r/icewrack/black-pool');
    expect(heading()).toHaveTextContent(placeName(pool, 'ru'));
    expect(Element.prototype.animate).toHaveBeenCalledTimes(2);

    // Вторая анимация (A4) тоже держит навигацию, потом всё снова отвечает сразу.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/r/icewrack/black-pool');
    await done();
    expect(window.location.hash).toBe('#/r/icewrack');
    await done();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
  });
});
