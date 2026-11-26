import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';

// Легенда нитей на карте (#254, SPEC §6.6): пока на карте путь героя — у каждого вида линии, значка и цвета есть строка.

const legend = () => screen.queryByRole('region', { name: 'Нити героя' });

describe('легенда нитей на карте (#254)', () => {
  beforeEach(() => {
    window.localStorage.setItem('dota-lore-map.lang', 'ru');
  });

  it('выбран герой — легенда есть; строки — линии, значки и цвет его нитей', () => {
    window.location.hash = '#/r/cladd?hero=kunkka&profile';
    render(<App />);
    const box = legend()!;
    expect(box).not.toBeNull();
    const threads = document.querySelector('[data-testid="threads"]')!;
    for (const kind of new Set([...threads.querySelectorAll('[data-step]')].map((s) => s.getAttribute('data-step')))) {
      expect(box.querySelector(`[data-legend-kind="${kind}"]`)).not.toBeNull();
    }
    const badges = [...threads.querySelectorAll('[data-badge]')].map((b) => b.getAttribute('data-badge'));
    for (const event of badges) expect(box.querySelector(`[data-legend-event="${event}"]`)).not.toBeNull();
    // Цвет нитей — тон первого места: та же строка, что и класс тона у нитей.
    const tone = box.querySelector('[data-legend-tone]')!.getAttribute('data-legend-tone')!;
    expect(threads.getAttribute('data-tone')).toBe(tone);
    expect(within(box).getByText('Цвет — сторона первого места: Radiant')).toBeInTheDocument();
    expect(within(box).getByText('Сражение, нападение')).toBeInTheDocument();
    // Кнопка «?» для телефона раскрывает и сворачивает список.
    const toggle = within(box).getByRole('button', { name: 'Как читать нити' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('героя нет — легенды нет', () => {
    window.location.hash = '#/r/cladd';
    render(<App />);
    expect(legend()).toBeNull();
  });
});
