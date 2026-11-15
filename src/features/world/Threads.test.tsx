import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HeroEvent } from '../../data/types';
import type { Spot } from '../search/search';
import type { StepKind } from '../search/threads';
import { Threads } from './Threads';

// Отрисовка нитей (#67): шаг пути — сплошная со стрелкой, прочая связь — пунктир без стрелки; значок события.

const spot = (key: string, point: [number, number], event: HeroEvent = 'origin'): Spot => ({
  key,
  regionId: key,
  point,
  tone: 'dire',
  event,
});
const draw = (kind: StepKind, event: HeroEvent, to: [number, number] = [0.8, 0.5], obstacles = undefined as never) =>
  render(
    <svg>
      <Threads
        threads={{ steps: [{ from: spot('a', [0.2, 0.5]), to: spot('b', to, event), kind, event }], tone: 'dire' }}
        scale={1}
        obstacles={obstacles}
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

  it('прочая связь: пунктир без стрелки; у `link` значка нет, у упоминания — есть', () => {
    const link = draw('link', 'link').querySelector('[data-step="link"]')!;
    expect(link.querySelector('[data-thread]')!.getAttribute('class')).toMatch(/threadLink/);
    expect(link.querySelector('[data-arrow]')).toBeNull();
    expect(link.querySelector('[data-badge]')).toBeNull();
    expect(draw('link', 'mention').querySelector('[data-badge="mention"]')).not.toBeNull();
  });

  it('короткая нить — без значка; подпись на всей нити — значок не встаёт поверх', () => {
    const near = draw('path', 'home', [0.22, 0.5]);
    expect(near.querySelector('[data-badge]')).toBeNull();
    expect(near.querySelector('[data-arrow]')).not.toBeNull();
    const covered = draw('path', 'home', [0.8, 0.5], [{ left: 0, right: 1600, top: 0, bottom: 1000 }] as never);
    expect(covered.querySelector('[data-badge]')).toBeNull();
    expect(covered.querySelector('[data-arrow]')).not.toBeNull();
  });
});
