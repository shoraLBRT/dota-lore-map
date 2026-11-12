import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { partOffset } from '../world/cloudSets';

/** Подменяет document.fonts: шрифты «грузятся», пока тест не вызовет resolve. */
function mockPendingFonts() {
  let resolve!: () => void;
  const pending = new Promise<void>((r) => (resolve = r));
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { check: () => false, load: () => pending, ready: pending },
  });
  return () => act(async () => {
    resolve();
    await pending;
  });
}

describe('Intro (S0) и переход A1', () => {
  afterEach(() => {
    // @ts-expect-error — убираем подмену; в jsdom своего document.fonts нет.
    delete document.fonts;
  });

  it('пока мир грузится, «Начать» неактивна и показывает индикатор загрузки', async () => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    const loaded = mockPendingFonts();
    render(<App />);
    const start = screen.getByRole('button', { name: 'Начать' });
    expect(start).toBeDisabled();
    expect(start).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем мир…');
    // Строка-пояснение под названием (аудит E13).
    expect(screen.getByText('Интерактивная карта мест и героев лора')).toBeInTheDocument();

    await loaded();
    expect(start).toBeEnabled();
    expect(start).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('на интро карта мира под пеленой недоступна; «Начать» ведёт в мир и убирает интро', async () => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
    render(<App />);
    const world = screen.getByTestId('world-screen');
    expect(world).toHaveAttribute('aria-hidden', 'true');
    expect(world.inert).toBe(true);
    expect(screen.getByTestId('clouds-veil')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Начать' }));
    expect(window.location.hash).toBe('#/world');
    expect(world).not.toHaveAttribute('aria-hidden');
    expect(world.inert).toBe(false);
    // Во время A1 повторный клик невозможен.
    expect(screen.getByRole('button', { name: 'Начать', hidden: true })).toBeDisabled();

    await waitFor(() => expect(screen.queryByTestId('intro')).toBeNull());
    expect(screen.getByRole('navigation', { name: 'Навигация' })).toBeInTheDocument();
  });

  it('облака интро разъезжаются от центра к краям', () => {
    expect(partOffset({ x: 10, y: 50, w: 10, layer: 1 })).toEqual({ dx: -70, dy: 0 });
    expect(partOffset({ x: 50, y: 90, w: 10, layer: 1 })).toEqual({ dx: 0, dy: 70 });
    expect(partOffset({ x: 50, y: 50, w: 10, layer: 1 })).toEqual({ dx: 0, dy: -70 });
  });
});
