import { describe, expect, it } from 'vitest';
import type { Lang } from '../../data/types';
import { world } from '../../data/world';
import { containScale, polygonBox, SHEET_PEEK, WORLD_ASPECT, zoomLevels, type View } from './camera';
import { labelBox, placeRegionLabels, type Box } from './labels';
import { kindOf } from './markerLayout';
import { levelsOf, regionLabelItems } from './regionLabelLayout';
import { insidePolygon, placeThreshold, placeWorldPlaces, regionUnder, worldPlaceItems } from './worldPlaces';

/** Кадр как у `useCamera`: слой покрывает кадр (A4), панель справа на ноутбуке. */
function view(width: number, height: number): View {
  const layerWidth = Math.max(width, height * WORLD_ASPECT);
  return {
    width,
    height,
    layerWidth,
    layerHeight: layerWidth / WORLD_ASPECT,
    inset: width < 768 ? 0 : width >= 1280 ? 492 : 412,
    insetBottom: width < 768 ? Math.round(height * SHEET_PEEK) : 0,
  };
}

const drawn = world.regions.filter((r) => r.layout);
const boxes = drawn.map((r) => polygonBox(r.layout!.polygon));

/** Мир на экране этого размера: названия регионов и маркеры мест, как их ставит MapStage. */
function layout(size: [number, number], lang: Lang = 'en') {
  const stage = view(...size);
  const zoomMax = zoomLevels(boxes, stage).zoomMax;
  const fitted = stage.layerWidth * containScale(stage);
  const w = { width: stage.layerWidth, height: stage.layerHeight };
  const levels = levelsOf(drawn);
  const nameItems = regionLabelItems(drawn, { name: (r) => r.name[lang], levels, widths: {}, fitted, zoomFrom: 1 });
  const names = { items: nameItems, spots: placeRegionLabels(nameItems, w, zoomMax) };
  const items = worldPlaceItems(drawn, { lang, zoomFrom: 1, zoomMax });
  const spots = placeWorldPlaces(items, names, w, zoomMax);
  return { zoomMax, w, names, items, spots };
}

const shift = (b: Box, x: number, y: number): Box => ({ left: b.left + x, right: b.right + x, top: b.top + y, bottom: b.bottom + y });
const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe('смысловой зум: места в мире (#190, SPEC §8.6)', () => {
  it('пороги: столицы около 1.5× на 1440×900, места событий и второстепенные — глубже, все до потолка мира', () => {
    const { zoomMax } = layout([1440, 900]);
    const capital = placeThreshold('capital', 1, zoomMax);
    expect(capital).toBeGreaterThan(1.4);
    expect(capital).toBeLessThan(1.6);
    expect(placeThreshold('event', 1, zoomMax)).toBeGreaterThan(capital);
    expect(placeThreshold('place', 1, zoomMax)).toBeGreaterThan(placeThreshold('event', 1, zoomMax));
    expect(placeThreshold('place', 1, zoomMax)).toBeLessThan(zoomMax);
  });

  for (const size of [[1440, 900], [1920, 1080], [1024, 768]] as [number, number][]) {
    it(`${size.join('×')}: на 1× мест нет, на пороге — только столицы, глубже — остальные`, () => {
      const { zoomMax, items, spots } = layout(size);
      const shownAt = (z: number) => items.filter((m) => z >= spots.get(m.key)!.from - 1e-6);
      expect(shownAt(1)).toHaveLength(0);
      const capital = placeThreshold('capital', 1, zoomMax);
      const first = shownAt(capital);
      expect(first.length).toBeGreaterThan(0);
      expect(first.every((m) => kindOf(m.place) === 'capital')).toBe(true);
      expect(shownAt(zoomMax).length).toBeGreaterThan(first.length * 2);
    });

    it(`${size.join('×')}: маркеры и подписи не задевают друг друга и названия регионов ни на одном зуме мира`, () => {
      const { zoomMax, w, names, items, spots } = layout(size);
      for (let z = 1; z <= zoomMax + 1e-9; z += 0.05) {
        const boxesAt: { key: string; box: Box }[] = [];
        for (const n of names.items) {
          const s = names.spots.get(n.id)!;
          if (z < s.from - 1e-6) continue;
          const [x, y] = [n.x * w.width * z, n.y * w.height * z];
          boxesAt.push({ key: `name:${n.id}`, box: shift(s.box, x, y) });
          if (s.crest) boxesAt.push({ key: `crest:${n.id}`, box: shift(s.crest, x, y) });
        }
        for (const m of items) {
          const s = spots.get(m.key)!;
          if (z < s.from - 1e-6) continue;
          const [x, y] = [m.x * w.width * z, m.y * w.height * z];
          boxesAt.push({ key: `ring:${m.key}`, box: shift({ left: -m.ring, right: m.ring, top: -m.ring, bottom: m.ring }, x, y) });
          if (s.side !== 'hidden') boxesAt.push({ key: `label:${m.key}`, box: shift(labelBox(s.side, m), x, y) });
        }
        const hits: string[] = [];
        for (let i = 0; i < boxesAt.length; i++) {
          for (let j = i + 1; j < boxesAt.length; j++) {
            const a = boxesAt[i]!;
            const b = boxesAt[j]!;
            // Название и герб одного региона стоят рядом по построению (#189).
            if (a.key.startsWith('name:') && b.key.startsWith('crest:') && a.key.slice(5) === b.key.slice(6)) continue;
            if (a.key.split(':')[1] === b.key.split(':')[1] && !a.key.startsWith('name') && !a.key.startsWith('crest')) continue;
            // Названия регионов между собой — правило #189 (labels.test.ts).
            if (/^(name|crest):/.test(a.key) && /^(name|crest):/.test(b.key)) continue;
            if (overlap(a.box, b.box)) hits.push(`${z.toFixed(2)} ${a.key} × ${b.key}`);
          }
        }
        expect(hits).toEqual([]);
      }
    });
  }

  it('у большинства столиц на потолке мира есть подпись', () => {
    const { items, spots } = layout([1440, 900]);
    const capitals = items.filter((m) => m.place.capital);
    const labelled = capitals.filter((m) => spots.get(m.key)!.side !== 'hidden' && spots.get(m.key)!.from < Infinity);
    expect(labelled.length).toBeGreaterThanOrEqual(Math.ceil(capitals.length * 0.6));
  });

  it('регион под камерой — тот, чей полигон содержит центр кадра', () => {
    const square: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(insidePolygon([0.5, 0.5], square)).toBe(true);
    expect(insidePolygon([1.5, 0.5], square)).toBe(false);
    for (const r of drawn.filter((d) => d.tier === 'continent').slice(0, 5)) {
      const inner = r.places.find((p) => p.pos && insidePolygon(p.pos, r.layout!.polygon));
      if (inner) expect(regionUnder(drawn, inner.pos!)?.id).toBe(r.id);
    }
  });
});
