import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { getPlace, getRegion, placeName } from '../../data/world';
import { focusLost, focusTarget } from './focus';

// Клавиатура (SPEC §14, ARCHITECTURE A14): Tab по регионам и местам, Enter — открыть, Esc — назад, фокус не теряется.

describe('focusLost', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('body, отсоединённый, скрытый и больше не фокусируемый элемент — фокус потерян', () => {
    document.body.innerHTML = `
      <button id="ok">ok</button>
      <svg><polygon id="poly" tabindex="0"></polygon><polygon id="plain"></polygon></svg>
      <div aria-hidden="true"><button id="hidden">x</button></div>`;
    expect(focusLost(null)).toBe(true);
    expect(focusLost(document.body)).toBe(true);
    expect(focusLost(document.getElementById('ok'))).toBe(false);
    expect(focusLost(document.getElementById('poly'))).toBe(false);
    expect(focusLost(document.getElementById('plain'))).toBe(true);
    expect(focusLost(document.getElementById('hidden'))).toBe(true);
    expect(focusLost(document.createElement('button'))).toBe(true);
  });

  it('куда ставить фокус: вверх — откуда пришли, вниз — заголовок панели', () => {
    document.body.innerHTML = `
      <svg><polygon data-region="icewrack" tabindex="0"></polygon><g data-place="cobalt" tabindex="0"></g></svg>
      <h2 tabindex="-1" data-panel-heading>Icewrack</h2>`;
    const world = { name: 'world' } as const;
    const region = { name: 'region', regionId: 'icewrack' } as const;
    const place = { name: 'place', regionId: 'icewrack', placeSlug: 'cobalt' } as const;
    expect(focusTarget(document, region, world)).toBe(document.querySelector('[data-region]'));
    expect(focusTarget(document, place, region)).toBe(document.querySelector('[data-place]'));
    expect(focusTarget(document, world, region)).toBe(document.querySelector('h2'));
    expect(focusTarget(document, region, place)).toBe(document.querySelector('h2'));
    expect(focusTarget(document, { name: 'intro' }, world)).toBeNull();
  });

  it('регион открыт из списка регионов (телефон, #39): вверх в мир — на пункт списка; нет списка — на полигон', () => {
    document.body.innerHTML = `
      <svg><polygon data-region="icewrack" tabindex="0"></polygon><polygon data-region="druud" tabindex="0"></polygon></svg>
      <nav data-region-list><button data-list-region="icewrack">Icewrack</button><button data-list-region="druud">Druud</button></nav>`;
    const world = { name: 'world' } as const;
    const region = { name: 'region', regionId: 'icewrack' } as const;
    const place = { name: 'place', regionId: 'icewrack', placeSlug: 'cobalt' } as const;
    const item = document.querySelector('[data-list-region="icewrack"]');
    const polygon = document.querySelector('[data-region="icewrack"]');
    expect(focusTarget(document, region, world, { listRegionId: 'icewrack' })).toBe(item);
    expect(focusTarget(document, place, world, { listRegionId: 'icewrack' })).toBe(item);
    // Открыт с карты или другой регион из списка — на полигон.
    expect(focusTarget(document, region, world)).toBe(polygon);
    expect(focusTarget(document, region, world, { listRegionId: 'druud' })).toBe(polygon);
    document.querySelector('nav')!.remove();
    expect(focusTarget(document, region, world, { listRegionId: 'icewrack' })).toBe(polygon);
  });
});

describe('клавиатура на карте', () => {
  const icewrack = getRegion('icewrack')!;
  const cobalt = getPlace('icewrack', 'cobalt')!;

  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('Enter на регионе → фокус на заголовке панели; Enter на маркере → место; Esc → обратно на маркер и регион', () => {
    window.location.hash = '#/world';
    render(<App />);
    const polygon = screen.getByRole('button', { name: icewrack.name.ru });
    expect(polygon).toHaveAttribute('tabindex', '0');
    act(() => polygon.focus());
    fireEvent.keyDown(polygon, { key: 'Enter' });
    expect(window.location.hash).toBe('#/r/icewrack');
    // Полигон в регионе — уже не кнопка: фокус переехал на заголовок панели.
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: icewrack.name.ru }));

    const marker = screen.getByRole('button', { name: placeName(cobalt, 'ru') });
    act(() => marker.focus());
    fireEvent.keyDown(marker, { key: 'Enter' });
    expect(window.location.hash).toBe('#/r/icewrack/cobalt');
    expect(document.activeElement).toBe(marker);

    // Фокус потерян (на body) — Esc из места ставит его на маркер места, откуда пришли.
    act(() => (document.activeElement as HTMLElement).blur());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: placeName(cobalt, 'ru') }));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.hash).toBe('#/world');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: icewrack.name.ru }));
  });

  it('крошка «‹ Мир» уходит вместе с панелью — фокус возвращается на регион', () => {
    window.location.hash = '#/r/icewrack';
    render(<App />);
    const back = screen.getByRole('button', { name: '‹ Мир' });
    act(() => back.focus());
    fireEvent.click(back);
    expect(window.location.hash).toBe('#/world');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: icewrack.name.ru }));
  });

  it('крошка «‹ Регион» в шапке меняется вместе с экраном — фокус уходит на маркер места, откуда пришли', () => {
    window.location.hash = '#/r/icewrack/cobalt';
    render(<App />);
    const back = screen.getByRole('button', { name: `‹ ${icewrack.name.ru}` });
    act(() => back.focus());
    fireEvent.click(back);
    expect(window.location.hash).toBe('#/r/icewrack');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: placeName(cobalt, 'ru') }));
  });
});
