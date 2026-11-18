import { describe, expect, it } from 'vitest';
import { tileLevel, tilesIn, tileUrl, visibleTiles, WORLD_ART_PX } from './tiles';

// Пирамида тайлов арта (#164, ARCHITECTURE A10).
const pyramid = { tile: 512, levels: [4, 5] };

describe('tiles', () => {
  it('уровень: хватает картинки мира — без тайлов, иначе наименьший достаточный, сверху — самый крупный', () => {
    expect(tileLevel(pyramid, 1440)).toBeUndefined();
    expect(tileLevel(pyramid, WORLD_ART_PX * 1.05)).toBeUndefined();
    expect(tileLevel(pyramid, 6144)).toBe(4);
    expect(tileLevel(pyramid, 9000)).toBe(5);
    expect(tileLevel(pyramid, 40000)).toBe(5);
  });

  it('видимые тайлы — с запасом в полтайла и без выхода за край мира', () => {
    expect(tilesIn(1, { x0: 0, y0: 0, x1: 1, y1: 1 })).toHaveLength(4);
    const t = tilesIn(4, { x0: 0.5, y0: 0.5, x1: 0.6, y1: 0.55 });
    expect(Math.min(...t.map((r) => r.x))).toBe(7);
    expect(Math.max(...t.map((r) => r.x))).toBe(10);
    expect(tilesIn(4, { x0: 0, y0: 0, x1: 0.01, y1: 0.01 })).toEqual([{ z: 4, x: 0, y: 0 }]);
  });

  it('по прямоугольникам слоя и кадра: приближение ×4.27 на 1440×900 — уровень 4, только видимое', () => {
    const layer = { left: -3000, top: -2000, width: 6144, height: 6144 };
    const frame = { left: 0, top: 0, width: 1440, height: 900 };
    const tiles = visibleTiles(pyramid, layer, frame);
    expect(new Set(tiles.map((t) => t.z))).toEqual(new Set([4]));
    // 1440 px кадра — 3.75 тайла по 384 px, плюс запас: не больше 6 столбцов и 5 рядов.
    expect(tiles.length).toBeLessThanOrEqual(30);
    expect(visibleTiles(pyramid, { ...layer, width: 1440, height: 1440 }, frame)).toEqual([]);
    // Плотность пикселей: тот же кадр на ретине уже просит тайлы.
    expect(visibleTiles(pyramid, { left: 0, top: -270, width: 2880, height: 2880 }, frame, 2).length).toBeGreaterThan(0);
    expect(visibleTiles(pyramid, { left: 0, top: 0, width: 0, height: 0 }, frame)).toEqual([]);
  });

  it('адрес тайла — public/map/tiles/{z}/{x}_{y}.webp от BASE_URL', () => {
    expect(tileUrl({ z: 4, x: 3, y: 7 }, '/dota-lore-map/')).toBe('/dota-lore-map/map/tiles/4/3_7.webp');
  });
});
