// Нити со смыслом (SPEC §6.6, ARCHITECTURE A11, #67): какие места героя соединены и как.
// Путь — сплошная нить со стрелкой «откуда → куда», прочая связь — пунктир без стрелки.

import type { Hero, HeroEvent } from '../../data/types';
import type { Spot, Tone } from './search';

/** `path` — шаг пути героя (сплошная, стрелка); `link` — прочая связь (пунктир). */
export type StepKind = 'path' | 'link';

export interface ThreadStep {
  from: Spot;
  to: Spot;
  kind: StepKind;
  /** Значок шага — событие места, куда ведёт нить (A3). `link` — значка нет. */
  event: HeroEvent;
}

export interface HeroThreads {
  steps: ThreadStep[];
  /** Цвет нитей — сторона или ярус первого места героя (A11). */
  tone: Tone;
}

/** События, при которых герой сам не был в месте или тип не уточнён: такие места — не остановки пути. */
const OFF_PATH: ReadonlySet<HeroEvent> = new Set<HeroEvent>(['mention', 'link']);

const refKey = (r: { regionId: string; placeSlug?: string }) => (r.placeSlug ? `${r.regionId}/${r.placeSlug}` : r.regionId);

/**
 * Нити героя по его местам `spots` (heroSpots — по порядку связей, то есть по хронологии).
 * Остановки пути: `hero.path`, если он есть; иначе — места по порядку, кроме `mention` и `link`
 * (герой там не был или тип связи ещё не уточнён партией E14). Соседние остановки — шаги пути.
 * Остальные места — пунктир от ближайшей предшествующей остановки (нет такой — от первой);
 * если остановок нет совсем — пунктир цепочкой по порядку, как раньше.
 * Места без точки на карте пропускаются. Нитей нет — undefined.
 */
export function heroThreads(hero: Hero, spots: Spot[]): HeroThreads | undefined {
  const placed = spots.filter((s) => s.point);
  if (placed.length < 2) return undefined;
  const byKey = new Map(placed.map((s) => [s.key, s]));

  let stops: Spot[];
  if (hero.path) {
    stops = [];
    for (const ref of hero.path) {
      const s = byKey.get(refKey(ref));
      if (s && stops[stops.length - 1] !== s) stops.push(s);
    }
  } else {
    stops = placed.filter((s) => !OFF_PATH.has(s.event));
  }

  const steps: ThreadStep[] = [];
  for (let i = 1; i < stops.length; i++) {
    const to = stops[i]!;
    steps.push({ from: stops[i - 1]!, to, kind: 'path', event: to.event });
  }
  const onPath = new Set(stops);
  placed.forEach((s, i) => {
    if (onPath.has(s)) return;
    let from: Spot | undefined;
    for (let j = i - 1; j >= 0 && !from; j--) if (onPath.has(placed[j]!)) from = placed[j];
    from ??= stops[0] ?? placed[i - 1];
    if (from) steps.push({ from, to: s, kind: 'link', event: s.event });
  });
  return steps.length > 0 ? { steps, tone: placed[0]!.tone } : undefined;
}

