import { useMemo } from 'react';
import type { Lang, Place, Significance } from '../../data/types';
import { placeName } from '../../data/world';
import { LABEL_GAP, LABEL_PAD_X, LABEL_PAD_Y, placeMarkerLabels, type Box, type LabelSide, type MarkerLabel } from './labels';
import { toStage } from './stage';
import { toScreen, visibleFrame } from './threadGeometry';
import type { Frame } from './useCamera';

/** Отступ подписей маркеров от края видимой части кадра, px. */
const LABEL_MARGIN = 4;

/** Кегль подписей маркеров (MarkersLayer.module.css: .markerLabel, .capital и .current .markerLabel, .minor .markerLabel), px. */
const MARKER_FONT = 13;
const CAPITAL_FONT = 17;
const MINOR_FONT = 12;

/** Значимость места (#68, SPEC §6.3); нет поля — как `event`. */
export const significance = (p: Place): Significance => p.significance ?? 'event';
/** Вид маркера (#191, SPEC §6.3): столица — звезда, место события — ромб, остальное место — точка. */
export type MarkerKind = 'capital' | 'event' | 'place';
export const kindOf = (p: Place): MarkerKind => (p.capital ? 'capital' : significance(p) === 'minor' ? 'place' : 'event');
/**
 * Радиус фигуры маркера, px (по нему расставляются подписи): выбранное место (крупнее всех, #96), столица,
 * место события, место. Зона нажатия больше фигуры — `HIT_RADIUS` (MarkersLayer).
 */
export const ringOf = (p: Place, selected = false) => (selected ? 10 : { capital: 9, event: 6, place: 4 }[kindOf(p)]);
/** Кегль подписи: у выбранного места — как у столицы (MarkersLayer.module.css: .current .markerLabel). */
export const fontOf = (p: Place, selected = false) =>
  selected || p.capital ? CAPITAL_FONT : significance(p) === 'minor' ? MINOR_FONT : MARKER_FONT;
/** Порядок подписей после текущего места, столицы и мест героя: события, второстепенные (labels.ts). */
const SIGNIFICANCE_RANK: Record<Significance, number> = { event: 3, minor: 4 };

/** Подпись маркера на стороне `side`: якорь и базовая линия текста внутри её рамки (labels.ts: labelBox). */
export function markerLabelAttrs(
  side: LabelSide,
  ring: number,
  size: number,
): { x: number; y: number; textAnchor: 'start' | 'middle' | 'end' } {
  const d = ring + LABEL_GAP;
  switch (side) {
    case 'bottom':
      return { x: 0, y: d + LABEL_PAD_Y + 0.78 * size, textAnchor: 'middle' };
    case 'right':
      return { x: d + LABEL_PAD_X, y: 0.28 * size, textAnchor: 'start' };
    case 'left':
      return { x: -d - LABEL_PAD_X, y: 0.28 * size, textAnchor: 'end' };
    default:
      return { x: 0, y: -d - LABEL_PAD_Y - 0.22 * size, textAnchor: 'middle' };
  }
}

interface ItemOptions {
  activeId: string | undefined;
  activePlaceSlug: string | undefined;
  /** Ключи `region/slug` мест выбранного героя. */
  focusPlaces: Set<string> | null;
  lang: Lang;
  widths: Record<string, number>;
  markerScale: number;
}

/**
 * Подписи маркеров по порядку расстановки (labels.ts: placeMarkerLabels): текущее место, столица, места героя,
 * затем по значимости; координаты — в единицах группы маркера (1 = 1 экранный px).
 */
export function markerLabelItems(spots: Place[], { activeId, activePlaceSlug, focusPlaces, lang, widths, markerScale }: ItemOptions): MarkerLabel[] {
  const rank = (p: Place) =>
    p.slug === activePlaceSlug ? 0 : p.capital ? 1 : focusPlaces?.has(`${activeId}/${p.slug}`) ? 2 : SIGNIFICANCE_RANK[significance(p)];
  return [...spots]
    .sort((a, b) => rank(a) - rank(b))
    .map((p) => {
      const [x, y] = toStage(p.pos!);
      const selected = p.slug === activePlaceSlug;
      const size = fontOf(p, selected);
      return {
        key: p.slug,
        x: x / markerScale,
        y: y / markerScale,
        // Без измерений — оценка по числу знаков.
        width: widths[`m:${p.slug}`] ?? placeName(p, lang).length * size * 0.6,
        size,
        ring: ringOf(p, selected),
        must: rank(p) < 2,
        selected,
      };
    });
}

/**
 * Видимая часть кадра (левее панели, выше шторки) в единицах маркеров: подписи не уходят за край (аудит E13).
 * Без измерений — `undefined`.
 */
export function labelBounds({ view, inset, insetBottom, framed, regionZoom }: Pick<Frame, 'view' | 'inset' | 'insetBottom' | 'framed' | 'regionZoom'>): Box | undefined {
  if (view.width <= 0) return undefined;
  const frame = visibleFrame(view, inset, LABEL_MARGIN, insetBottom);
  const [ox, oy] = toScreen([0, 0], framed.camera, framed.offset, view, framed.offsetY);
  const k = regionZoom / framed.camera.zoom;
  return { left: (frame.left - ox) * k, right: (frame.right - ox) * k, top: (frame.top - oy) * k, bottom: (frame.bottom - oy) * k };
}

interface Options {
  spots: Place[];
  activeId: string | undefined;
  activePlaceSlug: string | undefined;
  /** Ключи `region/slug` мест выбранного героя. */
  focusPlaces: Set<string> | null;
  lang: Lang;
  widths: Record<string, number>;
  frame: Frame;
}

/**
 * Подписи маркеров (ARCHITECTURE A4, SPEC §8.6): не налезают друг на друга и не выходят за видимую часть кадра;
 * текущее место, столица и места героя ставятся первыми. `items` — рамки в единицах маркеров, `sides` — где подпись.
 */
export function useMarkerLabels({ spots, activeId, activePlaceSlug, focusPlaces, lang, widths, frame: cam }: Options) {
  const { markerScale, regionZoom, view, inset, insetBottom, framed } = cam;
  const items = useMemo(
    () => markerLabelItems(spots, { activeId, activePlaceSlug, focusPlaces, lang, widths, markerScale }),
    [spots, activePlaceSlug, focusPlaces, activeId, lang, widths, markerScale],
  );
  const sides = useMemo(
    () => placeMarkerLabels(items, activeId ? labelBounds({ view, inset, insetBottom, framed, regionZoom }) : undefined),
    [items, activeId, view, inset, insetBottom, framed, regionZoom],
  );
  return { items, sides };
}
