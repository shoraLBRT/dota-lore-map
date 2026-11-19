import { describe, expect, it } from 'vitest';
import type { Lang, Region } from '../../data/types';
import { world } from '../../data/world';
import { frameCamera, SHEET_PEEK, STAGE_WIDTH, WORLD_ASPECT, type View } from './camera';
import { labelBox, placeMarkerLabels, type Box } from './labels';
import { kindOf, labelBounds, markerLabelItems } from './markerLayout';

/** Кадр как у `useCamera`: слой покрывает кадр (A4), панель справа на ноутбуке, шторка снизу на телефоне. */
function view(width: number, height: number): View {
  const layerWidth = Math.max(width, height * WORLD_ASPECT);
  const phone = width < 768;
  return {
    width,
    height,
    layerWidth,
    layerHeight: layerWidth / WORLD_ASPECT,
    inset: phone ? 0 : width >= 1280 ? 492 : 412,
    insetBottom: phone ? Math.round(height * SHEET_PEEK) : 0,
  };
}

/** Подписи мест региона на экране этого размера: сторона и рамка каждой показанной подписи, px. */
function layout(region: Region, size: [number, number], lang: Lang) {
  const stage = view(...size);
  const framed = frameCamera(region.layout!.camera, stage);
  const regionZoom = framed.camera.zoom;
  const markerScale = STAGE_WIDTH / stage.layerWidth / regionZoom;
  const spots = region.places.filter((p) => p.pos);
  const items = markerLabelItems(spots, { activeId: region.id, activePlaceSlug: undefined, focusPlaces: null, lang, widths: {}, markerScale });
  const bounds = labelBounds({ view: stage, inset: stage.inset, insetBottom: stage.insetBottom ?? 0, framed, regionZoom });
  const sides = placeMarkerLabels(items, bounds);
  const shown = items.flatMap((m) => {
    const side = sides.get(m.key)!;
    if (side === 'hidden') return [];
    const b = labelBox(side, m);
    return [{ key: m.key, box: { left: b.left + m.x, right: b.right + m.x, top: b.top + m.y, bottom: b.bottom + m.y } }];
  });
  return { spots, sides, shown };
}

const cross = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Три самых плотных региона по числу мест на карте (#191). */
const densest = [...world.regions]
  .filter((r) => r.layout)
  .sort((a, b) => b.places.filter((p) => p.pos).length - a.places.filter((p) => p.pos).length)
  .slice(0, 3);

describe('подписи мест в самых плотных регионах не пересекаются (#191)', () => {
  it('выбраны регионы с местами', () => {
    expect(densest).toHaveLength(3);
    for (const r of densest) expect(r.places.filter((p) => p.pos).length).toBeGreaterThan(5);
  });

  for (const size of [
    [1440, 900],
    [375, 812],
  ] as [number, number][]) {
    for (const lang of ['ru', 'en'] as Lang[]) {
      it.each(densest.map((r) => [r.id, r] as const))(`%s, ${size.join('×')}, ${lang}`, (_id, region) => {
        const { spots, sides, shown } = layout(region, size, lang);
        for (let i = 0; i < shown.length; i++) {
          for (let j = i + 1; j < shown.length; j++) {
            expect(cross(shown[i]!.box, shown[j]!.box), `${shown[i]!.key} × ${shown[j]!.key}`).toBe(false);
          }
        }
        // Столица подписана всегда; подписи по возможности сбоку от точки.
        for (const p of spots.filter((s) => s.capital)) expect(sides.get(p.slug)).not.toBe('hidden');
        expect(shown.length).toBeGreaterThan(0);
      });
    }
  }
});

describe('вид маркера (#191)', () => {
  it('столица, место события и место — разные виды', () => {
    const kinds = new Set(world.regions.flatMap((r) => r.places.map(kindOf)));
    expect(kinds).toEqual(new Set(['capital', 'event', 'place']));
  });
});
