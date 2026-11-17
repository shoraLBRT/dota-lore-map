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
/** Радиус кольца маркера, px: выбранное место (крупнее всех, #96), столица, место, второстепенное место (меньше). */
export const ringOf = (p: Place, selected = false) => (selected ? 13 : p.capital ? 11 : significance(p) === 'minor' ? 7 : 9);
/** Кегль подписи: у выбранного места — как у столицы (MarkersLayer.module.css: .current .markerLabel). */
export const fontOf = (p: Place, selected = false) =>
  selected || p.capital ? CAPITAL_FONT : significance(p) === 'minor' ? MINOR_FONT : MARKER_FONT;
/** Порядок подписей после текущего места, столицы и мест героя: события, второстепенные (labels.ts). */
const SIGNIFICANCE_RANK: Record<Significance, number> = { event: 3, minor: 4 };

/** Подпись маркера на стороне `side`: якорь и базовая линия текста внутри плашки (labels.ts: labelBox). */
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
  const items = useMemo(() => {
    const rank = (p: Place) =>
      p.slug === activePlaceSlug
        ? 0
        : p.capital
          ? 1
          : focusPlaces?.has(`${activeId}/${p.slug}`)
            ? 2
            : SIGNIFICANCE_RANK[significance(p)];
    const out: MarkerLabel[] = [...spots]
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
    return out;
  }, [spots, activePlaceSlug, focusPlaces, activeId, lang, widths, markerScale]);
  const sides = useMemo(() => {
    // Видимая часть кадра (левее панели, выше шторки) в единицах маркеров: подписи не уходят за край (аудит E13).
    let bounds: Box | undefined;
    if (view.width > 0 && activeId) {
      const frame = visibleFrame(view, inset, LABEL_MARGIN, insetBottom);
      const [ox, oy] = toScreen([0, 0], framed.camera, framed.offset, view, framed.offsetY);
      const k = regionZoom / framed.camera.zoom;
      bounds = { left: (frame.left - ox) * k, right: (frame.right - ox) * k, top: (frame.top - oy) * k, bottom: (frame.bottom - oy) * k };
    }
    return placeMarkerLabels(items, bounds);
  }, [items, activeId, view, inset, insetBottom, framed, regionZoom]);
  // Ширина текста каждой подписи — для плашки под ней (MarkersLayer, #98).
  const labelWidths = useMemo(() => new Map(items.map((m) => [m.key, m.width])), [items]);
  return { items, sides, labelWidths };
}
