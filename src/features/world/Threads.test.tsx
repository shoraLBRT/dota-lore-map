import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HeroEvent } from '../../data/types';
import type { Spot } from '../search/search';
import type { StepKind } from '../search/threads';
import { COMPACT_MARKS, Threads } from './Threads';

// Отрисовка нитей (#67): шаг пути — сплошная со стрелкой, прочая связь — пунктир без стрелки; значок события.

const spot = (key: string, point: [number, number], event: HeroEvent = 'origin'): Spot => ({
  key,
  regionId: key,
  point,
  tone: 'dire',
  event,
});
const draw = (
  kind: StepKind,
  event: HeroEvent,
  to: [number, number] = [0.8, 0.5],
  obstacles = undefined as never,
  compact = false,
) =>
  render(
    <svg>
      <Threads
        threads={{ steps: [{ from: spot('a', [0.2, 0.5]), to: spot('b', to, event), kind, event }], tone: 'dire' }}
        scale={1}
        obstacles={obstacles}
        compact={compact}
      />
    </svg>,
  ).container;

describe('нити на карте (#67)', () => {
  it('шаг пути: сплошная нить, стрелка и значок события', () => {
    const c = draw('path', 'battle');
    const step = c.querySelector('[data-step="path"]')!;
    expect(step.querySelector('[data-thread]')!.getAttribute('class')).not.toMatch(/threadLink/);
    expect(step.querySelector('[data-arrow]')).not.toBeNull();
    expect(step.querySelector('[data-badge="battle"]')).not.toBeNull();
    // Вспышки — на обоих концах.
    expect(c.querySelectorAll('circle[class*="flash"]')).toHaveLength(2);
  });

  it('прочая связь: пунктир без стрелки, со значком упоминания', () => {
    const aside = draw('aside', 'mention').querySelector('[data-step="aside"]')!;
    expect(aside.querySelector('[data-thread]')!.getAttribute('class')).toMatch(/threadAside/);
    expect(aside.querySelector('[data-arrow]')).toBeNull();
    expect(aside.querySelector('[data-badge="mention"]')).not.toBeNull();
  });

  it('короткая нить — без значка; подпись на всей нити — значок не встаёт поверх', () => {
    const near = draw('path', 'home', [0.22, 0.5]);
    expect(near.querySelector('[data-badge]')).toBeNull();
    expect(near.querySelector('[data-arrow]')).not.toBeNull();
    const covered = draw('path', 'home', [0.8, 0.5], [{ left: 0, right: 1600, top: 0, bottom: 1000 }] as never);
    expect(covered.querySelector('[data-badge]')).toBeNull();
    expect(covered.querySelector('[data-arrow]')).not.toBeNull();
  });

  it('мир на телефоне (#102): вспышки и значок — в 0.6 размера, стрелка прежняя', () => {
    const scaleOf = (el: Element | null) => Number(/scale\(([\d.]+)\)/.exec(el!.getAttribute('transform')!)![1]);
    const full = draw('path', 'battle');
    const small = draw('path', 'battle', undefined, undefined, true);
    expect(scaleOf(small.querySelector('[data-badge]'))).toBeCloseTo(scaleOf(full.querySelector('[data-badge]')) * COMPACT_MARKS);
    const flash = (c: Element) => c.querySelector('circle[class*="flash"]')!.parentElement;
    expect(scaleOf(flash(small))).toBeCloseTo(scaleOf(flash(full)) * COMPACT_MARKS);
    expect(scaleOf(small.querySelector('[data-arrow]')!.parentElement)).toBe(scaleOf(full.querySelector('[data-arrow]')!.parentElement));
    // Значок по-прежнему прячется, если ему нет места на нити.
    const covered = draw('path', 'home', [0.8, 0.5], [{ left: 0, right: 1600, top: 0, bottom: 1000 }] as never, true);
    expect(covered.querySelector('[data-badge]')).toBeNull();
  });
});
