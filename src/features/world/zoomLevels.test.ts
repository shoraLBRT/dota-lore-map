import { describe, expect, it } from 'vitest';
import { world } from '../../data/world';
import {
  clampCamera,
  frameCamera,
  maxZoom,
  placeCamera,
  polygonBox,
  REGION_ZOOM_IN,
  SHEET_PEEK,
  WORLD_ASPECT,
  WORLD_SHARE,
  zoomLevels,
  type View,
} from './camera';
import { zoomAt } from './freeCamera';

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

const drawn = world.regions.filter((r) => r.layout);
const cameras = drawn.map((r) => r.layout!.camera);
const frame = (id: string, stage: View) => frameCamera(drawn.find((r) => r.id === id)!.layout!.camera, stage).camera.zoom;

describe('уровни зума вложены (#209, SPEC §8.6)', () => {
  for (const size of [[1440, 900], [375, 812]] as const) {
    const stage = view(size[0], size[1]);
    const frames = cameras.map((c) => frameCamera(c, stage).camera.zoom).sort((a, b) => a - b);
    const median = frames[Math.floor(frames.length / 2)]!;

    it(`${size.join('×')}: потолок мира — ${WORLD_SHARE} медианы кадров ${frames.length} регионов`, () => {
      expect(frames.length % 2).toBe(1);
      const world = zoomLevels(cameras, stage);
      expect(world.zoomMin).toBe(1);
      expect(world.zoomMax).toBeCloseTo(Math.max(1, WORLD_SHARE * median));
      expect(world.zoomMax).toBeLessThan(median);
      // Колесо и кнопки на мире упираются в потолок.
      const limited = { ...stage, inset: 0, insetBottom: 0, ...world };
      expect(clampCamera({ x: 0.5, y: 0.5, zoom: 10 }, limited).zoom).toBeCloseTo(world.zoomMax);
      expect(zoomAt({ x: 0.5, y: 0.5, zoom: world.zoomMax }, limited, 2, 100, 100).zoom).toBeCloseTo(world.zoomMax);
    });

    it(`${size.join('×')}: в регионе — от потолка мира (или кадра) до кадра × ${REGION_ZOOM_IN}; место — в этих пределах`, () => {
      const worldMax = zoomLevels(cameras, stage).zoomMax;
      for (const region of drawn) {
        const own = frameCamera(region.layout!.camera, stage).camera.zoom;
        const levels = zoomLevels(cameras, stage, region.layout!.camera);
        expect(levels.zoomMax).toBeCloseTo(own * REGION_ZOOM_IN);
        expect(levels.zoomMin).toBeCloseTo(Math.min(worldMax, own));
        const roam = { ...stage, ...levels };
        expect(maxZoom(roam)).toBeCloseTo(Math.min(3, own * REGION_ZOOM_IN));
        expect(clampCamera({ ...region.layout!.camera, zoom: 10 }, roam).zoom).toBeLessThanOrEqual(own * REGION_ZOOM_IN + 1e-9);
        expect(clampCamera({ ...region.layout!.camera, zoom: 0.5 }, roam).zoom).toBeCloseTo(levels.zoomMin);
        for (const place of region.places.filter((p) => p.pos)) {
          const keep = { box: polygonBox(region.layout!.polygon), place: place.pos! };
          const zoom = frameCamera(placeCamera(region.layout!.camera, place.pos!), stage, keep).camera.zoom;
          expect(zoom).toBeLessThanOrEqual(levels.zoomMax + 1e-9);
        }
      }
    });
  }

  it('1440×900: потолок мира глубже TOOLTIP_MAX_ZOOM 2 — e2e подсказки доходит до порога; кадр медианного региона ближе', () => {
    const stage = view(1440, 900);
    const worldMax = zoomLevels(cameras, stage).zoomMax;
    expect(worldMax).toBeGreaterThan(2);
    expect(frame('wailing-mountains', stage)).toBeGreaterThan(worldMax);
  });

  it('без измерений — как раньше', () => {
    expect(zoomLevels(cameras, { width: 0, height: 0, layerWidth: 0, layerHeight: 0, inset: 0 })).toEqual({ zoomMin: 1, zoomMax: 3 });
  });
});
