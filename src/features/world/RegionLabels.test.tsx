import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Region } from '../../data/types';
import { I18nProvider } from '../../i18n';
import { crestBox, labelMetrics, nameBox, type LabelLevel, type RegionLabelSpot } from './labels';
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

/** Названия: `a` — первый уровень с самого дальнего зума, `b` — второй, с приближения 2. */
function names(): RegionNames {
  const levels = new Map<string, LabelLevel>([['a', 1], ['b', 2]]);
  const metrics = new Map([...levels].map(([id, l]) => [id, labelMetrics(l, 900)]));
  const spot = (id: string, from: number): RegionLabelSpot => {
    const m = { width: 60, lines: 1, metrics: metrics.get(id)! };
    const side = m.metrics.crest ? 'bottom' : 'center';
    return { side, box: nameBox(side, m), crest: crestBox(m.metrics.crest), from };
  };
  return { levels, metrics, spots: new Map([['a', spot('a', 1)], ['b', spot('b', 2)]]), items: [] };
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
          zoom={1}
          onSelectRegion={vi.fn()}
        />
      </svg>
    </I18nProvider>,
  );
}

const order = () => [...document.querySelectorAll('[data-level]')].map((e) => e.getAttribute('data-label') ?? `off:${e.getAttribute('data-label-off')}`);

describe('RegionLabels — название региона под курсором видно всегда (#243, SPEC §8.6)', () => {
  afterEach(cleanup);

  it('до порога название скрыто', () => {
    renderLabels();
    expect(order()).toEqual(['a', 'off:b']);
  });

  it('мышь на регионе — его название видно и до порога, поверх соседей (последним)', () => {
    renderLabels({ over: 'b' });
    expect(order()).toEqual(['a', 'b']);
  });

  it('пункт списка регионов под наведением — то же', () => {
    renderLabels({ list: 'b' });
    expect(order()).toEqual(['a', 'b']);
  });

  it('название под наведением встаёт последним в DOM', () => {
    const swapped = names();
    swapped.spots.set('a', { ...swapped.spots.get('a')!, from: 2 });
    render(
      <I18nProvider initialLang="en">
        <svg>
          <RegionLabels
            drawn={[region('a'), region('b')]}
            inWorld
            tip={{ shownId: null, litId: 'a', region: { onEnter: vi.fn(), onLeave: vi.fn() } } as never}
            litId={null}
            focusRegions={null}
            previewRegions={null}
            names={swapped}
            zoom={1}
            onSelectRegion={vi.fn()}
          />
        </svg>
      </I18nProvider>,
    );
    expect(order()).toEqual(['off:b', 'a']);
  });

  it('в регионе (не в мире) наведение порог не отменяет', () => {
    renderLabels({ over: 'b', inWorld: false });
    expect(order()).toEqual(['a', 'off:b']);
  });
});
