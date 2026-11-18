import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HeroEvent } from '../../data/types';
import type { Spot } from '../search/search';
import type { StepKind } from '../search/threads';
import { BADGE_R, COMPACT_MARKS, Threads } from './Threads';
import type { ThreadStyle } from './threadStyle';

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
  variant: ThreadStyle = 'ribbon',
) =>
  render(
    <svg>
      <Threads
        threads={{ steps: [{ from: spot('a', [0.2, 0.5]), to: spot('b', to, event), kind, event }], tone: 'dire' }}
        scale={1}
        obstacles={obstacles}
        compact={compact}
        variant={variant}
      />
    </svg>,
  ).container;
const scaleOf = (el: Element | null) => Number(/scale\(([\d.]+)\)/.exec(el!.getAttribute('transform')!)![1]);
const translateOf = (el: Element | null) =>
  /translate\(([-\d.]+) ([-\d.]+)\)/.exec(el!.getAttribute('transform')!)!.slice(1, 3).map(Number) as [number, number];
const vars = (el: Element) => (el as SVGElement).style;

describe('нити на карте (#67, #168)', () => {
  it('шаг пути (лента): маска прорисовки, наконечник у конца, значок, бегущая точка, вспышки', () => {
    const c = draw('path', 'battle');
    const step = c.querySelector('[data-step="path"]')!;
    expect(step.getAttribute('data-variant')).toBe('ribbon');
    expect(step.querySelector('[data-thread]')!.getAttribute('class')).toMatch(/ribbon/);
    expect(step.querySelector('mask')).not.toBeNull();
    expect(step.querySelector('[data-runner]')).not.toBeNull();
    expect(step.querySelector('[data-badge="battle"]')).not.toBeNull();
    // Остриё — у места, куда ведёт шаг (x = 0.8 · 1600 = 1280), а не за значком в середине.
    const [tx] = translateOf(step.querySelector('[data-arrow]')!.parentElement);
    expect(tx).toBeGreaterThan(1255);
    expect(tx).toBeLessThan(1280 - 12);
    expect(c.querySelectorAll('circle[class*="flash"]')).toHaveLength(2);
  });

  it('прочая связь: точки без стрелки и без бегущей точки, со значком упоминания', () => {
    const aside = draw('aside', 'mention').querySelector('[data-step="aside"]')!;
    expect(aside.querySelector('[data-thread]')!.getAttribute('class')).toMatch(/asideDots/);
    expect(aside.querySelector('[data-arrow]')).toBeNull();
    expect(aside.querySelector('[data-runner]')).toBeNull();
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

  it('мир на телефоне (#102, #168): вспышки и значок — в 0.6 размера, наконечник — 0.8, у прочих связей значков нет', () => {
    const full = draw('path', 'battle');
    const small = draw('path', 'battle', undefined, undefined, true);
    expect(scaleOf(small.querySelector('[data-badge]'))).toBeCloseTo(scaleOf(full.querySelector('[data-badge]')) * COMPACT_MARKS);
    const flash = (c: Element) => c.querySelector('circle[class*="flash"]')!.parentElement;
    expect(scaleOf(flash(small))).toBeCloseTo(scaleOf(flash(full)) * COMPACT_MARKS);
    expect(scaleOf(small.querySelector('[data-arrow]')!.parentElement)).toBeCloseTo(
      scaleOf(full.querySelector('[data-arrow]')!.parentElement) * 0.8,
    );
    expect(draw('aside', 'mention', undefined, undefined, true).querySelector('[data-badge]')).toBeNull();
    // Значок по-прежнему прячется, если ему нет места на нити.
    const covered = draw('path', 'home', [0.8, 0.5], [{ left: 0, right: 1600, top: 0, bottom: 1000 }] as never, true);
    expect(covered.querySelector('[data-badge]')).toBeNull();
  });

  it('караван: штрихи и шевроны по ходу, шевроны не налезают на значок', () => {
    const c = draw('path', 'battle', [0.8, 0.5], undefined, false, 'caravan');
    const step = c.querySelector('[data-step="path"]')!;
    expect(step.querySelector('[data-thread]')!.getAttribute('class')).toMatch(/caravanDash/);
    const chevrons = [...step.querySelectorAll('[data-chevron]')];
    expect(chevrons.length).toBeGreaterThan(5);
    const [bx, by] = translateOf(step.querySelector('[data-badge]'));
    for (const ch of chevrons) {
      const [x, y] = translateOf(ch);
      expect(Math.hypot(x - bx, y - by)).toBeGreaterThan(BADGE_R);
    }
  });

  it('legacy (#67): дуга с течением пунктира у прочей связи', () => {
    const aside = draw('aside', 'mention', [0.8, 0.5], undefined, false, 'legacy');
    expect(aside.querySelector('[data-thread]')!.getAttribute('class')).toMatch(/threadAside/);
    expect(aside.querySelector('mask')).toBeNull();
    expect(draw('path', 'battle', [0.8, 0.5], undefined, false, 'legacy').querySelector('[data-arrow]')).not.toBeNull();
  });

  it('путь прорисовывается шаг за шагом: следующий шаг и его вспышка — позже', () => {
    const c = render(
      <svg>
        <Threads
          threads={{
            steps: [
              { from: spot('a', [0.2, 0.5]), to: spot('b', [0.5, 0.4], 'journey'), kind: 'path', event: 'journey' },
              { from: spot('b', [0.5, 0.4]), to: spot('c', [0.8, 0.6], 'battle'), kind: 'path', event: 'battle' },
            ],
            tone: 'dire',
          }}
          scale={1}
        />
      </svg>,
    ).container;
    const [one, two] = [...c.querySelectorAll('[data-step]')];
    expect(Number(vars(two!).getPropertyValue('--d'))).toBeGreaterThan(Number(vars(one!).getPropertyValue('--d')));
    const at = [...c.querySelectorAll('circle[class*="flash"]')].map((f) => Number(vars(f).getPropertyValue('--at')));
    expect(at).toEqual([...at].sort((x, y) => x - y));
    expect(at[0]).toBe(0);
  });
});
