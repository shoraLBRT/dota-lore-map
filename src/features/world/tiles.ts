// Пирамида тайлов арта мира (#164, ARCHITECTURE A10): при сильном приближении поверх world-4096.webp
// подгружаются тайлы 512 px того уровня, которому хватает пикселей экрана, — только видимые.
// Манифест `tiles.json` пишет `node map/art/tiles.mjs pyramid`; пустой `levels` — пирамиды нет, слой выключен.

import manifest from './tiles.json';

export interface TilePyramid {
  /** Сторона тайла, px. */
  tile: number;
  /** Уровни z: сторона мира на уровне — tile · 2^z px. По возрастанию. */
  levels: number[];
}

export interface TileRef {
  z: number;
  x: number;
  y: number;
}

/** Сторона картинки мира без тайлов (public/art/world-4096.webp). */
export const WORLD_ART_PX = 4096;
/** Тайлы включаются, когда экрану нужно больше пикселей, чем у картинки мира, с этим запасом. */
export const TILES_FROM = 1.1;

/** Пирамида из манифеста; `undefined` — тайлов нет (переключатель слоя). */
export const WORLD_TILES: TilePyramid | undefined = manifest.levels.length
  ? { tile: manifest.tile, levels: [...manifest.levels].sort((a, b) => a - b) }
  : undefined;

/** Адрес тайла: `public/map/tiles/{z}/{x}_{y}.webp`. */
export function tileUrl({ z, x, y }: TileRef, base: string = import.meta.env.BASE_URL): string {
  return `${base}map/tiles/${z}/${x}_${y}.webp`;
}

/**
 * Уровень пирамиды для `needPx` — сколько пикселей экрана приходится на сторону мира.
 * Хватает картинки мира — `undefined`; иначе наименьший уровень не мельче нужного (или самый крупный).
 */
export function tileLevel(pyramid: TilePyramid, needPx: number): number | undefined {
  if (needPx <= WORLD_ART_PX * TILES_FROM) return undefined;
  return pyramid.levels.find((z) => pyramid.tile * 2 ** z >= needPx) ?? pyramid.levels[pyramid.levels.length - 1];
}

/** Видимая часть мира в долях стороны (0..1). */
export interface WorldRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Тайлы уровня z, задевающие видимую часть, с запасом `margin` тайла по краям. */
export function tilesIn(z: number, rect: WorldRect, margin = 0.5): TileRef[] {
  const n = 2 ** z;
  const lo = (v: number) => Math.max(0, Math.floor(v * n - margin));
  const hi = (v: number) => Math.min(n - 1, Math.ceil(v * n + margin) - 1);
  const out: TileRef[] = [];
  for (let y = lo(rect.y0); y <= hi(rect.y1); y++) for (let x = lo(rect.x0); x <= hi(rect.x1); x++) out.push({ z, x, y });
  return out;
}

/**
 * Какие тайлы показать: по размерам слоя мира и кадра на экране (getBoundingClientRect) и плотности пикселей.
 * Пустой список — хватает картинки мира.
 */
export function visibleTiles(
  pyramid: TilePyramid,
  layer: { left: number; top: number; width: number; height: number },
  frame: { left: number; top: number; width: number; height: number },
  dpr = 1,
): TileRef[] {
  if (layer.width <= 0 || layer.height <= 0) return [];
  const z = tileLevel(pyramid, Math.max(layer.width, layer.height) * dpr);
  if (z === undefined) return [];
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const rect = {
    x0: clamp((frame.left - layer.left) / layer.width),
    y0: clamp((frame.top - layer.top) / layer.height),
    x1: clamp((frame.left + frame.width - layer.left) / layer.width),
    y1: clamp((frame.top + frame.height - layer.top) / layer.height),
  };
  if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) return [];
  return tilesIn(z, rect);
}

export const tileKey = ({ z, x, y }: TileRef) => `${z}/${x}_${y}`;
