import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Region } from '../../data/types';
import { I18nProvider } from '../../i18n';
import { crestBox, labelMetrics, nameBox, shrinkMetrics, type LabelLevel, type RegionLabelSpot } from './labels';
import type { RegionNames } from './regionLabelLayout';
import { RegionLabels } from './RegionsLayer';

const region = (id: string): Region => ({
  id,
  tier: 'continent',
  side: 'neutral',
  name: { ru: `${id} ru`, en: `${id} en` },
  geo: '',
  biome: 'snow',
  places: [],
  regionHeroes: [],
  layout: { polygon: [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]], label: [0.2, 0.2], camera: { x: 0.2, y: 0.2, zoom: 3 } },
});

/** Названия: `a` — первый уровень, `b` — второй, уменьшенный: ему было тесно (#251). */
function names(): RegionNames {
  const levels = new Map<string, LabelLevel>([['a', 1], ['b', 2]]);
  const metrics = new Map([...levels].map(([id, l]) => [id, labelMetrics(l, 900)]));
  const spot = (id: string, k: number): RegionLabelSpot => {
    const sized = shrinkMetrics(metrics.get(id)!, k);
    const m = { width: 60 * k, lines: 1, metrics: sized };
    return { side: 'bottom', metrics: sized, box: nameBox('bottom', m), crest: crestBox(sized.crest) };
  };
  return { levels, metrics, spots: new Map([['a', spot('a', 1)], ['b', spot('b', 0.76)]]), items: [] };
}

function renderLabels({ over = null as string | null, list = null as string | null, inWorld = true } = {}) {
  render(
    <I18nProvider initialLang="en">
      <svg>
        <RegionLabels
          drawn={[region('a'), region('b')]}
          inWorld={inWorld}
          tip={{ shownId: null, litId: over, region: { onEnter: vi.fn(), onLeave: vi.fn() } } as never}
          litId={list}
          focusRegions={null}
          previewRegions={null}
          names={names()}
          onSelectRegion={vi.fn()}
        />
      </svg>
    </I18nProvider>,
  );
}

const order = () => [...document.querySelectorAll('[data-level]')].map((e) => e.getAttribute('data-label'));
const spotOf = (id: string) => document.querySelector(`[data-label="${id}"]`)!;

describe('RegionLabels — в мире подписаны все регионы, у каждого герб (#251, SPEC §8.6)', () => {
  afterEach(cleanup);

  it('без наведения видны все названия и гербы', () => {
    renderLabels();
    expect(order()).toEqual(['a', 'b']);
    expect(document.querySelectorAll('[data-crest]')).toHaveLength(2);
  });

  it('уменьшенное название — тот же текст в полном кегле, масштабом; герб меньше', () => {
    renderLabels();
    const text = (id: string) => spotOf(id).querySelector('text')!;
    expect(text('b').style.fontSize).toBe(`${labelMetrics(2, 900).font}px`);
    expect(text('b').getAttribute('transform')).toMatch(/scale\(0\.\d+\)/);
    expect(text('a').getAttribute('transform')).not.toMatch(/scale/);
    const r = (id: string) => Number(spotOf(id).querySelector('circle[class*="crestDisc"]')!.getAttribute('r'));
    expect(r('b')).toBeLessThan(r('a'));
  });

  it('мышь на регионе — его название поверх соседей (последним в DOM)', () => {
    renderLabels({ over: 'a' });
    expect(order()).toEqual(['b', 'a']);
  });

  it('пункт списка регионов под наведением — то же', () => {
    renderLabels({ list: 'a' });
    expect(order()).toEqual(['b', 'a']);
  });
});
