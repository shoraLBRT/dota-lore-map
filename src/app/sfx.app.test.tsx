import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMedia } from '../data/world';
import { App } from './App';

// Звуки в приложении (SPEC §7.4): «Начать», открытие панели, открытие галереи. Синтезатор подменён.
const played = vi.hoisted(() => [] as string[]);
vi.mock('./sfx', () => ({ createSynth: () => ({ play: (name: string) => played.push(name) }) }));

describe('звуки в приложении', () => {
  beforeEach(() => {
    played.length = 0;
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('после «Начать»: клик по региону — клик и шорох панели; карточка медиа — звук галереи', () => {
    render(<App />);
    const start = screen.getByRole('button', { name: 'Начать' });
    fireEvent.pointerDown(start);
    fireEvent.click(start);
    expect(played).toEqual(['click']);
    fireEvent.click(screen.getByRole('button', { name: 'Айсрак' }));
    expect(played).toEqual(['click', 'click', 'panel']);
    const title = getMedia('icewrack-new-neighbors')!.title.ru;
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }));
    });
    expect(played.slice(-2)).toEqual(['click', 'gallery']);
  });

  it('выключенный звук — тишина', () => {
    window.localStorage.setItem('dota-lore-map.sound', 'off');
    window.location.hash = '#/r/icewrack';
    render(<App />);
    fireEvent.pointerDown(document.body);
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть панель' }));
    expect(played).toEqual([]);
  });
});
