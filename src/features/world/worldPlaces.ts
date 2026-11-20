// Смысловой зум (#190, SPEC §8.6): маркеры мест в режиме мира появляются по значимости с приближением.
// Чистые правила и хук для MapStage; расстановка — раз на кадр, язык и замер, не на кадр зума (как названия, #189).

import { useMemo } from 'react';
import type { Lang, Place, Point, Region } from '../../data/types';
import { placeName } from '../../data/world';
import { labelBox, LEVEL_STEP, overlapsOnZoom, type Box, type LabelSide } from './labels';
import { fontOf, kindOf, ringOf, type MarkerKind } from './markerLayout';
import type { RegionNames } from './regionLabelLayout';

/**
 * Порог появления маркеров в мире — доля пути от самого дальнего приближения мира до его потолка (#190):
 * столицы — с 0.45 (на 1440×900 ≈ 1.5×), места событий — с 0.7, второстепенные — с 0.9.
 */
export const PLACE_SHARE: Record<MarkerKind, number> = { capital: 0.45, event: 0.7, place: 0.9 };

/** Средняя ширина знака подписи маркера в кеглях — пока подписи мира не измерены (jsdom, до шрифтов). */
export const PLACE_CHAR_EM = 0.62;

/** Просвет между маркерами, подписями и названиями регионов в мире, px. */
const PAD = 2;

/** С какого приближения мира виден маркер вида `kind`: `zoomFrom` — самое дальнее приближение, `zoomMax` — потолок. */
export function placeThreshold(kind: MarkerKind, zoomFrom: number, zoomMax: number): number {
  return zoomFrom + PLACE_SHARE[kind] * Math.max(0, zoomMax - zoomFrom);
}

export interface WorldPlaceItem {
  /** `регион/место`. */
  key: string;
  regionId: string;
  place: Place;
  /** Точка маркера, доли мира. */
  x: number;
  y: number;
  /** Радиус фигуры, кегль и ширина подписи, px. */
  ring: number;
  size: number;
  width: number;
  /** Порог вида места (`placeThreshold`). */
  from: number;
}

export interface WorldPlaceSpot {
  /** Сторона подписи; `hidden` — подписи нет места, видна при наведении. */
  side: LabelSide;
  /** С какого приближения маркер виден на самом деле; Infinity — в мире не показывается. */
  from: number;
}

const RANK: Record<MarkerKind, number> = { capital: 0, event: 1, place: 2 };

/** Маркеры мира по порядку расстановки: столицы, места событий, второстепенные; внутри — по порядку данных. */
export function worldPlaceItems(
  drawn: Region[],
  { lang, zoomFrom, zoomMax, widths = {} }: { lang: Lang; zoomFrom: number; zoomMax: number; widths?: Record<string, number> },
): WorldPlaceItem[] {
  return drawn
    .flatMap((r) =>
      r.places.flatMap((p) => {
        if (!p.pos) return [];
        const size = fontOf(p);
        return [
          {
            key: `${r.id}/${p.slug}`,
            regionId: r.id,
            place: p,
            x: p.pos[0],
            y: p.pos[1],
            ring: ringOf(p),
            size,
            // Замер (`WorldPlaceMeasure`), без него — оценка по числу знаков.
            width: widths[`wp:${r.id}/${p.slug}`] ?? placeName(p, lang).length * size * PLACE_CHAR_EM,
            from: placeThreshold(kindOf(p), zoomFrom, zoomMax),
          },
        ];
      }),
    )
    .map((m, i) => ({ m, i }))
    .sort((a, b) => RANK[kindOf(a.m.place)] - RANK[kindOf(b.m.place)] || a.i - b.i)
    .map(({ m }) => m);
}

interface Obstacle {
  box: Box;
  at: readonly [number, number];
  from: number;
}

/** Самое дальнее от точки ребро рамки, px. */
const reach = (b: Box) => Math.max(-b.left, b.right, -b.top, b.bottom);

/**
 * Расстановка маркеров мира (#190, SPEC §8.6). По порядку `items` маркер встаёт с порога своего вида, если во всём
 * диапазоне [порог, zoomMax] его фигура не задевает названия и гербы регионов (`names`) и уже поставленные маркеры
 * с подписями; подпись — на первую свободную сторону (справа, слева, сверху, снизу). Тесно — порог растёт шагом
 * `LEVEL_STEP`; подписи нет места и на потолке — маркер с самого раннего свободного порога, подпись скрыта;
 * нет места и фигуре — в мире маркера нет (место — в своём регионе). `world` — мир в px при zoom 1.
 */
export function placeWorldPlaces(
  items: WorldPlaceItem[],
  names: Pick<RegionNames, 'spots' | 'items'>,
  world: { width: number; height: number },
  zoomMax: number,
): Map<string, WorldPlaceSpot> {
  const obstacles: Obstacle[] = [];
  for (const n of names.items) {
    const spot = names.spots.get(n.id);
    if (!spot || spot.from === Infinity) continue;
    const at = [n.x, n.y] as const;
    obstacles.push({ box: spot.box, at, from: spot.from });
    if (spot.crest) obstacles.push({ box: spot.crest, at, from: spot.from });
  }
  const result = new Map<string, WorldPlaceSpot>();
  const sides = ['right', 'left', 'top', 'bottom'] as const;
  for (const m of items) {
    const at = [m.x, m.y] as const;
    const ring: Box = { left: -m.ring, right: m.ring, top: -m.ring, bottom: m.ring };
    const boxes = sides.map((side) => ({ side, box: labelBox(side, m) }));
    const own = Math.max(m.ring, ...boxes.map((b) => reach(b.box)));
    // Рядом — только то, что может задеть маркер хотя бы на его пороге: дальше точки только расходятся.
    const near = obstacles.filter((o) => {
      const r = own + reach(o.box) + PAD;
      return Math.abs(o.at[0] - m.x) * world.width * m.from < r && Math.abs(o.at[1] - m.y) * world.height * m.from < r;
    });
    const free = (box: Box, z: number) =>
      near.every((o) => {
        const z0 = Math.max(z, o.from);
        return z0 > zoomMax || !overlapsOnZoom(box, at, o.box, o.at, world, z0, zoomMax, PAD);
      });
    let bare: number | undefined;
    let spot: WorldPlaceSpot | undefined;
    for (let z = m.from; z <= zoomMax + 1e-9; z += LEVEL_STEP) {
      if (!free(ring, z)) continue;
      bare ??= z;
      const pick = boxes.find((b) => free(b.box, z));
      if (pick) {
        spot = { side: pick.side, from: z };
        obstacles.push({ box: ring, at, from: z }, { box: pick.box, at, from: z });
        break;
      }
    }
    if (!spot && bare !== undefined) {
      spot = { side: 'hidden', from: bare };
      obstacles.push({ box: ring, at, from: bare });
    }
    result.set(m.key, spot ?? { side: 'hidden', from: Infinity });
  }
  return result;
}

/** Точка внутри многоугольника (доли мира, чётность пересечений). */
export function insidePolygon([x, y]: readonly [number, number], polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Регион «под камерой» (#190): его полигон содержит центр кадра. */
export function regionUnder(drawn: Region[], center: readonly [number, number]): Region | undefined {
  return drawn.find((r) => r.layout && insidePolygon(center, r.layout.polygon));
}

/**
 * Маркеры мест в мире на кадр (#190): порядок, пороги и стороны подписей. Пересчёт — при смене кадра, языка
 * и названий регионов, не на каждый кадр зума.
 */
export function useWorldPlaces(
  drawn: Region[],
  opts: {
    lang: Lang;
    names: RegionNames;
    widths: Record<string, number>;
    zoomFrom: number;
    zoomMax: number;
    world: { width: number; height: number };
    enabled: boolean;
  },
) {
  const { lang, names, widths, zoomFrom, zoomMax, world, enabled } = opts;
  const w = world.width;
  const h = world.height;
  return useMemo(() => {
    if (!enabled || w <= 0 || h <= 0) return { items: [] as WorldPlaceItem[], spots: new Map<string, WorldPlaceSpot>() };
    const items = worldPlaceItems(drawn, { lang, zoomFrom, zoomMax, widths });
    return { items, spots: placeWorldPlaces(items, names, { width: w, height: h }, zoomMax) };
  }, [drawn, lang, names, widths, zoomFrom, zoomMax, w, h, enabled]);
}
